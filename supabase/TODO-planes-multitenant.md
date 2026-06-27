# Planes multi-tenant — IMPLEMENTADO

Ver `supabase/patch-planes-box-id.sql`.

Cada box tiene su propio catálogo (`planes.box_id NOT NULL`). RLS filtra por `get_my_box_id()` con bypass `is_super_admin()`. Planes existentes se migraron al box `parabellum-cross`.
