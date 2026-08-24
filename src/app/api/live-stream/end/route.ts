import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = uuidSchema.safeParse(body?.sessionId);
  if (!sessionId.success) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_live_stream", {
    p_session_id: sessionId.data,
  });
  if (error) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
}
