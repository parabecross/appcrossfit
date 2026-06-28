# ATHRON

Plataforma multi-box para gimnasios CrossFit — reservas, membresías, progreso de atletas y panel admin.

El primer box en producción es **Parabellum Cross** (cuentas y datos existentes sin cambios).

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-green) ![Tailwind](https://img.shields.io/badge/Tailwind-CSS-blue)

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (Auth, Postgres, Storage, RLS)
- **Tailwind CSS** + componentes estilo shadcn/ui
- **Recharts** para estadísticas
- **next-intl** — UI en **español e inglés**

## Setup local

### 1. Clonar e instalar

```bash
npm install
```

### 2. Crear proyecto Supabase

1. Ve a [supabase.com](https://supabase.com) → New Project
2. Copia **Project URL**, **anon key** y **service_role key**
3. Copia `.env.example` → `.env.local` y pega tus valores

### 3. Ejecutar SQL en Supabase (en orden)

Pega cada archivo **completo** en el SQL Editor, uno tras otro:

| # | Archivo |
|---|---------|
| 1 | `supabase/schema.sql` |
| 2 | `supabase/migration-athron-fase1.sql` |
| 3 | `supabase/migration-athron-fase2-enum.sql` *(solo enum `box_admin` — corrida aparte)* |
| 4 | `supabase/migration-athron-fase2-box-admin.sql` |
| 5 | `supabase/patch-handle-new-user-rol-seguro.sql` |
| 6 | `supabase/patch-atleta-expediente-fase1.sql` |
| 7 | `supabase/patch-atleta-legacy.sql` |
| 8 | `supabase/patch-clase-scores.sql` |
| 9 | `supabase/patch-ranking-athron-v1.sql` |
| 10 | `supabase/patch-clase-cupo-socio.sql` |
| 11 | `supabase/patch-admin-insert-reserva.sql` *(requerido para `npm run demo`)* |
| 12 | `supabase/patch-reservas-realtime.sql` |
| 13 | `supabase/CONSOLIDADO-rls-multitenant.sql` *(RLS final — idempotente)* |

El paso 13 incluye aislamiento multi-tenant, planes por box, ranking público y bypass super admin. Al final del script, el checklist debe mostrar `missing_count = 0`. Verifica con:

```bash
npm run check-isolation
```

(debe dar **24/24**).

## CI

GitHub Actions (`.github/workflows/ci.yml`) corre en cada push y pull request:

| Job | Cuándo | Qué hace |
|-----|--------|----------|
| **lint-and-build** | Siempre | `npm ci` → `npm run lint` → `npm run build` (sin secrets) |
| **check-box-isolation** | Push y PRs **del mismo repo** (no forks) | `npm run check-isolation` contra Supabase real |

El segundo job usa la **service_role key** y crea/borra usuarios de test en la base de datos configurada. Por eso **no corre en PRs desde forks externos**, donde GitHub no expone los secrets del repo de forma segura.

Para que `check-box-isolation` funcione, configura estos **3 secrets** en el repositorio:

**GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valor |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

Si falta alguno, el job falla con un mensaje claro antes de ejecutar el script.

### 4. Demo completa (10 días · ranking)

```bash
npm run demo
```

Crea 2 coaches, 10 atletas con categoría Legacy, 10 días de clases, scores y membresías variadas.

### 5. Correr en local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) → redirige a `/es/login`.

## Credenciales de prueba (post-demo)

| Rol   | Email                         | Password          |
|-------|-------------------------------|-------------------|
| Admin | `admin@parabellum.cross`      | `Parabellum2024!` |
| Coach | `coach.maria@parabellum.cross`| `Parabellum2024!` |
| Socio | `lucia.herrera@email.com`     | `Parabellum2024!` |

## Rutas

### Admin
- `/es/admin/dashboard` — KPIs, alertas, gráficas
- `/es/admin/usuarios` — gestión de socios
- `/es/admin/clases` — calendario, crear clases, asistencia
- `/es/admin/planes` — tipos de membresía
- `/es/admin/estadisticas` — gráficas detalladas

### Socio
- `/es/mis-reservas` — calendario semanal + reservar/cancelar
- `/es/perfil` — editar bio, foto, datos
- `/es/mi-membresia` — plan actual e historial

Cambia `es` por `en` para inglés. Botón **EN/ES** en la UI.

## Roles

| Rol    | Acceso                                      |
|--------|---------------------------------------------|
| admin  | Panel completo                              |
| coach  | Solo gestión de clases                      |
| socio  | Reservas, perfil, membresía                 |

Los **coaches** son perfiles reales asignables al crear cada clase.

## Deploy en Vercel

1. Push a GitHub
2. Import en [vercel.com](https://vercel.com)
3. Añade las 3 variables de entorno de `.env.example`
4. Deploy

## Estructura

```
src/
├── app/[locale]/     # Rutas con i18n
├── components/       # UI, layouts, charts
├── lib/              # Supabase, queries, reglas de negocio
├── i18n/             # Config next-intl
└── types/            # Tipos TypeScript
supabase/
├── schema.sql                      # DDL base
├── migration-athron-fase1.sql        # Multi-tenant (boxes, box_id)
├── migration-athron-fase2-enum.sql # Enum box_admin
├── migration-athron-fase2-box-admin.sql
├── patch-*.sql                     # Features (scores, ranking, demo helpers)
└── CONSOLIDADO-rls-multitenant.sql # RLS final (ejecutar al final)
scripts/
└── seed.ts           # Datos demo
```

## Futuro (preparado, no implementado)

- **Pagos**: tabla `pagos` separada de `membresias` — ver comentarios en `schema.sql`
- **Multi-sede**: columna `gym_id` en tablas principales
- **Notificaciones**: Edge Function cron para membresías por vencer — ver comentarios en schema

## Reglas de negocio

- Socios nuevos quedan en `pendiente_pago` hasta que admin asigne plan
- Membresía vencida bloquea reservas con mensaje claro
- Cancelación permitida hasta **2 h** antes de la clase (`src/lib/config/app-config.ts`)
- Cupo default **12** por clase
- Alertas admin: vencidos + por vencer en **3 días**

---

**ATHRON** — Train hard. Book easy.
