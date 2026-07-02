import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  loadImageAsDataUrl,
  parseSupabasePublicObjectUrl,
} from "@/lib/legacy/load-storage-image";

function isAllowedStorageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  if (!parseSupabasePublicObjectUrl(url)) return false;
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url || !isAllowedStorageUrl(url)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const dataUrl = await loadImageAsDataUrl(url);
  if (!dataUrl) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  return NextResponse.json({ dataUrl });
}
