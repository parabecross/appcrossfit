/** Avatar URL: perfil real o placeholder estable por atleta (seed = id o email). */
export function avatarUrlForAthlete(
  fotoUrl: string | null | undefined,
  seed: string
): string {
  if (fotoUrl?.trim()) return fotoUrl;
  return `https://i.pravatar.cc/256?u=${encodeURIComponent(seed)}`;
}
