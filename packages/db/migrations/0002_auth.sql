-- 0002 · Better Auth sobre la tabla pública `users`.
--
-- Better Auth usa `users` como su modelo de usuario (campo `name` → `full_name`),
-- de modo que no existe una segunda tabla de personas. Las contraseñas (hash
-- scrypt), sesiones y tokens viven en tablas `auth_*` separadas, a las que la
-- aplicación nunca accede con el rol restringido `app_user` (ver 0004).

ALTER TABLE users
    ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
    ADD COLUMN image          text,
    ADD COLUMN updated_at     timestamptz NOT NULL DEFAULT now();

CREATE TABLE auth_sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token               text NOT NULL UNIQUE,
    expires_at          timestamptz NOT NULL,
    ip_address          text,
    user_agent          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);

CREATE TABLE auth_accounts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id          text NOT NULL,
    provider_id         text NOT NULL,
    access_token        text,
    refresh_token       text,
    id_token            text,
    access_token_expires_at  timestamptz,
    refresh_token_expires_at timestamptz,
    scope               text,
    password            text,  -- Hash (nunca texto plano), gestionado por Better Auth.
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_accounts_user_idx ON auth_accounts (user_id);

CREATE TABLE auth_verifications (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier          text NOT NULL,
    value               text NOT NULL,
    expires_at          timestamptz NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verifications_identifier_idx ON auth_verifications (identifier);
