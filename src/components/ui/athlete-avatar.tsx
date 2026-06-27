import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarUrlForAthlete } from "@/lib/avatars/placeholder";
import { cn } from "@/lib/utils";

export function AthleteAvatar({
  fotoUrl,
  seed,
  name,
  className,
}: {
  fotoUrl?: string | null;
  seed: string;
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Avatar className={cn(className)}>
      <AvatarImage
        src={avatarUrlForAthlete(fotoUrl, seed, name)}
        alt={name}
      />
      <AvatarFallback>{initials || "?"}</AvatarFallback>
    </Avatar>
  );
}
