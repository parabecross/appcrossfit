import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/get-profile";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { getBoxConfig } from "@/lib/box/config";
import { ProfileForm } from "@/components/socio/profile-form";

export const dynamic = "force-dynamic";

export default async function AdminMiPerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["admin", "coach", "box_admin"]);
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isCoach = profile.rol === "coach";
  const isBoxOwner = isAdminLikeRole(profile.rol);
  const boxConfig = isBoxOwner
    ? await getBoxConfig(profile.box_id)
    : null;

  return (
    <ProfileForm
      profile={profile}
      email={user?.email}
      variant={isCoach ? "coach" : isBoxOwner ? "box_owner" : "default"}
      subtitle={
        isCoach
          ? t("coachProfileDesc")
          : isBoxOwner
            ? t("boxOwnerProfileDesc")
            : undefined
      }
      boxLogoUrl={boxConfig?.logoUrl ?? null}
    />
  );
}
