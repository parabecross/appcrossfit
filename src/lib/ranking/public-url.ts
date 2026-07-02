/** URL pública del ranking scoped al box (slug en query ?box=). */
export function buildPublicRankingUrl(params: {
  locale: string;
  boxSlug: string;
  category?: string;
  host?: string | null;
  proto?: string | null;
}): string {
  const qs = new URLSearchParams();
  qs.set("box", params.boxSlug);
  if (params.category) qs.set("category", params.category);

  const path = `/${params.locale}/ranking?${qs.toString()}`;

  if (params.host) {
    const proto = params.proto?.replace(/:$/, "") || "https";
    return `${proto}://${params.host}${path}`;
  }

  return path;
}

export function buildPublicRankingPreviewPath(params: {
  boxSlug: string;
  category?: string;
}): string {
  const qs = new URLSearchParams();
  qs.set("box", params.boxSlug);
  if (params.category) qs.set("category", params.category);
  return `/ranking?${qs.toString()}`;
}
