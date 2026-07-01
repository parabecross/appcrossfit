# ATHRON

Plataforma SaaS multi-tenant para boxes de CrossFit y entrenamiento funcional.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-green) ![Tailwind](https://img.shields.io/badge/Tailwind-CSS-blue) ![PWA](https://img.shields.io/badge/PWA-installable-orange)

## Características

- **Multi-box** — aislamiento por tenant con RLS
- **Reservas** — calendario semanal, cupos, cancelación
- **Membresías** — planes, vencimientos, alertas
- **Dashboard** — KPIs y actividad para admins
- **Ranking** — liga Athron con puntos y premios
- **Coaches** — gestión de clases y asistencia
- **Atletas** — progreso, PRs, Legacy cards
- **PWA** — instalable en iOS (Safari) y Android (Chrome)
- **Multi idioma** — español e inglés (next-intl)
- **Supabase** — Auth, Postgres, Storage, RLS
- **Next.js** — App Router 15 + TypeScript

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Supabase** (Auth, Postgres, Storage, RLS)
- **Tailwind CSS** + componentes estilo shadcn/ui
- **Recharts** · **Vitest** · **next-intl**

## Setup local

```bash
npm install
cp .env.example .env.local
# Pegar URL, anon key y service_role key de Supabase
```

### SQL en Supabase (orden)

| # | Archivo |
|---|---------|
| 1 | `supabase/schema.sql` |
| 2 | `supabase/migration-athron-fase1.sql` |
| 3 | `supabase/migration-athron-fase2-enum.sql` |
| 4 | `supabase/migration-athron-fase2-box-admin.sql` |
| 5 | `supabase/patch-handle-new-user-rol-seguro.sql` |
| 6 | `supabase/patch-atleta-expediente-fase1.sql` |
| 7 | `supabase/patch-atleta-legacy.sql` |
| 8 | `supabase/patch-clase-scores.sql` |
| 9 | `supabase/patch-ranking-athron-v1.sql` |
| 10 | `supabase/patch-clase-cupo-socio.sql` |
| 11 | `supabase/patch-admin-insert-reserva.sql` |
| 12 | `supabase/patch-reservas-realtime.sql` |
| 13 | `supabase/CONSOLIDADO-rls-multitenant.sql` |

Verificar aislamiento multi-tenant:

```bash
npm run check-isolation   # debe dar 24/24
```

### Box demo de ejemplo

El seed incluye un box ficticio **Parabellum Cross** (`parabellum-cross`) con usuarios de prueba. Es solo data demo, no el nombre del producto.

```bash
npm run demo
```

Credenciales post-demo (box **Parabellum Cross**):

| Rol   | Email                          | Password          |
|-------|--------------------------------|-------------------|
| Admin | `admin@parabellum.cross`       | `Parabellum2024!` |
| Coach | `coach.maria@parabellum.cross`   | `Parabellum2024!` |
| Socio | `lucia.herrera@email.com`      | `Parabellum2024!` |

### Desarrollo

```bash
npm run dev        # http://localhost:3000 → /es/login
npm run lint
npm run test
npm run build
```

## CI

GitHub Actions (`.github/workflows/ci.yml`):

| Job | Qué hace |
|-----|----------|
| **lint-and-build** | lint + build |
| **check-box-isolation** | 24 checks RLS (requiere secrets Supabase) |

Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Rutas principales

| Área | Rutas |
|------|-------|
| Admin | `/es/admin/dashboard`, `usuarios`, `clases`, `planes`, `ranking` |
| Socio | `/es/mis-reservas`, `perfil`, `mi-membresia`, `mi-progreso` |
| Público | `/es/ranking`, `/es/login`, `/es/registro` |
| Super admin | `/es/admin-athron/dashboard` |

Cambia `es` por `en` para inglés.

## Deploy

1. Push a GitHub
2. Import en [Vercel](https://vercel.com)
3. Variables de entorno (ver `.env.example`)
4. `npm run build`

## Estructura

```
src/
├── app/[locale]/       # Rutas i18n
├── components/         # UI, layouts, ranking, PWA
├── lib/                # Supabase, queries, ranking, seguridad
├── i18n/               # next-intl
└── types/
supabase/               # Schema, migraciones, RLS
scripts/                # Demo, isolation check, iconos PWA
public/                 # manifest.json, icons, og-athron
```

## Reglas de negocio

- Socios nuevos: `pendiente_pago` hasta asignación de plan
- Membresía vencida bloquea reservas
- Cancelación hasta **2 h** antes de la clase
- Cupo default **12** por clase
- Alertas: vencidos + por vencer en **3 días**

---

**ATHRON** — Train. Track. Progress.
