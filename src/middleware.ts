import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const publicPaths = ["/login", "/registro"];

const coachForbiddenAdminPaths = [
  "/admin/dashboard",
  "/admin/usuarios",
  "/admin/coaches",
  "/admin/planes",
  "/admin/estadisticas",
];

function getPathInfo(pathname: string) {
  const locale =
    routing.locales.find((l) => pathname.startsWith(`/${l}/`)) ??
    (pathname === `/${routing.defaultLocale}`
      ? routing.defaultLocale
      : routing.locales.find((l) => pathname === `/${l}`)) ??
    routing.defaultLocale;

  const pathWithoutLocale =
    pathname.replace(new RegExp(`^/${locale}`), "") || "/";

  return { locale, pathWithoutLocale };
}

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  const { locale, pathWithoutLocale } = getPathInfo(request.nextUrl.pathname);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const isPublic =
    publicPaths.some((p) => pathWithoutLocale.startsWith(p)) ||
    pathWithoutLocale === "/";

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublic && pathWithoutLocale !== "/") {
      const redirect = NextResponse.redirect(
        new URL(`/${locale}/login`, request.url)
      );
      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie);
      });
      return redirect;
    }

    if (
      user &&
      (pathWithoutLocale === "/login" ||
        pathWithoutLocale === "/registro" ||
        pathWithoutLocale === "/")
    ) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("rol")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        let dest = `/${locale}/mis-reservas`;
        if (profile.rol === "admin") dest = `/${locale}/admin/dashboard`;
        if (profile.rol === "coach") dest = `/${locale}/admin/clases`;
        const redirect = NextResponse.redirect(new URL(dest, request.url));
        response.cookies.getAll().forEach((cookie) => {
          redirect.cookies.set(cookie);
        });
        return redirect;
      }
    }

    if (pathWithoutLocale.startsWith("/admin")) {
      if (!user) {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/login`, request.url)
        );
        response.cookies.getAll().forEach((cookie) => {
          redirect.cookies.set(cookie);
        });
        return redirect;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("rol")
        .eq("user_id", user.id)
        .single();

      if (!profile || !["admin", "coach"].includes(profile.rol)) {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/mis-reservas`, request.url)
        );
        response.cookies.getAll().forEach((cookie) => {
          redirect.cookies.set(cookie);
        });
        return redirect;
      }

      if (
        profile.rol === "coach" &&
        coachForbiddenAdminPaths.some((p) => pathWithoutLocale.startsWith(p))
      ) {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/admin/clases`, request.url)
        );
        response.cookies.getAll().forEach((cookie) => {
          redirect.cookies.set(cookie);
        });
        return redirect;
      }
    }
  } catch {
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
