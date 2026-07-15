import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit/log";
import { createAthleteInteraction } from "@/lib/queries/seguimientos";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const limited = rateLimitOrNull(request, "admin:seguimientos", 40);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await createAthleteInteraction({
    usuarioId: String(body.usuario_id ?? ""),
    tipoInteraccion: body.tipo_interaccion as never,
    resultado: body.resultado as never,
    nota: (body.nota as string | null | undefined) ?? null,
    occurredAt: (body.occurred_at as string | null | undefined) ?? null,
    requiresFollowUp: Boolean(body.requires_follow_up),
    followUpAt: (body.follow_up_at as string | null | undefined) ?? null,
  });

  if (!result.ok) {
    const messages: Record<string, string> = {
      unauthorized: "Unauthorized",
      forbidden: "Forbidden",
      athlete_not_found: "Atleta no encontrado en este box",
      missing_athlete: "Atleta requerido",
      invalid_type: "Tipo de interacción inválido",
      invalid_outcome: "Resultado inválido",
      note_too_long: "La nota supera el máximo permitido",
      invalid_occurred_at: "Fecha de contacto inválida",
      invalid_follow_up_at: "Fecha de seguimiento inválida",
      follow_up_required: "Indica la fecha de seguimiento",
      table_missing:
        "La bitácora aún no está disponible. Aplica la migración de seguimientos.",
      create_failed: "No se pudo guardar el seguimiento",
    };
    return NextResponse.json(
      { error: messages[result.error] ?? result.error },
      { status: result.status }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await logAdminAction({
    actorUserId: user?.id ?? result.item.autor_id,
    actorProfileId: result.item.autor_id,
    boxId: result.item.box_id,
    accion: "seguimiento.create",
    targetProfileId: result.item.usuario_id,
    detalle: {
      tipo: result.item.tipo_interaccion,
      resultado: result.item.resultado,
      id: result.item.id,
    },
  });

  return NextResponse.json({ ok: true, item: result.item });
}
