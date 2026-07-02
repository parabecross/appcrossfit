import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";
import { canAccessAdminArea, isAdminLikeRole } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database";

const intlMiddleware = createIntlMiddleware(routing);

const publicPaths = ["/login", "/registro", "/box-inactivo", "/ranking"];

const coachForbiddenAdminPaths = [
  "/admin/dashboard",
  "/admin/usuarios",
  "/admin/coaches",
  "/admin/planes",
  "/admin/estadisticas",
  "/admin/rendimiento",
  "/admin/actividad",
];

type SessionProfile = {
  rol: UserRole;
  box_id: string;
  is_super_admin: boolean;
};

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

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}

async function getSessionProfile(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<SessionProfile | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("rol, box_id, is_super_admin")
    .eq("user_id", userId)
    .single();

  return profile;
}

async function enforceActiveBox(
  supabase: ReturnType<typeof createServerClient>,
  profile: SessionProfile,
  pathWithoutLocale: string,
  locale: string,
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse | null> {
  if (profile.is_super_admin) return null;
  if (pathWithoutLocale.startsWith("/box-inactivo")) return null;

  const { data: box } = await supabase
    .from("boxes")
    .select("status")
    .eq("id", profile.box_id)
    .single();

  if (box?.status !== "active") {
    const redirect = NextResponse.redirect(
      new URL(`/${locale}/box-inactivo`, request.url)
    );
    copyCookies(response, redirect);
    return redirect;
  }

  return null;
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
      copyCookies(response, redirect);
      return redirect;
    }

    let profile: SessionProfile | null = null;

    if (user) {
      profile = await getSessionProfile(supabase, user.id);

      if (profile && !isPublic && pathWithoutLocale !== "/") {
        const isAthronAdmin = pathWithoutLocale.startsWith("/admin-athron");
        const inactiveRedirect = isAthronAdmin
          ? null
          : await enforceActiveBox(
              supabase,
              profile,
              pathWithoutLocale,
              locale,
              request,
              response
            );
        if (inactiveRedirect) return inactiveRedirect;
      }
    }

    if (pathWithoutLocale.startsWith("/admin-athron")) {
      if (!user) {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/login`, request.url)
        );
        copyCookies(response, redirect);
        return redirect;
      }

      if (!profile) {
        profile = await getSessionProfile(supabase, user.id);
      }

      if (!profile?.is_super_admin) {
        let dest = `/${locale}/mis-reservas`;
        if (isAdminLikeRole(profile?.rol ?? "socio")) {
          dest = `/${locale}/admin/dashboard`;
        }
        if (profile?.rol === "coach") dest = `/${locale}/admin/clases`;
        const redirect = NextResponse.redirect(new URL(dest, request.url));
        copyCookies(response, redirect);
        return redirect;
      }

      return response;
    }

    if (
      user &&
      profile &&
      (pathWithoutLocale === "/login" ||
        pathWithoutLocale === "/registro" ||
        pathWithoutLocale === "/")
    ) {
      let dest = `/${locale}/mis-reservas`;
      if (profile.is_super_admin) {
        dest = `/${locale}/admin-athron/dashboard`;
      } else if (isAdminLikeRole(profile.rol)) {
        dest = `/${locale}/admin/dashboard`;
      } else if (profile.rol === "coach") {
        dest = `/${locale}/admin/clases`;
      }

      if (!profile.is_super_admin) {
        const { data: box } = await supabase
          .from("boxes")
          .select("status")
          .eq("id", profile.box_id)
          .single();
        if (box?.status !== "active") {
          dest = `/${locale}/box-inactivo`;
        }
      }

      const redirect = NextResponse.redirect(new URL(dest, request.url));
      copyCookies(response, redirect);
      return redirect;
    }

    if (pathWithoutLocale.startsWith("/admin")) {
      if (!user) {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/login`, request.url)
        );
        copyCookies(response, redirect);
        return redirect;
      }

      if (!profile) {
        profile = await getSessionProfile(supabase, user.id);
      }

      if (!profile || !canAccessAdminArea(profile.rol)) {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/mis-reservas`, request.url)
        );
        copyCookies(response, redirect);
        return redirect;
      }

      if (
        profile.rol === "coach" &&
        coachForbiddenAdminPaths.some((p) => pathWithoutLocale.startsWith(p))
      ) {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/admin/clases`, request.url)
        );
        copyCookies(response, redirect);
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
