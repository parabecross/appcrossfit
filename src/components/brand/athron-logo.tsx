import Image from "next/image";
import { cn } from "@/lib/utils";

export function AthronLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/athron-logo.png"
      alt="ATHRON — Train. Track. Progress."
      width={320}
      height={320}
      priority={priority}
      unoptimized
      className={cn(
        "h-auto w-full max-w-[240px] mx-auto object-contain drop-shadow-[0_0_24px_rgba(234,88,12,0.15)]",
        className
      )}
    />
  );
}
