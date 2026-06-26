import { getProfile } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { BoxInactivoClient } from "@/components/auth/box-inactivo-client";

export default async function BoxInactivoPage() {
  const profile = await getProfile();
  const boxConfig = await getBoxConfig(profile?.box_id);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-950/20 via-background to-background">
      <BoxInactivoClient boxName={boxConfig.name} />
    </div>
  );
}
