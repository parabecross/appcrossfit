"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    const next = locale === "es" ? "en" : "es";
    router.replace(pathname, { locale: next });
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="gap-2">
      <Globe className="h-4 w-4" />
      {locale === "es" ? "EN" : "ES"}
    </Button>
  );
}
