import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const publicPaths = ["/login", "/registro"];

const coachForbiddenAdminPaths = [
  "/admin/dashboard",
  "/admin/usuarios",
  "/admin/planes",
  "/admin/estadisticas",
];

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  const pathname = request.nextUrl.pathname;
  const locale = routing.locales.find((l) =>
    pathname.startsWith(`/${l}`)
  ) ?? routing.defaultLocale;
  const pathWithoutLocale = pathname.replace(`/${locale}`, "") || "/";

  const isPublic =
    publicPaths.some((p) => pathWithoutLocale.startsWith(p)) ||
    pathWithoutLocale === "/";

  let supabaseResponse = intlResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic && pathWithoutLocale !== "/") {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  if (user && (pathWithoutLocale === "/login" || pathWithoutLocale === "/registro" || pathWithoutLocale === "/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      let dest = `/${locale}/mis-reservas`;
      if (profile.rol === "admin") dest = `/${locale}/admin/dashboard`;
      if (profile.rol === "coach") dest = `/${locale}/admin/clases`;
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  if (pathWithoutLocale.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("user_id", user.id)
      .single();
    if (!profile || !["admin", "coach"].includes(profile.rol)) {
      return NextResponse.redirect(new URL(`/${locale}/mis-reservas`, request.url));
    }
    if (
      profile.rol === "coach" &&
      coachForbiddenAdminPaths.some((p) => pathWithoutLocale.startsWith(p))
    ) {
      return NextResponse.redirect(new URL(`/${locale}/admin/clases`, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
