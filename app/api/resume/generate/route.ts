import { randomUUID } from "node:crypto";

import { Document, renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createElement, type ComponentProps, type ReactElement } from "react";

import { generateResumeContent } from "@/agent/resume-generator";
import { guardPaidRoute } from "@/lib/access";
import { mapProfileRowToProfile } from "@/lib/profile-mapping";
import type { ProfileRow } from "@/types";

import { ResumePdfDocument } from "./ResumePdfDocument";

type GenerateResumeResult = { success: true } | { success: false; error: string };

export async function POST(): Promise<NextResponse<GenerateResumeResult>> {
  try {
    const guard = await guardPaidRoute({ requireAgentSwitch: false });

    if (!guard.ok) {
      return guard.response;
    }

    const { insforge, userId } = guard;

    const { data: row, error: readError } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<ProfileRow>();

    if (readError) {
      console.error("[resume/generate]", readError);
      return NextResponse.json(
        { success: false, error: "Failed to load your profile. Please try again." },
        { status: 500 },
      );
    }

    const hasFullName = (row?.full_name ?? "").trim().length > 0;
    const hasWorkExperience = (row?.work_experience ?? []).length > 0;
    if (!row || !hasFullName || !hasWorkExperience) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please save your profile with your full name and at least one work experience entry before generating a resume.",
        },
        { status: 400 },
      );
    }

    const profile = mapProfileRowToProfile(row);
    const previousResumeKey = row.resume_pdf_url;

    const generated = await generateResumeContent(profile);
    if (!generated.success) {
      return NextResponse.json({ success: false, error: generated.error }, { status: 500 });
    }

    let buffer: Buffer;
    try {
      // ResumePdfDocument is a custom component wrapping <Document>, one level
      // removed from the exact ReactElement<DocumentProps> renderToBuffer's
      // types expect; the cast reflects that nesting, not a type mismatch.
      const documentElement = createElement(ResumePdfDocument, {
        content: generated.data,
        profile,
      }) as unknown as ReactElement<ComponentProps<typeof Document>>;
      buffer = await renderToBuffer(documentElement);
    } catch (renderError) {
      console.error("[resume/generate]", renderError);
      return NextResponse.json(
        { success: false, error: "Could not create your resume PDF. Please try again." },
        { status: 500 },
      );
    }

    const key = `${userId}/${randomUUID()}.pdf`;
    const pdfBlob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
    const { data: uploadData, error: uploadError } = await insforge.storage
      .from("resumes")
      .upload(key, pdfBlob);

    if (uploadError || !uploadData) {
      console.error("[resume/generate]", uploadError);
      return NextResponse.json(
        { success: false, error: "Failed to save your generated resume. Please try again." },
        { status: 500 },
      );
    }

    const { error: writeError } = await insforge.database
      .from("profiles")
      .update({ resume_pdf_url: uploadData.key })
      .eq("id", userId);

    if (writeError) {
      console.error("[resume/generate]", writeError);
      const { error: cleanupError } = await insforge.storage.from("resumes").remove(uploadData.key);
      if (cleanupError) console.error("[resume/generate]", cleanupError);
      return NextResponse.json(
        { success: false, error: "Failed to save your generated resume. Please try again." },
        { status: 500 },
      );
    }

    if (previousResumeKey && previousResumeKey !== uploadData.key) {
      const { error: removeError } = await insforge.storage.from("resumes").remove(previousResumeKey);
      if (removeError) console.error("[resume/generate]", removeError);
    }

    revalidatePath("/profile");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[resume/generate]", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong generating your resume. Please try again." },
      { status: 500 },
    );
  }
}
