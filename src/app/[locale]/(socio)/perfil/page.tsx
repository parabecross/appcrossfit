import { createClient } from "@/lib/supabase/server";

import { requireRole } from "@/lib/auth/get-profile";
import { ProfileForm } from "@/components/socio/profile-form";

export const dynamic = "force-dynamic";

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <ProfileForm profile={profile} email={user?.email} />;
}
