import { NextRequest, NextResponse } from "next/server";
import { canAthleteManageClassScore } from "@/lib/clases/athlete-score";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ClaseScoreTipo } from "@/types/database";

const SCORE_WINDOW_ERROR = "SCORE_WINDOW_CLOSED";

async function requireSocioScores() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, rol, box_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.rol !== "socio") {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }

  if (!profile.box_id) {
    return {
      error: NextResponse.json(
        { error: "Perfil sin box asignado" },
        { status: 403 }
      ),
    };
  }

  return { supabase, profile };
}

type ScoreBody = {
  clase_id?: string;
  reserva_id?: string;
  score_display?: string;
  score_tipo?: ClaseScoreTipo;
  valor_numerico?: number | null;
  rx?: boolean;
  sin_score?: boolean;
  notas?: string | null;
  id?: string;
};

export async function POST(request: NextRequest) {
  const limited = rateLimitOrNull(request, "scores:upsert", 40);
  if (limited) return limited;

  const auth = await requireSocioScores();
  if ("error" in auth && auth.error) return auth.error;

  const { profile } = auth;
  const body = (await request.json()) as ScoreBody;
  const claseId = body.clase_id;
  const reservaId = body.reserva_id;

  if (!claseId || !reservaId) {
    return NextResponse.json(
      { error: "Faltan clase_id o reserva_id" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: reserva } = await admin
    .from("reservas")
    .select("id, usuario_id, clase_id, estado")
    .eq("id", reservaId)
    .maybeSingle();

  if (!reserva || reserva.usuario_id !== profile!.id || reserva.clase_id !== claseId) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const { data: clase } = await admin
    .from("clases")
    .select("id, fecha, hora_fin, box_id")
    .eq("id", claseId)
    .eq("box_id", profile!.box_id)
    .maybeSingle();

  if (!clase) {
    return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
  }

  const { data: boxRow } = await admin
    .from("boxes")
    .select("timezone")
    .eq("id", profile!.box_id)
    .maybeSingle();
  const timezone = boxRow?.timezone ?? "America/Mexico_City";

  if (
    !canAthleteManageClassScore({
      classDate: clase.fecha,
      classEndTime: clase.hora_fin,
      reservationStatus: reserva.estado,
      timezone,
    })
  ) {
    return NextResponse.json({ error: SCORE_WINDOW_ERROR }, { status: 403 });
  }

  const payload = {
    clase_id: claseId,
    usuario_id: profile!.id,
    reserva_id: reservaId,
    score_display: body.score_display ?? "—",
    score_tipo: body.score_tipo ?? "otro",
    valor_numerico: body.valor_numerico ?? null,
    rx: body.rx ?? true,
    sin_score: body.sin_score ?? false,
    notas: body.notas ?? null,
  };

  const { data: existing } = await admin
    .from("clase_scores")
    .select("id")
    .eq("clase_id", claseId)
    .eq("usuario_id", profile!.id)
    .maybeSingle();

  const result = existing
    ? await admin
        .from("clase_scores")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await admin
        .from("clase_scores")
        .insert(payload)
        .select("*")
        .single();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, score: result.data });
}
