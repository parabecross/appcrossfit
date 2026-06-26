"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_CONFIG } from "@/lib/config/app-config";

export function BoxInactivoClient({ boxName }: { boxName?: string }) {
  const t = useTranslations("boxInactive");
  const ta = useTranslations("auth");
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <Card className="w-full max-w-md glow-primary">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-black uppercase tracking-wide brand-text">
          {APP_CONFIG.BRAND_NAME}
        </CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          {boxName ? t("messageWithBox", { box: boxName }) : t("message")}
        </p>
        <Button type="button" variant="outline" className="w-full" onClick={logout}>
          {ta("logout")}
        </Button>
      </CardContent>
    </Card>
  );
}
