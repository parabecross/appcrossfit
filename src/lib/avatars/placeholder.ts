/** Avatar URL: perfil real o placeholder SVG local (sin CORS, exportable a PNG). */

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function svgAvatarDataUrl(seed: string, name?: string): string {
  const h = hashSeed(seed);
  const hue = h % 360;
  const hue2 = (hue + 28) % 360;
  const initials = name?.trim()
    ? initialsFromName(name)
    : seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="hsl(${hue},58%,42%)"/><stop offset="100%" stop-color="hsl(${hue2},52%,32%)"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><text x="128" y="138" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="system-ui,-apple-system,sans-serif" font-size="88" font-weight="600">${initials}</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** true for data: URLs and same-origin paths — safe without CORS headers. */
export function isLocalAvatarUrl(url: string): boolean {
  if (url.startsWith("data:")) return true;
  if (url.startsWith("/")) return true;
  return false;
}

export function avatarUrlForAthlete(
  fotoUrl: string | null | undefined,
  seed: string,
  name?: string
): string {
  const trimmed = fotoUrl?.trim();
  if (trimmed && !trimmed.includes("i.pravatar.cc")) return trimmed;
  return svgAvatarDataUrl(seed, name);
}
