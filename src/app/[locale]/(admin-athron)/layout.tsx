import { requireSuperAdmin } from "@/lib/auth/get-profile";
import {
  AthronAdminSidebar,
  AthronAdminMobileHeader,
} from "@/components/layout/athron-admin-nav";

export default async function AthronAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireSuperAdmin(locale);

  return (
    <div className="flex min-h-screen mobile-page w-full overflow-x-hidden">
      <AthronAdminSidebar />
      <div className="flex flex-1 flex-col min-h-screen min-w-0 w-full">
        <AthronAdminMobileHeader />
        <main className="flex-1 w-full px-4 py-4 md:p-8 md:max-w-7xl md:mx-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
