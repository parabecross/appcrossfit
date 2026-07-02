# E2E — Aislamiento Parabellum ↔ Iron District

Validación de que **Parabellum Cross** (`parabellum-cross`) e **Iron District Box** (`iron-district-box`) no mezclan datos.

**Playwright:** no instalado en el proyecto. Este documento + script Node cubren automatización sin dependencias nuevas.

---

## 0. Preparación

### Reset demo (recomendado)

```bash
ATHRON_QA_CONFIRM=true npm run reset-two-demo-boxes
```

Password de **todos** los usuarios demo: `Athron2026!`

### RLS base

```bash
npm run check-isolation
# Esperado: 26/26
```

### Automatizado (API + RLS + ranking HTTP)

```bash
npm run e2e-two-boxes
```

Con ranking público vía HTTP (requiere app levantada):

```bash
npm run dev
# otra terminal:
E2E_BASE_URL=http://localhost:3000 npm run e2e-two-boxes
```

Producción:

```bash
E2E_BASE_URL=https://app.athron.mx npm run e2e-two-boxes
```

---

## 1. Credenciales demo

| Box | Rol | Email | Nombre visible |
|-----|-----|-------|----------------|
| Parabellum | Admin | `parabellum.admin@athron.test` | Roberto Mendoza |
| Parabellum | Coach | `parabellum.coach1@athron.test` | Alejandro Vega |
| Parabellum | Socio 1 | `parabellum.socio1@athron.test` | Lucía Herrera |
| Iron | Admin | `iron.admin@athron.test` | Carolina Navarro |
| Iron | Coach | `iron.coach1@athron.test` | Miguel Torres |
| Iron | Socio 1 | `iron.socio1@athron.test` | Emilio Vargas |

**Marcadores de clases** (nombres exactos del seed):

| Box | Ejemplos de clase |
|-----|-------------------|
| Parabellum | `Fuerza Parabellum`, `Conditioning Parabellum`, … |
| Iron | `Strength Iron`, `Conditioning Iron`, … |

Usa **dos ventanas** (normal + incógnito) para comparar admins de cada box.

---

## 2. Matriz manual — marcar ✅ / ❌

### 1. Admin Parabellum — `parabellum.admin@athron.test`

| # | Ruta | Esperado | ❌ No debe aparecer | Causa probable si falla |
|---|------|----------|---------------------|-------------------------|
| P1 | `/es/admin/usuarios` | Socios Parabellum (Lucía, Sofía, …) | Carolina Navarro, Emilio Vargas, emails `iron.*` | RLS `profiles` · `box_id` incorrecto |
| P2 | `/es/admin/clases` | Clases con «Parabellum» | `Strength Iron`, `Engine Iron`, … | RLS `clases` · query sin `box_id` |
| P3 | `/es/admin/ranking` | Ranking solo atletas Parabellum | Nombres Iron District | `getAthronRankingForBox` · slug/box_id |

### 2. Admin Iron — `iron.admin@athron.test`

| # | Ruta | Esperado | ❌ No debe aparecer | Causa probable si falla |
|---|------|----------|---------------------|-------------------------|
| I1 | `/es/admin/usuarios` | Socios Iron (Emilio, Gabriela, …) | Roberto Mendoza, Lucía Herrera, `parabellum.*` | RLS `profiles` |
| I2 | `/es/admin/clases` | Clases con « Iron» | `Fuerza Parabellum`, … | RLS `clases` |
| I3 | `/es/admin/ranking` | Ranking solo Iron | Nombres Parabellum | aggregate por box |

### 3. Socio Parabellum — `parabellum.socio1@athron.test`

| # | Ruta / acción | Esperado | Causa probable si falla |
|---|---------------|----------|-------------------------|
| S1 | `/es/mis-reservas` | Calendario con clases «Parabellum» | RLS clases socio |
| S2 | Reservar clase Parabellum futura | Botón reservar → confirmada | Trigger cupo/timing · API `/api/reservas` |
| S3 | Buscar «Iron» en calendario | **0** clases Iron | Filtrado `box_id` en query |

### 4. Socio Iron — `iron.socio1@athron.test`

| # | Ruta / acción | Esperado | Causa probable si falla |
|---|---------------|----------|-------------------------|
| S4 | `/es/mis-reservas` | Solo clases « Iron» | RLS clases |
| S5 | Reservar clase Iron | Confirmada | Igual que S2 |
| S6 | No ver Parabellum | Sin «Parabellum» en UI | RLS |

### 5. Ranking público

| # | URL | Esperado | Causa probable si falla |
|---|-----|----------|-------------------------|
| R1 | `/es/ranking` | «Ranking no disponible… debe incluir ?box=…» | `ranking/page.tsx` sin `box` param |
| R2 | `/es/ranking?box=parabellum-cross` | Atletas Parabellum | `getPublicRankingAccess` · slug |
| R3 | `/es/ranking?box=iron-district-box` | Atletas Iron | Idem |
| R4 | R2 no muestra Iron | Sin Emilio Vargas / Carolina | `ranking_point_events.box_id` |
| R5 | R3 no muestra Parabellum | Sin Lucía Herrera | Idem |

### 6. Asistencia / ranking / cupo (manual en `/es/admin/clases`)

| # | Acción | Esperado | Causa probable si falla |
|---|--------|----------|-------------------------|
| A1 | Marcar **Asistió** | Puntos sumados en ranking del atleta | `awardAttendance` · `ranking_config.enabled` |
| A2 | Cambiar a **No asistió** | Puntos revocados | `revokeAttendanceRanking` |
| A3 | Clase con cupo lleno + `no_asistio` | Cupo sigue ocupado (barra no baja) | RPC/trigger sin `no_asistio` |
| A4 | Socio **cancela** reserva | Cupo baja + otro puede reservar | `ACTIVE_RESERVA_ESTADOS` · trigger |

### 7. Dashboard admin

| # | Usuario | Ruta | Esperado | Causa probable si falla |
|---|---------|------|----------|-------------------------|
| D1 | Parabellum admin | `/es/admin/dashboard` | KPIs, clases hoy, alertas solo Parabellum | `getClasesByDateRange` · profiles scope |
| D2 | Iron admin | `/es/admin/dashboard` | Solo Iron | Idem |

---

## 3. Qué automatiza `npm run e2e-two-boxes`

| Área | Cobertura |
|------|-----------|
| Admin usuarios/clases/ranking | Queries RLS con login real |
| Socio clases + reserva | SELECT clases + INSERT reserva |
| Ranking público | HTTP a `/es/ranking` (si `E2E_BASE_URL` responde) |
| Dashboard KPIs | Perfiles socio + clases hoy vía RLS |
| Cupo | RPC `clases_cupo_ocupado` vs conteo manual 3 estados |
| Asistencia ranking | `asistio` → award → `no_asistio` → revoke (revierte a confirmada) |

**Solo manual:** validación visual UI, cupo en barra de progreso, flujo completo cancelar desde socio.

---

## 4. Resultados esperados

```text
npm run check-isolation     → 26/26 checks passed
npm run e2e-two-boxes       → N/N checks passed (típico ~15–18)
```

Si ranking HTTP falla con «SKIP — servidor no disponible», levanta `npm run dev` y re-ejecuta.

---

## 5. Si algo falla

| Síntoma | Usuario | Ruta | Causa probable |
|---------|---------|------|----------------|
| Ve usuarios del otro box | admin del box A | `/admin/usuarios` | RLS `profiles` · `box_id` en JWT/session |
| Ve clases ajenas | admin/socio | `/admin/clases`, `/mis-reservas` | RLS `clases` |
| Ranking mezclado | público | `/ranking?box=…` | eventos sin `box_id` o slug incorrecto |
| Reserva cross-box | socio | `/mis-reservas` | trigger timing o RLS insert |
| Cupo no cuenta no-show | admin/socio | barra cupo | patch SQL cupo no aplicado |
| Ranking sin puntos asistencia | admin | marcar asistencia | plan sin feature `ranking` o config disabled |

---

## 6. Archivos relacionados

| Archivo | Propósito |
|---------|-----------|
| `scripts/e2e-two-box-isolation.ts` | Runner automatizado |
| `scripts/lib/two-demo-boxes-constants.ts` | Emails y marcadores |
| `scripts/reset-two-demo-boxes.ts` | Seed demo Parabellum + Iron |
| `scripts/check-box-isolation.ts` | RLS sintético Test Box A/B |
| `docs/QA-CHECKLIST.md` | QA Parabellum vs Beta (otro par de boxes) |
