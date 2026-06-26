import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/get-profile";
import { ProfileForm } from "@/components/socio/profile-form";

export default async function AdminMiPerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["admin", "coach", "box_admin"]);
  const t = await getTranslations("admin");

  return (
    <ProfileForm
      profile={profile}
      variant={profile.rol === "coach" ? "coach" : "default"}
      subtitle={profile.rol === "coach" ? t("coachProfileDesc") : undefined}
    />
  );
}
