-- ─── Crear Super Admin ATHRON (cuenta de plataforma, no del box) ─────────────
-- Opción A: corre en terminal: npm run create-super-admin
-- Opción B: si ya existe el usuario en auth.users, solo marca el perfil:

-- UPDATE profiles SET is_super_admin = true
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'superadmin@athron.app');
