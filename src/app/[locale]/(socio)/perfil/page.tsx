import { requireRole } from "@/lib/auth/get-profile";
import { ProfileForm } from "@/components/socio/profile-form";

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  return <ProfileForm profile={profile} />;
}
