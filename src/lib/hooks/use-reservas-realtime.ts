"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Reserva } from "@/types/database";

export type ReservaWithProfile = Reserva & { profile: Profile | null };

const RESERVAS_REALTIME_SELECT =
  "id, clase_id, estado, profile:profiles!reservas_usuario_id_fkey(nombre_completo)";

export function useReservasRealtime(
  claseIds: string[],
  onUpdate: (reservas: ReservaWithProfile[]) => void
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const claseIdKey = claseIds.slice().sort().join(",");

  useEffect(() => {
    if (!claseIdKey) return;

    const idSet = new Set(claseIds);
    const supabase = createClient();
    let cancelled = false;

    const refetch = async () => {
      const { data, error } = await supabase
        .from("reservas")
        .select(RESERVAS_REALTIME_SELECT)
        .in("clase_id", claseIds);

      if (!cancelled && !error && data) {
        const normalized = data.map((row) => {
          const profile = row.profile;
          const normalizedProfile = Array.isArray(profile)
            ? profile[0] ?? null
            : profile ?? null;
          return {
            ...row,
            profile: normalizedProfile,
          };
        });
        onUpdateRef.current(normalized as ReservaWithProfile[]);
      }
    };

    const channel = supabase
      .channel(`reservas:${claseIdKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas" },
        (payload) => {
          const row = (payload.new ?? payload.old) as Reserva | undefined;
          if (row?.clase_id && idSet.has(row.clase_id)) {
            void refetch();
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [claseIdKey, claseIds]);
}