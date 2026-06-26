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
} from "@/components/ui/card";
import { AthronLogo } from "@/components/brand/athron-logo";

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
        <div className="mx-auto mb-3">
          <AthronLogo className="max-w-[180px]" />
        </div>
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
