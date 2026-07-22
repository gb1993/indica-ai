import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
            }),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  const requiresAuthentication =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/app");

  if (!data?.claims && requiresAuthentication) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
