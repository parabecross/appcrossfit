import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const profilePhotoFrameClass =
  "relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-black/30 shadow-[0_12px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/10";

export const profilePhotoImageClass =
  "h-full w-full object-cover object-top";

export function ProfilePhotoFrame({
  className,
  aspectClassName = "aspect-[4/5]",
  children,
}: {
  className?: string;
  aspectClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(profilePhotoFrameClass, aspectClassName, className)}>
      {children}
    </div>
  );
}
