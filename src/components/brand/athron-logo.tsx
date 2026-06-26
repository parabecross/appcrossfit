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
      src="/athron-logo.jpg"
      alt="ATHRON — Train. Track. Progress."
      width={320}
      height={320}
      priority={priority}
      className={cn("h-auto w-full max-w-[220px] mx-auto object-contain", className)}
    />
  );
}
