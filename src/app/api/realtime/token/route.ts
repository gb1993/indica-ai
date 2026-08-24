import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === request.nextUrl.origin &&
    (!fetchSite || fetchSite === "same-origin");
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Origem não autorizada." },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  if (!userData.user || !session || session.user.id !== userData.user.id) {
    return NextResponse.json(
      { error: "Sessão inválida." },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      accessToken: session.access_token,
      expiresAt: session.expires_at,
      userId: userData.user.id,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
      },
    },
  );
}
