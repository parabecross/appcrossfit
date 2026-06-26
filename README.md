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

### 3. Ejecutar schema SQL

En el **SQL Editor** de Supabase, pega y ejecuta el contenido completo de:

```
supabase/schema.sql
```

Esto crea tablas, enums, triggers, vistas, RLS y bucket `avatars`.

### 4. Seed de datos demo

```bash
npm run seed
```

Crea admin, coaches, socios, planes, clases y reservas.

### 5. Correr en local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) → redirige a `/es/login`.

## Credenciales de prueba (post-seed)

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
├── schema.sql        # DDL + RLS
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
