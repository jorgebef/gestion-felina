-- Enlace recuperable de las invitaciones abiertas. El token sigue identificándose por su
-- hash (token_hash); además se guarda cifrado (AES-256-GCM con una clave derivada de
-- BETTER_AUTH_SECRET, ver packages/core/src/invitation-links.ts) para que los
-- administradores puedan volver a copiar el enlace sin reenviar la invitación.
-- Las invitaciones anteriores no lo tienen: su enlace solo existe en el email enviado.
ALTER TABLE organization_invitations ADD COLUMN token_ciphertext text;

-- Lo leen los mismos que ya ven la invitación (política organization_invitations_select).
GRANT SELECT (token_ciphertext) ON organization_invitations TO app_user;
