import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/get-profile";
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

  return (
    <ProfileForm
      profile={profile}
      email={user?.email}
      variant={profile.rol === "coach" ? "coach" : "default"}
      subtitle={profile.rol === "coach" ? t("coachProfileDesc") : undefined}
    />
  );
}
