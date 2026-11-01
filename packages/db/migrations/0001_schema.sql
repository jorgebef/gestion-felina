-- 0001 · Esquema base de GestiónFelina (PostgreSQL 14+).
--
-- Modelo:
--   * Cada persona (users) pertenece como máximo a UNA organización.
--   * Una organización es una asociación (gestiona colonias, gatos y acciones) o un
--     ayuntamiento (uno por municipio; ve, autoriza, valida y propone cambios).
--   * Toda organización necesita la aprobación manual del superadministrador.
--   * Colonias, gatos y acciones tienen ubicación exacta y municipio INE.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() es STABLE; este envoltorio IMMUTABLE permite usarlo en índices.
CREATE OR REPLACE FUNCTION app_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT unaccent('unaccent'::regdictionary, $1) $$;

CREATE OR REPLACE FUNCTION app_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- Personas y autenticación (Better Auth usa `users` como modelo de usuario).
CREATE TABLE users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               text NOT NULL,
    full_name           text,
    email_verified      boolean NOT NULL DEFAULT false,
    image               text,
    -- Superadministrador de la plataforma (aprueba organizaciones, invita ayuntamientos).
    -- Solo se concede desde la línea de comandos: `vp run admin:grant <email>`.
    is_platform_admin   boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_ci_uq ON users (lower(email));

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
    password            text,  -- Hash gestionado por Better Auth, nunca texto plano.
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

-- ---------------------------------------------------------------------------
-- Municipios de España (Relación de municipios del INE). `code` = CPRO + CMUN.
CREATE TABLE municipalities (
    code                char(5) PRIMARY KEY CHECK (code ~ '^[0-9]{5}$'),
    province_code       char(2) NOT NULL,
    name                text NOT NULL,   -- Nombre para mostrar: «A Coruña», «Las Rozas de Madrid».
    official_name       text NOT NULL,   -- Nombre tal cual en el INE: «Coruña, A».
    search_name         text GENERATED ALWAYS AS (lower(app_unaccent(name || ' ' || official_name))) STORED
);
CREATE INDEX municipalities_province_idx ON municipalities (province_code);
CREATE INDEX municipalities_search_idx ON municipalities USING gin (search_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Organizaciones.
CREATE TABLE organizations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind                text NOT NULL CHECK (kind IN ('association', 'town_hall')),
    name                text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 200),
    tax_id              text,            -- CIF, opcional.
    -- Ayuntamiento: su municipio (obligatorio, uno por municipio). Asociación: sede (opcional).
    municipality_code   char(5) REFERENCES municipalities(code),
    description         text,
    contact_email       text,
    contact_phone       text,
    status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    review_note         text,
    reviewed_at         timestamptz,
    reviewed_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organizations_town_hall_municipality_ck
        CHECK (kind <> 'town_hall' OR municipality_code IS NOT NULL)
);
-- Un único ayuntamiento por municipio.
CREATE UNIQUE INDEX organizations_town_hall_uq ON organizations (municipality_code)
    WHERE kind = 'town_hall';
CREATE INDEX organizations_status_idx ON organizations (status, created_at);
CREATE TRIGGER organizations_touch BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

-- Una persona pertenece a una sola organización (user_id es la clave primaria).
CREATE TABLE organization_members (
    user_id             uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role                text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organization_members_org_idx ON organization_members (organization_id);

-- Invitaciones por email. Se guarda el SHA-256 del token, nunca el token.
CREATE TABLE organization_invitations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email               text NOT NULL CHECK (email = lower(btrim(email))),
    role                text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    token_hash          text NOT NULL UNIQUE,
    invited_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    expires_at          timestamptz NOT NULL,
    accepted_at         timestamptz,
    accepted_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
-- Como mucho una invitación abierta por organización y email.
CREATE UNIQUE INDEX organization_invitations_open_uq ON organization_invitations (organization_id, email)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Colonias: una sola asociación gestora; el ayuntamiento del municipio las autoriza.
CREATE TABLE colonies (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
    description         text,
    latitude            double precision NOT NULL CHECK (latitude BETWEEN 27 AND 44.5),
    longitude           double precision NOT NULL CHECK (longitude BETWEEN -18.5 AND 4.6),
    municipality_code   char(5) NOT NULL REFERENCES municipalities(code),
    address             text,
    authorized_at       timestamptz,
    authorized_by       uuid REFERENCES users(id) ON DELETE SET NULL,
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX colonies_org_idx ON colonies (organization_id);
CREATE INDEX colonies_municipality_idx ON colonies (municipality_code);
CREATE TRIGGER colonies_touch BEFORE UPDATE ON colonies
    FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

-- Gatos: siempre de una organización; colonia opcional; ubicación obligatoria.
CREATE TABLE cats (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    colony_id           uuid REFERENCES colonies(id) ON DELETE SET NULL,
    name                text CHECK (name IS NULL OR length(btrim(name)) BETWEEN 1 AND 80),
    sex                 text NOT NULL DEFAULT 'unknown' CHECK (sex IN ('male', 'female', 'unknown')),
    birth_date          date,            -- NULL = desconocida.
    birth_date_approximate boolean NOT NULL DEFAULT false,
    description         text,            -- Capa, marcas, carácter…
    photo_key           text NOT NULL,   -- Clave de la foto principal en el almacenamiento.
    latitude            double precision NOT NULL CHECK (latitude BETWEEN 27 AND 44.5),
    longitude           double precision NOT NULL CHECK (longitude BETWEEN -18.5 AND 4.6),
    municipality_code   char(5) NOT NULL REFERENCES municipalities(code),
    address             text,
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cats_birth_date_ck CHECK (birth_date IS NULL OR birth_date <= current_date + 1)
);
CREATE INDEX cats_org_idx ON cats (organization_id);
CREATE INDEX cats_colony_idx ON cats (colony_id);
CREATE INDEX cats_municipality_idx ON cats (municipality_code);
CREATE TRIGGER cats_touch BEFORE UPDATE ON cats
    FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

-- Acciones: gestionadas por una organización; varios gatos y participantes.
CREATE TABLE actions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    colony_id           uuid REFERENCES colonies(id) ON DELETE SET NULL,
    -- Municipio donde se realiza (el de la colonia, o el de los gatos): decide qué
    -- ayuntamiento la ve en su feed. Se conserva aunque la colonia se elimine.
    municipality_code   char(5) NOT NULL REFERENCES municipalities(code),
    action_type         text NOT NULL CHECK (action_type IN
                        ('sterilization', 'vet_visit', 'capture', 'release', 'feeding', 'other')),
    name                text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 160),
    description         text,
    scheduled_at        timestamptz NOT NULL,
    is_urgent           boolean NOT NULL DEFAULT false,
    status              text NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'in_progress', 'done', 'cancelled')),
    -- Validación del ayuntamiento del municipio (NULL = sin validar).
    validated_at        timestamptz,
    validated_by        uuid REFERENCES users(id) ON DELETE SET NULL,
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX actions_org_idx ON actions (organization_id, scheduled_at DESC);
CREATE INDEX actions_municipality_idx ON actions (municipality_code, created_at DESC);
CREATE INDEX actions_colony_idx ON actions (colony_id);
CREATE TRIGGER actions_touch BEFORE UPDATE ON actions
    FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

CREATE TABLE action_cats (
    action_id           uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    cat_id              uuid NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    PRIMARY KEY (action_id, cat_id)
);
CREATE INDEX action_cats_cat_idx ON action_cats (cat_id);

CREATE TABLE action_participants (
    action_id           uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (action_id, user_id)
);
CREATE INDEX action_participants_user_idx ON action_participants (user_id);

-- ---------------------------------------------------------------------------
-- Propuestas de cambio: el ayuntamiento no edita; propone, y la asociación gestora
-- acepta (se aplican los cambios) o rechaza.
CREATE TABLE change_proposals (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type         text NOT NULL CHECK (target_type IN ('colony', 'cat')),
    colony_id           uuid REFERENCES colonies(id) ON DELETE CASCADE,
    cat_id              uuid REFERENCES cats(id) ON DELETE CASCADE,
    -- Asociación gestora del elemento (la que resuelve). La rellena un trigger.
    target_organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    proposed_by_organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    proposed_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    changes             jsonb NOT NULL CHECK (jsonb_typeof(changes) = 'object' AND changes <> '{}'),
    previous_values     jsonb NOT NULL DEFAULT '{}',
    message             text,
    status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    resolution_note     text,
    resolved_at         timestamptz,
    resolved_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT change_proposals_target_ck CHECK (
        (target_type = 'colony' AND colony_id IS NOT NULL AND cat_id IS NULL) OR
        (target_type = 'cat' AND cat_id IS NOT NULL AND colony_id IS NULL)
    )
);
CREATE INDEX change_proposals_target_org_idx ON change_proposals (target_organization_id, status);
CREATE INDEX change_proposals_proposer_idx ON change_proposals (proposed_by_organization_id, status);
CREATE INDEX change_proposals_colony_idx ON change_proposals (colony_id);
CREATE INDEX change_proposals_cat_idx ON change_proposals (cat_id);

-- ---------------------------------------------------------------------------
-- Integridad entre tablas (se aplica a todos los roles, también al propietario).

-- Colonias, gatos y acciones solo pertenecen a asociaciones.
CREATE OR REPLACE FUNCTION app_check_association_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organizations
                   WHERE id = NEW.organization_id AND kind = 'association') THEN
        RAISE EXCEPTION '% must belong to an association', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER colonies_association_owner BEFORE INSERT OR UPDATE OF organization_id ON colonies
    FOR EACH ROW EXECUTE FUNCTION app_check_association_owner();
CREATE TRIGGER cats_association_owner BEFORE INSERT OR UPDATE OF organization_id ON cats
    FOR EACH ROW EXECUTE FUNCTION app_check_association_owner();
CREATE TRIGGER actions_association_owner BEFORE INSERT OR UPDATE OF organization_id ON actions
    FOR EACH ROW EXECUTE FUNCTION app_check_association_owner();

-- La colonia de un gato o de una acción es de la misma organización.
CREATE OR REPLACE FUNCTION app_check_same_org_colony() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.colony_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM colonies WHERE id = NEW.colony_id AND organization_id = NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'colony belongs to another organization' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER cats_same_org_colony BEFORE INSERT OR UPDATE OF colony_id, organization_id ON cats
    FOR EACH ROW EXECUTE FUNCTION app_check_same_org_colony();
CREATE TRIGGER actions_same_org_colony BEFORE INSERT OR UPDATE OF colony_id, organization_id ON actions
    FOR EACH ROW EXECUTE FUNCTION app_check_same_org_colony();

CREATE OR REPLACE FUNCTION app_check_action_cat() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM actions a JOIN cats c ON c.organization_id = a.organization_id
        WHERE a.id = NEW.action_id AND c.id = NEW.cat_id
    ) THEN
        RAISE EXCEPTION 'cat belongs to another organization' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER action_cats_same_org BEFORE INSERT OR UPDATE ON action_cats
    FOR EACH ROW EXECUTE FUNCTION app_check_action_cat();

CREATE OR REPLACE FUNCTION app_check_action_participant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM actions a
        JOIN organization_members m ON m.organization_id = a.organization_id
        WHERE a.id = NEW.action_id AND m.user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'participant is not a member of the organization' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER action_participants_member BEFORE INSERT OR UPDATE ON action_participants
    FOR EACH ROW EXECUTE FUNCTION app_check_action_participant();

-- Siempre queda al menos un administrador en cada organización con miembros.
CREATE OR REPLACE FUNCTION app_keep_one_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF OLD.role = 'admin'
       AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NEW.organization_id <> OLD.organization_id)
       AND EXISTS (SELECT 1 FROM organizations WHERE id = OLD.organization_id)
       AND NOT EXISTS (
           SELECT 1 FROM organization_members
           WHERE organization_id = OLD.organization_id AND role = 'admin' AND user_id <> OLD.user_id
       )
       AND EXISTS (
           SELECT 1 FROM organization_members
           WHERE organization_id = OLD.organization_id AND user_id <> OLD.user_id
       ) THEN
        RAISE EXCEPTION 'an organization must keep at least one admin' USING ERRCODE = '23514';
    END IF;
    RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER organization_members_keep_admin BEFORE UPDATE OR DELETE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION app_keep_one_admin();

-- Propuestas: la asociación que resuelve es siempre la gestora del elemento.
CREATE OR REPLACE FUNCTION app_fill_proposal_target() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.target_type = 'colony' THEN
        SELECT organization_id INTO NEW.target_organization_id FROM colonies WHERE id = NEW.colony_id;
    ELSE
        SELECT organization_id INTO NEW.target_organization_id FROM cats WHERE id = NEW.cat_id;
    END IF;
    IF NEW.target_organization_id IS NULL THEN
        RAISE EXCEPTION 'proposal target not found' USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER change_proposals_fill_target BEFORE INSERT ON change_proposals
    FOR EACH ROW EXECUTE FUNCTION app_fill_proposal_target();

-- ---------------------------------------------------------------------------
-- Correos enviados por el worker (recordatorios); `dedupe_key` evita duplicados.
CREATE TABLE notification_deliveries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type   text NOT NULL,
    dedupe_key          text NOT NULL UNIQUE,
    status              text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'sent', 'failed')),
    attempt_count       integer NOT NULL DEFAULT 0,
    provider_message_id text,
    error_message       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    sent_at             timestamptz
);
CREATE INDEX notification_deliveries_user_idx ON notification_deliveries (user_id, created_at DESC);
