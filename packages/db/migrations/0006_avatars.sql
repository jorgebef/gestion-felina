-- Fotos de perfil de personas y organizaciones (los gatos ya tienen su foto principal).
-- Guardan la clave del archivo en el almacenamiento (packages/storage), como `cats.photo_key`.
ALTER TABLE users ADD COLUMN avatar_key text;
ALTER TABLE organizations ADD COLUMN avatar_key text;

-- Cada persona cambia la suya (política users_update: solo uno mismo); la ven quienes ya
-- ven a esa persona (users_select). La de una organización la cambian sus administradores
-- (organizations_update); SELECT ya está concedido sobre toda la tabla.
GRANT SELECT (avatar_key), UPDATE (avatar_key) ON users TO app_user;
GRANT UPDATE (avatar_key) ON organizations TO app_user;
