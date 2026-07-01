import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import ws from "ws";

/** Node scripts: Supabase always initializes Realtime; Node < 22 needs `ws` transport. */
export function createScriptSupabaseClient(
  url: string,
  key: string,
  options?: SupabaseClientOptions<"public">
): SupabaseClient {
  const nodeMajor = parseInt(
    process.versions.node.replace(/^v/, "").split(".")[0],
    10
  );

  const realtime =
    nodeMajor < 22
      ? {
          ...options?.realtime,
          transport: ws as unknown as typeof WebSocket,
        }
      : options?.realtime;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...options,
    realtime,
  });
}
