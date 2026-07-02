# Checklist QA — Aislamiento multi-tenant ATHRON

Validación manual end-to-end entre **Parabellum Cross** y **QA Demo Box Beta**.

Complementa `npm run check-isolation` (26/26 RLS). Este documento cubre **UI y flujos reales**.

---

## 0. Preparación

### Automático (obligatorio antes de la matriz manual)

```bash
npm run check-isolation
# Esperado: 26/26 checks passed
```

### Datos QA en la base

```bash
ATHRON_QA_CONFIRM=true npm run seed-demo-boxes
```

Imprime credenciales en consola. Referencia de emails en `scripts/lib/qa-demo-boxes-constants.ts`.

**Password (todos los usuarios QA):** `QaDemo2026!`

### Super Admin (plataforma)

Usar tu cuenta super admin habitual (p. ej. `superadmin@athron.app`).

### Herramienta recomendada

Dos ventanas: normal + incógnito, para tener un admin de cada box logueado a la vez.

---

## 1. Credenciales QA

| Box | Rol | Email |
|-----|-----|-------|
| Parabellum | Admin | `qa-demo-parabellum-admin@athron.test` |
| Parabellum | Coach | `qa-demo-parabellum-coach@athron.test` |
| Parabellum | Socio 1 | `qa-demo-parabellum-socio1@athron.test` |
| Parabellum | Socio 2 | `qa-demo-parabellum-socio2@athron.test` |
| Parabellum | Socio 3 | `qa-demo-parabellum-socio3@athron.test` |
| Beta | Admin | `qa-demo-beta-admin@athron.test` |
| Beta | Coach | `qa-demo-beta-coach@athron.test` |
| Beta | Socio 1 | `qa-demo-beta-socio1@athron.test` |
| Beta | Socio 2 | `qa-demo-beta-socio2@athron.test` |
| Beta | Socio 3 | `qa-demo-beta-socio3@athron.test` |

Clases QA identificables por prefijo:

- Parabellum: `[QA-DEMO-PARABELLUM] …`
- Beta: `[QA-DEMO-BETA] …`

---

## 2. Matriz manual — marcar ✅ / ❌

### A) Super Admin — plataforma ATHRON

| # | Acción | Esperado | ✅ |
|---|--------|----------|---|
| A1 | `/admin-athron/dashboard` | Ve **Parabellum** y **QA Demo Box Beta** | |
| A2 | Detalle Parabellum | Carga métricas sin error | |
| A3 | Detalle Beta | Carga métricas sin error | |
| A4 | Conteo atletas Beta | ~3 (socios QA) | |
| A5 | Conteo atletas Parabellum | Incluye demo existente + socios QA | |

---

### B) Admin Parabellum — `qa-demo-parabellum-admin@athron.test`

| # | Ruta / módulo | Esperado | ❌ No debe aparecer |
|---|---------------|----------|---------------------|
| B1 | `/admin/dashboard` | KPIs solo de Parabellum | Datos de Beta |
| B2 | `/admin/usuarios` | Usuarios de Parabellum | Emails `qa-demo-beta-*` |
| B3 | `/admin/coaches` | Coaches de Parabellum | Coach Beta |
| B4 | `/admin/clases` | Clases Parabellum (incl. `[QA-DEMO-PARABELLUM]`) | Clases `[QA-DEMO-BETA]` |
| B5 | `/admin/actividad` | Reservas de socios Parabellum | Reservas Beta |
| B6 | `/admin/estadisticas` | Gráficas coherentes con Parabellum | Mezcla con Beta |
| B7 | `/admin/rendimiento` | Solo rendimiento Parabellum | — |
| B8 | `/admin/ranking` | Ranking Parabellum | Ranking Beta |
| B9 | `/admin/planes` | Planes `box_id` Parabellum (incl. plan QA) | Plan `[QA-DEMO-BETA]` |

---

### C) Admin Beta — `qa-demo-beta-admin@athron.test`

Repetir **B1–B9** con criterio inverso: **solo Beta**, nunca Parabellum.

| # | Extra Beta | Esperado | ✅ |
|---|------------|----------|---|
| C1 | Plan SaaS / features | Ranking y estadísticas disponibles (Pro+) | |
| C2 | Usuarios | 3 socios QA + admin + coach Beta | |

---

### D) Coach Parabellum — `qa-demo-parabellum-coach@athron.test`

| # | Acción | Esperado | ✅ |
|---|--------|----------|---|
| D1 | `/admin/clases` | Ve clases asignadas a él (QA Parabellum) | |
| D2 | Editar entrenamiento de su clase | Guarda OK | |
| D3 | No ve clases Beta | — | |

---

### E) Coach Beta — `qa-demo-beta-coach@athron.test`

Igual que D1–D3, solo box Beta.

---

### F) Socio Parabellum — `qa-demo-parabellum-socio1@athron.test`

| # | Ruta | Esperado | ✅ |
|---|------|----------|---|
| F1 | Home / reservas | Calendario con clases Parabellum | |
| F2 | Reservar clase `[QA-DEMO-PARABELLUM]` futura | Confirmación OK | |
| F3 | Mis reservas | Solo reservas propias Parabellum | |
| F4 | Ranking (si visible) | Ranking de Parabellum | |
| F5 | No hay clases `[QA-DEMO-BETA]` | — | |

---

### G) Socio Beta — `qa-demo-beta-socio1@athron.test`

Repetir F1–F5 solo para Beta.

---

### H) Prueba de choque en paralelo (2 ventanas)

Con **admin Parabellum** (ventana 1) y **admin Beta** (ventana 2) abiertos:

| # | Acción simultánea | Esperado | ✅ |
|---|-------------------|----------|---|
| H1 | Ambos abren `/admin/clases` | Listas distintas, sin solapamiento de prefijos | |
| H2 | Ambos abren `/admin/usuarios` | Listas distintas | |
| H3 | Admin Parabellum crea/edita clase QA | Solo visible en Parabellum | |
| H4 | Admin Beta crea/edita clase QA | Solo visible en Beta | |

---

### I) Clase sin coach (regresión `box_id`)

Como **admin Parabellum**:

| # | Acción | Esperado | ✅ |
|---|--------|----------|---|
| I1 | Crear clase **sin coach** | Se crea en Parabellum | |
| I2 | Login **admin Beta** → buscar esa clase | No aparece | |
| I3 | Borrar clase QA sin coach | Solo admin Parabellum puede | |

---

## 3. Limpieza post-QA (opcional)

Borra **solo** datos QA; Parabellum demo real queda intacto:

```bash
ATHRON_QA_CONFIRM=true npm run teardown-demo-boxes
```

Volver a sembrar:

```bash
ATHRON_QA_CONFIRM=true npm run seed-demo-boxes
```

---

## 4. Señales de fallo (qué investigar)

| Síntoma | Posible causa |
|---------|----------------|
| Admin ve usuarios del otro box | Query sin `box_id` o RLS profiles |
| Socio ve clases ajenas | `clases.box_id` / `clases_select_authenticated` |
| Reserva cross-box posible | `reservas_insert_own` o API `/api/reservas` |
| Estadísticas mezcladas | `src/lib/queries/stats.ts` |
| Clase sin coach editable por otro admin | `clases.box_id` / `clases_admin_all` |
| Super Admin no ve un box | Suscripción / status del box |

---

## 5. Comandos de referencia

```bash
# RLS automatizado
npm run check-isolation

# Seed / teardown QA
ATHRON_QA_CONFIRM=true npm run seed-demo-boxes
ATHRON_QA_CONFIRM=true npm run teardown-demo-boxes

# CI local
npm run lint && npx tsc --noEmit && npm run test
```

---

## 6. Registro de ejecución

| Fecha | Ejecutor | check-isolation | Manual A–I | Notas |
|-------|----------|-----------------|------------|-------|
| | | /26 | / | |
