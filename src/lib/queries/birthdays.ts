import { todayInTimezone } from "@/lib/dates/date-only";
import {
  getBirthdayWindow,
  type BirthdayWindow,
} from "@/lib/birthdays/helpers";
import { calculateAge } from "@/lib/legacy/build-athlete-card";
import { createClient } from "@/lib/supabase/server";

export interface BirthdayAlert {
  profileId: string;
  nombre: string;
  window: BirthdayWindow;
  age: number | null;
}

const WINDOW_ORDER: Record<BirthdayWindow, number> = {
  today: 0,
  tomorrow: 1,
  yesterday: 2,
};

function ageForBirthdayWindow(
  fechaNacimiento: string,
  window: BirthdayWindow
): number | null {
  const base = calculateAge(fechaNacimiento);
  if (base === null) return null;
  if (window === "tomorrow") return base + 1;
  return base;
}

export async function getOwnBirthdayToday(
  profileId: string,
  timeZone: string
): Promise<{ isToday: boolean; age: number | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("atleta_perfil_deportivo")
      .select("fecha_nacimiento")
      .eq("usuario_id", profileId)
      .maybeSingle();

    if (error) {
      console.error("getOwnBirthdayToday:", error.message);
      return { isToday: false, age: null };
    }

    const fechaNacimiento = data?.fecha_nacimiento ?? null;
    if (!fechaNacimiento) {
      return { isToday: false, age: null };
    }

    const today = todayInTimezone(timeZone);
    const window = getBirthdayWindow(fechaNacimiento, today);
    const isToday = window === "today";

    return {
      isToday,
      age: isToday ? calculateAge(fechaNacimiento) : null,
    };
  } catch (err) {
    console.error("getOwnBirthdayToday:", err);
    return { isToday: false, age: null };
  }
}

export function computeBirthdayAlertsFromSocios(
  socios: Array<{ id: string; nombre_completo: string }>,
  perfiles: Array<{ usuario_id: string; fecha_nacimiento: string | null }>,
  timeZone: string
): BirthdayAlert[] {
  const today = todayInTimezone(timeZone);

  const fechaByUsuario = new Map<string, string>();
  for (const row of perfiles) {
    if (row.fecha_nacimiento) {
      fechaByUsuario.set(row.usuario_id, row.fecha_nacimiento);
    }
  }

  const alerts: BirthdayAlert[] = [];

  for (const socio of socios) {
    const fechaNacimiento = fechaByUsuario.get(socio.id);
    if (!fechaNacimiento) continue;

    const window = getBirthdayWindow(fechaNacimiento, today);
    if (!window) continue;

    alerts.push({
      profileId: socio.id,
      nombre: socio.nombre_completo,
      window,
      age: ageForBirthdayWindow(fechaNacimiento, window),
    });
  }

  alerts.sort((a, b) => {
    const byWindow = WINDOW_ORDER[a.window] - WINDOW_ORDER[b.window];
    if (byWindow !== 0) return byWindow;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return alerts;
}

export async function getBirthdayAlerts(
  boxId: string,
  timeZone: string
): Promise<BirthdayAlert[]> {
  try {
    const supabase = await createClient();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nombre_completo")
      .eq("box_id", boxId)
      .eq("rol", "socio")
      .order("nombre_completo");

    if (profilesError) {
      console.error("getBirthdayAlerts profiles:", profilesError.message);
      return [];
    }

    const socios = profiles ?? [];
    if (socios.length === 0) return [];

    const usuarioIds = socios.map((p) => p.id);
    const { data: perfiles, error: perfilesError } = await supabase
      .from("atleta_perfil_deportivo")
      .select("usuario_id, fecha_nacimiento")
      .in("usuario_id", usuarioIds);

    if (perfilesError) {
      console.error("getBirthdayAlerts perfiles:", perfilesError.message);
      return [];
    }

    return computeBirthdayAlertsFromSocios(socios, perfiles ?? [], timeZone);
  } catch (err) {
    console.error("getBirthdayAlerts:", err);
    return [];
  }
}
