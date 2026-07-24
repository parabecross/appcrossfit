# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Este archivo está escrito para reflejar la forma exacta en que el owner de este proyecto quiere trabajar. No son sugerencias: son reglas de operación de este repositorio.

## Proyecto

**ATHRON** — SaaS multi-tenant para boxes de CrossFit / entrenamiento funcional. Next.js 15 (App Router) + TypeScript, Supabase (Auth, Postgres, Storage, RLS), Tailwind + componentes estilo shadcn/ui, next-intl (`es`/`en`, `es` default). El dominio del negocio está en español (`box`, `socio`, `atleta`, `cupo`, `reserva`, `entrenamiento`, `seguimiento` son términos de negocio, no errores de nomenclatura).

---

## Reglas obligatorias (no negociables)

1. **Nunca hacer `commit`, `push`, `merge`, `rebase`, deploy o crear PRs sin autorización explícita del owner en ese momento**, aunque el trabajo esté terminado y verificado. Una autorización pasada no cubre cambios futuros. Deja los cambios listos para revisión (`git status` / `git diff`) y pregunta antes de cualquiera de estas acciones. Todos los cambios de código permanecen únicamente en el working tree hasta nueva orden.
2. **Nunca hacer deploy** (Vercel u otro) ni disparar acciones que lo activen (incluyendo pushes a ramas con deploy automático) sin autorización explícita.
3. **Nunca modificar variables de entorno** (`.env.local`, `.env.example`, secrets de Vercel/GitHub Actions) sin autorización explícita. Si un cambio requiere una nueva env var, indícalo y pide confirmación antes de tocar archivos de entorno.
4. **Nunca cambiar el esquema de la base de datos** (tablas, columnas, políticas RLS, funciones/triggers en `supabase/`) sin explicar antes: qué cambia, por qué, y qué migración/patch se crearía. Ninguna migración se aplica a la BD real sin visto bueno explícito — este repo no tiene runner de migraciones, los `.sql` se aplican manualmente.
5. **Arquitectura antes que código**: para cualquier cambio no trivial, razona primero el diseño (dónde vive la lógica, qué capa la posee, impacto en RLS/multi-tenancy) y después escribe la implementación. No empieces por el código.
6. **UX premium antes que nuevas funcionalidades**: si hay que elegir entre agregar una feature nueva o pulir la experiencia existente (consistencia visual, estados de carga, vacíos, error states, responsividad, feel de la interacción), prioriza pulir. Este es un producto donde la percepción de calidad importa tanto como la función.
7. **Compatibilidad con Next.js 15** (App Router, Server Components por defecto, Route Handlers, `next-intl` middleware): no introducir patrones de Pages Router ni asumir comportamiento de versiones anteriores.
8. **Compatibilidad con Supabase y RLS**: cualquier query nueva debe asumir que RLS es la barrera real de seguridad. Si se usa el cliente `service_role` (`src/lib/supabase/admin.ts`), el scoping por `box_id` debe hacerse a mano porque RLS no aplica.
9. **No romper funcionalidades existentes.** Antes de tocar un módulo compartido, ubica quién más lo usa (buscar imports/usages) y considera el impacto en los demás roles (`socio`, `coach`, `admin`/`box_admin`, super admin) y boxes.
10. **Reutilizar componentes antes de crear nuevos.** Revisar `src/components/ui/` (primitives estilo shadcn) y las carpetas de dominio en `src/components/` (`admin/`, `socio/`, `ranking/`, `legacy/`, `layout/`, etc.) antes de escribir un componente nuevo. Si algo parecido ya existe, extenderlo o generalizarlo en vez de duplicarlo.
11. **Consistencia visual en toda la app**: respetar el sistema de diseño existente (ver sección "Sistema de diseño / UX" abajo) — tokens de color en `globals.css`, utilidades `brand-gradient`/`brand-text`/`glass-card`/`glow-primary`, `cn()` de `src/lib/utils.ts` para componer clases, radios/espaciados ya definidos. No introducir un color, sombra o radio "de una sola vez" fuera del sistema.
12. **Evitar código duplicado**: antes de escribir una función auxiliar, revisar si ya existe algo equivalente en el dominio correspondiente dentro de `src/lib/` (organizado por dominio: `reservas`, `ranking`, `clases`, `membresias`, `progreso`, `retention`, `reporte-semanal`, etc.).
13. **Alto rendimiento**: evitar N+1 queries a Supabase, preferir queries acotadas por `box_id` con los índices/RLS existentes, cuidar tamaño de payloads en Server Components y rutas API, evitar recomputar entitlements o datos costosos cuando ya hay un valor disponible en el contexto de la request.
14. **Código limpio y mantenible**: seguir el estilo ya presente (TypeScript estricto, sin `any` innecesarios, nombres de dominio en español consistentes con el resto del código, sin comentarios que expliquen lo obvio).
15. **No inventar información.** Si algo no está verificado leyendo el código/config real del repo, decirlo explícitamente en vez de asumirlo. Si hay duda sobre el enfoque correcto, preguntar antes de implementar.

---

## Política de trabajo permanente

Esta es la política de operación fija para este repositorio, no una sugerencia por tarea.

### Antes de implementar cualquier cambio

1. **Analiza la arquitectura completa** relevante al cambio (no solo el archivo a tocar: quién más consume ese módulo, impacto en RLS/multi-tenancy, entitlements, roles).
2. **Explica el diagnóstico** — qué está pasando hoy / qué se pide, en términos concretos (archivos, funciones, comportamiento observado).
3. **Explica la causa exacta** — la razón raíz, no un síntoma. Si es una feature nueva, cuál es el gap exacto que se llena.
4. **Propón la solución** — plan concreto de implementación y archivos afectados (incluyendo migraciones SQL nuevas si aplica).
5. **Espera autorización explícita si el cambio afecta**: configuración del proyecto (`package.json`, configs de build/lint/CI), base de datos o RLS, migraciones, variables de entorno, o infraestructura/deploy. Para estos casos, no se implementa hasta recibir el "sí" explícito — presentar 1-4 no es suficiente autorización por sí solo.

Para cambios triviales dentro de un único archivo sin tocar config/BD/env/infra, este análisis puede ser breve, pero los pasos 1-4 siempre se presentan antes de escribir código.

### Durante la implementación

- No romper funcionalidad existente — verificar impacto en otros roles/boxes antes de tocar código compartido.
- Reutilizar componentes antes de crear nuevos.
- Mantener consistencia visual (sistema de diseño en la sección correspondiente).
- Respetar la arquitectura existente (tenancy, RLS, patrón de rutas API, entitlements, i18n).
- No inventar información — verificar contra el repo real, no asumir.
- Si hay dudas, preguntar antes de decidir por cuenta propia.

### Antes de dar un trabajo por terminado

**Si el cambio toca código ejecutable** (rutas API, componentes, lógica de negocio, middleware, Supabase, configuración funcional):

1. Ejecutar `npm run test:ci`.
2. Si pasa, ejecutar `npm run build`.
3. Solo entonces se considera terminado el trabajo.

Si cualquiera de los dos falla, el trabajo **no** está terminado: se corrige antes de reportar, o se explica explícitamente por qué falla y qué falta.

**Si el cambio es únicamente documentación** (README, `CLAUDE.md`, comentarios, archivos Markdown): decirlo explícitamente y explicar por qué no aplica correr tests ni build (no hay código ejecutable, rutas, lógica o configuración funcional involucrada). No ejecutar `test:ci`/`build` en ese caso — sería una verificación sin objeto real que verificar.

### Formato de entrega final

Al finalizar, entregar siempre exactamente este formato:

```
A. Diagnóstico.
B. Causa exacta.
C. Archivos modificados.
D. Cambios realizados.
E. Verificación.
F. Tests ejecutados.
G. Build ejecutado.
H. Riesgos restantes.
```

### Autorización

**Nunca hacer `commit`, `push`, `deploy`, `merge` o crear un PR sin autorización explícita** en el momento, sin importar que el trabajo esté verificado y completo.

---

## Comandos

```bash
npm run dev                          # http://localhost:3000 → redirige a /es/login
npm run build
npm run lint
npm run test                         # vitest run (todos los tests)
npm run test:ci                      # igual a `test`; nombre usado en el flujo de verificación
npx vitest run path/al/archivo.test.ts   # un solo archivo de test
npx vitest path/al/archivo.test.ts       # modo watch de un solo archivo
npx tsc --noEmit                     # chequeo de tipos
```

CI (`.github/workflows/ci.yml`) corre lint + build en cada push/PR. Un segundo job, `check-box-isolation`, solo corre contra un proyecto Supabase de pruebas dedicado (secrets `SUPABASE_ISOLATION_TEST_*`) — nunca debe apuntar a producción, porque crea/borra tenants sintéticos ("Test Box A/B").

No hay hooks de git (husky/lint-staged) configurados en el repo — el `npm run test:ci && npm run build` de arriba es, hoy, la única red de seguridad antes de dar algo por terminado.

### Aislamiento multi-tenant y scripts de demo/QA

```bash
npm run check-isolation          # 26/26 checks de RLS contra un proyecto Supabase de PRUEBA
npm run e2e-two-boxes            # checks automatizados API+RLS+ranking (requiere `npm run dev` corriendo para los checks HTTP de ranking)
npm run demo                     # siembra el box demo "Parabellum Cross"
npm run reset-two-demo-boxes     # resetea dos boxes demo (Parabellum + Iron District) para pruebas E2E de aislamiento
npm run seed-demo-boxes / npm run teardown-demo-boxes   # boxes de QA (Parabellum vs "QA Demo Box Beta")
npm run teardown-isolation-boxes # elimina Test Box A/B sintéticos si llegan a filtrarse a producción
```

Los scripts destructivos de seed/teardown requieren `ATHRON_QA_CONFIRM=true` como guardrail — nunca correrlos contra producción. Ver `docs/QA-CHECKLIST.md` y `docs/E2E-TWO-BOX-ISOLATION.md` para las matrices manuales completas, credenciales, y qué implica cada síntoma de falla sobre la política RLS o query subyacente.

Scripts de load-test y auditoría (`loadtest:25:*`, `qa:parabellum10:*`, `audit:plans`, `create-super-admin`, `verify-*`) viven en `scripts/` — revisar el encabezado del script antes de correrlo, varios hablan con datos reales de Supabase.

### Migraciones SQL

`supabase/` contiene archivos SQL crudos (schema, migraciones, patches) que se aplican manualmente y en orden al proyecto Supabase — no hay runner de migraciones. El README lista el orden de aplicación para un setup nuevo. Un cambio de esquema se agrega como un `supabase/migration-*.sql` o `patch-*.sql` **nuevo**, nunca editando uno pasado, y siempre acompañado de las políticas RLS correspondientes (ver `supabase/CONSOLIDADO-rls-multitenant.sql`). Recuerda: esto requiere explicar el cambio primero (regla obligatoria #4 y "Política de trabajo permanente") y esperar autorización explícita antes de siquiera redactar el archivo SQL.

---

## Arquitectura

### Modelo de tenancy

Cada tenant es un **box** (tabla `boxes`). Casi todas las demás tablas llevan `box_id`, y las políticas RLS de Postgres son la barrera de aislamiento real — no el código de aplicación. `profiles.rol` es uno de `socio` (miembro), `coach`, `admin`/`box_admin`, más un flag `is_super_admin` a nivel plataforma que vive fuera de la jerarquía de box (administra boxes/suscripciones cross-tenant, no datos de gimnasio). Al tocar cualquier query o tabla nueva, la suposición por defecto es: debe estar acotada por `box_id` y cubierta por una política RLS — la fuga de datos cross-box es la clase de bug principal contra la que se protege esta app (ver las tablas "Señales de fallo" en los dos docs de QA/E2E para ejemplos concretos: un query sin `.eq("box_id", ...)`, una política RLS `_select_authenticated`/`_admin_all` faltante, etc.).

### Flujo de request/auth

- `src/middleware.ts` corre en cada ruta no-API/no-estática: resuelve el locale (next-intl), carga la sesión de Supabase, obtiene el `profiles` del usuario (`rol`, `box_id`, `is_super_admin`) y redirige según rol — no autenticado → `/login`, rol incorrecto para `/admin/*` o `/admin-athron/*` → su área correspondiente, y cualquier no-super-admin cuyo box tenga `status !== "active"` → `/box-inactivo`. Los route groups reflejan esto: `(admin)`, `(admin-athron)` (super admin/plataforma), `(auth)`, `(socio)`.
- `src/lib/auth/roles.ts` tiene los dos predicados centrales de rol (`isAdminLikeRole`, `canAccessAdminArea`) — reusar estos en vez de re-derivar checks de rol inline.
- Tres constructores de cliente Supabase, cada uno para un nivel de confianza distinto:
  - `src/lib/supabase/server.ts` — cliente server ligado a cookies (anon key), respeta RLS como el usuario logueado. Usar en Server Components/route handlers para todo lo que deba quedarse dentro de RLS.
  - `src/lib/supabase/client.ts` — cliente de browser para Client Components.
  - `src/lib/supabase/admin.ts` — cliente `service_role` (`"server-only"`, lanza error si se importa desde el cliente). Salta RLS; se usa para lecturas cross-tenant (super admin), trabajo en background/agregados, y donde entitlements/usage deben calcularse sin depender del acceso row-level del caller. Cada uso de este cliente es un punto donde hay que verificar a mano el scoping por `box_id`, porque RLS no lo va a hacer.

### Patrón de rutas API

Los route handlers bajo `src/app/api/**` siguen una forma consistente (ej. `src/app/api/admin/clases/route.ts`): una función `requireXxx(request)` que (1) aplica `rateLimitOrNull` de `src/lib/security/rate-limit.ts`, (2) carga el usuario de sesión + profile vía el cliente Supabase de servidor, (3) valida rol/`box_id`, (4) opcionalmente valida entitlements, y devuelve un objeto de contexto o un `NextResponse` de error — los callers hacen `if (ctx instanceof NextResponse) return ctx;`. Seguir este patrón para rutas admin/API nuevas en vez de meter los checks de auth inline en cada handler.

### Entitlements / planes (`src/lib/entitlements/`)

Motor de feature-gating de SaaS sobre el modelo de tenancy: `plans` (catálogo, `max_atletas`/`max_coaches`/`max_admins`, flags de features) → `box_subscriptions` (status: trialing/active/grace_period/suspended/canceled/expired) → `box_feature_overrides` opcional (overrides por box con vencimiento, ej. acceso promocional) → `computeBoxEntitlements` combina todo esto en un `BoxEntitlements` (plan efectivo, mapa de features resuelto con dependencias padre/hijo vía `feature-deps.ts`, uso vs. límites, `canWrite`). Entry points: `getBoxEntitlements(boxId)` / `getBoxEntitlementsFromSession()` en `engine.ts`. Los helpers de enforcement `assertCanCreateResources`, `assertFeatureEnabled`, `assertWithinPlanLimit` lanzan `EntitlementError` (tiene `.status`) — los route handlers capturan esto y devuelven `.message`/`.status` directo al cliente. El acceso al ranking público para visitantes anónimos se controla aparte vía `canAccessPublicRanking`/`getPublicRankingAccess` (indexado por `slug` del box, no por `box_id`).

### i18n

`next-intl` con locales `es` (default) y `en`, URLs siempre con prefijo (`routing.ts`: `localePrefix: "always"`). Todas las rutas de página viven bajo `src/app/[locale]/...`; los strings de traducción están en `messages/en.json` / `messages/es.json`. Usar `Link`/`redirect`/`usePathname`/`useRouter` exportados de `src/i18n/routing.ts` (wrappers locale-aware), no los equivalentes crudos de `next/navigation`, dentro de páginas `[locale]`.

### Dominios de negocio (`src/lib/`)

La lógica de negocio está organizada por dominio, no por capa — ej. `reservas` (bookings/cupo), `ranking` (liga Athron, puntos, logros, rachas), `clases` (clases/entrenamientos/scores), `membresias` (planes de membresía/vencimiento), `progreso`/`retention` (progreso del atleta, riesgo de abandono), `reporte-semanal` (generación de reporte semanal/export Excel), `legacy` (legacy cards del atleta), `seguimientos` (notas/seguimiento de coach). La mayoría de la lógica no trivial aquí tiene un `*.test.ts` co-ubicado (vitest, entorno `node`, alias `@/`, `server-only` mockeado en tests vía `vitest.config.ts`) — revisar si ya existe un test antes de agregar uno y seguir su estructura al extender ese módulo.

---

## Sistema de diseño / UX

- **Tema**: dark mode por defecto (`darkMode: ["class"]` en `tailwind.config.ts`), tokens de color en HSL definidos como CSS vars en `src/app/globals.css` (`--background`, `--card`, `--primary`, etc.) y consumidos vía `tailwind.config.ts`. No hardcodear colores fuera de estos tokens.
- **Marca**: acento naranja/rojo (`--primary: 14 100% 50%`, `--accent: 24 95% 53%`). Utilidades reutilizables ya definidas en `globals.css`: `.brand-gradient`, `.brand-text`, `.glass-card`, `.glow-primary`. Usarlas en vez de recrear el efecto con clases sueltas.
- **Mobile-first / PWA**: la app es instalable (PWA, ver `src/components/pwa/`, `public/manifest.json`, `public/sw.js`) y tiene utilidades específicas para safe-area y nav inferior táctil (`.safe-top`, `.safe-bottom`, `.mobile-page`, `.mobile-bottom-nav`, `.mobile-bottom-nav-tab`). Cualquier pantalla nueva orientada a `socio` debe respetar estos patrones de layout mobile.
- **Componentes**: primitives estilo shadcn/ui en `src/components/ui/` (`button`, `card`, `dialog`, `select`, `dropdown-menu`, `avatar`, `badge`, `progress`, etc.), compuestos con Radix + `class-variance-authority` + `cn()` (`src/lib/utils.ts`, `clsx` + `tailwind-merge`). Componentes de dominio viven en carpetas separadas por área (`admin/`, `socio/`, `ranking/`, `legacy/`, `layout/`, `membresias/`, `plans/`, `stats/`). Antes de crear un componente nuevo, revisar si ya hay uno equivalente en `ui/` o en la carpeta de dominio correspondiente.
- **Tipografía**: `--font-geist-sans` (Inter) para texto general, `--font-display` (Oswald) para elementos de marca/display.

---

## Reglas de negocio a tener presentes

- Socios nuevos (`socio`) inician en `pendiente_pago` hasta que se les asigna un plan.
- Una membresía vencida bloquea nuevas reservas.
- Las reservas se pueden cancelar hasta **2 horas** antes de la clase.
- El cupo default de una clase es **12**.
- Las alertas de membresía disparan para planes ya vencidos y para los que vencen dentro de **3 días**.
