import { NextRequest, NextResponse } from "next/server";
// Must import the worker entry before PDFParse itself: pdfjs-dist (which
// pdf-parse wraps) needs its worker module resolvable as a real import, not
// a dynamically resolved bundler chunk, or it fails with "Setting up fake
// worker failed" under Next.js's server bundler (confirmed against the
// installed package's own troubleshooting docs, not assumed).
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

import { extractProfileFromResumeText } from "@/agent/resume-extractor";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { ActionResult, ExtractedProfileFields } from "@/types";

const MIN_EXTRACTABLE_TEXT_LENGTH = 50;

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ActionResult<{ data: ExtractedProfileFields }>>> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, error: "You must be signed in to extract a resume." },
        { status: 401 },
      );
    }

    const userId = authData.user.id;

    const body: unknown = await req.json();
    const resumeKey =
      typeof body === "object" && body !== null && "resumeKey" in body
        ? (body as { resumeKey: unknown }).resumeKey
        : undefined;

    if (typeof resumeKey !== "string" || resumeKey.length === 0) {
      return NextResponse.json(
        { success: false, error: "No resume selected to extract from." },
        { status: 400 },
      );
    }

    if (!resumeKey.startsWith(`${userId}/`)) {
      return NextResponse.json(
        { success: false, error: "You can only extract from your own resume." },
        { status: 403 },
      );
    }

    const { data: signed, error: signedUrlError } = await insforge.storage
      .from("resumes")
      .createSignedUrl(resumeKey);

    if (signedUrlError || !signed) {
      console.error("[resume/extract]", signedUrlError);
      return NextResponse.json(
        { success: false, error: "Could not read the uploaded resume. Please try again." },
        { status: 500 },
      );
    }

    const pdfResponse = await fetch(signed.signedUrl);
    if (!pdfResponse.ok) {
      console.error("[resume/extract]", pdfResponse.status, pdfResponse.statusText);
      return NextResponse.json(
        { success: false, error: "Could not read the uploaded resume. Please try again." },
        { status: 500 },
      );
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    const parser = new PDFParse({ data: pdfBuffer });
    let extractedText: string;
    try {
      const result = await parser.getText();
      extractedText = result.text;
    } finally {
      await parser.destroy();
    }

    if (extractedText.trim().length < MIN_EXTRACTABLE_TEXT_LENGTH) {
      return NextResponse.json({
        success: false,
        error: "Could not extract text from this PDF. Please try a different file.",
      });
    }

    const extraction = await extractProfileFromResumeText(extractedText);
    if (!extraction.success) {
      return NextResponse.json({ success: false, error: extraction.error });
    }

    return NextResponse.json({ success: true, data: extraction.data });
  } catch (error) {
    console.error("[resume/extract]", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong extracting your profile. Please try again." },
      { status: 500 },
    );
  }
}
