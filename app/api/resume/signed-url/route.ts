import { NextResponse } from "next/server";

import { createInsforgeServer } from "@/lib/insforge-server";
import type { ActionResult } from "@/types";

export async function GET(): Promise<NextResponse<ActionResult<{ url: string }>>> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, error: "You must be signed in to view your resume." },
        { status: 401 },
      );
    }

    const userId = authData.user.id;

    const { data: row, error: readError } = await insforge.database
      .from("profiles")
      .select("resume_pdf_url")
      .eq("id", userId)
      .maybeSingle<{ resume_pdf_url: string | null }>();

    if (readError) {
      console.error("[resume/signed-url]", readError);
      return NextResponse.json(
        { success: false, error: "Could not open your resume. Please try again." },
        { status: 500 },
      );
    }

    if (!row?.resume_pdf_url) {
      return NextResponse.json(
        { success: false, error: "No resume available yet." },
        { status: 404 },
      );
    }

    const { data: signed, error: signedUrlError } = await insforge.storage
      .from("resumes")
      .createSignedUrl(row.resume_pdf_url);

    if (signedUrlError || !signed) {
      console.error("[resume/signed-url]", signedUrlError);
      return NextResponse.json(
        { success: false, error: "Could not open your resume. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, url: signed.signedUrl });
  } catch (error) {
    console.error("[resume/signed-url]", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong opening your resume. Please try again." },
      { status: 500 },
    );
  }
}
