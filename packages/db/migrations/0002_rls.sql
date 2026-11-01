-- 0002 · Permisos con Row Level Security.
--
--   * La API abre una transacción por petición, ejecuta `SET LOCAL ROLE app_user` y fija
--     `app.user_id` (ver packages/db/src/tenant.ts). Todas las políticas usan ese id.
--   * Better Auth, el worker y los scripts usan el rol propietario (sin RLS).
--   * Una organización pendiente, rechazada o suspendida no ve ni toca datos: solo su
--     propia ficha y sus miembros.
--   * Las acciones que no encajan en un UPDATE/INSERT simple (registrar una asociación,
--     aceptar una invitación, aprobar organizaciones, autorizar colonias, validar acciones)
--     son funciones SECURITY DEFINER que comprueban quién llama.
--   * INSERT se concede por tabla (Drizzle nombra todas las columnas y usa DEFAULT en las
--     que no recibe); las columnas que el rol no debe fijar se exigen vacías en WITH CHECK.
--     UPDATE se concede por columna.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN;
    END IF;
END $$;
GRANT app_user TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO app_user;

-- ---------------------------------------------------------------------------
-- Quién llama
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$ SELECT coalesce((SELECT is_platform_admin FROM users WHERE id = app_current_user_id()), false) $$;

-- Organización de la persona, sea cual sea su estado.
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$ SELECT organization_id FROM organization_members WHERE user_id = app_current_user_id() $$;

-- Organización aprobada (NULL si está pendiente, rechazada o suspendida).
CREATE OR REPLACE FUNCTION app_active_org() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT o.id FROM organization_members m JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = app_current_user_id() AND o.status = 'approved'
    $$;

CREATE OR REPLACE FUNCTION app_active_association() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT o.id FROM organization_members m JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = app_current_user_id() AND o.status = 'approved' AND o.kind = 'association'
    $$;

-- Administrador de su organización (aprobada).
CREATE OR REPLACE FUNCTION app_is_active_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM organization_members m JOIN organizations o ON o.id = m.organization_id
            WHERE m.user_id = app_current_user_id() AND m.role = 'admin' AND o.status = 'approved'
        )
    $$;

-- Administrador de una organización concreta (cualquier estado: puede corregir sus datos).
CREATE OR REPLACE FUNCTION app_is_admin_of(target_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM organization_members
            WHERE user_id = app_current_user_id() AND organization_id = target_org AND role = 'admin'
        )
    $$;

-- Municipio del ayuntamiento (aprobado) de la persona; NULL si no es de un ayuntamiento.
CREATE OR REPLACE FUNCTION app_town_hall_municipality() RETURNS char(5)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT o.municipality_code FROM organization_members m
        JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = app_current_user_id() AND o.status = 'approved' AND o.kind = 'town_hall'
    $$;

CREATE OR REPLACE FUNCTION app_shares_org(target_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM organization_members
            WHERE user_id = target_user AND organization_id = app_current_org()
        )
    $$;

CREATE OR REPLACE FUNCTION app_colony_municipality(target_colony uuid) RETURNS char(5)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$ SELECT municipality_code FROM colonies WHERE id = target_colony $$;

-- El ayuntamiento ve un gato si está en su municipio o en una colonia de su municipio.
CREATE OR REPLACE FUNCTION app_cat_in_town_hall(target_cat uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM cats c LEFT JOIN colonies col ON col.id = c.colony_id
            WHERE c.id = target_cat AND app_town_hall_municipality() IS NOT NULL
              AND (c.municipality_code = app_town_hall_municipality()
                   OR col.municipality_code = app_town_hall_municipality())
        )
    $$;

-- ---------------------------------------------------------------------------
-- Operaciones con reglas propias

-- Alta de una asociación: queda pendiente de aprobación y quien la registra es admin.
CREATE OR REPLACE FUNCTION app_register_association(
    p_name text, p_tax_id text, p_municipality_code text, p_description text,
    p_contact_email text, p_contact_phone text
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE
    v_user uuid := app_current_user_id();
    v_org uuid;
BEGIN
    IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE id = v_user) THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM organization_members WHERE user_id = v_user) THEN
        RAISE EXCEPTION 'user already belongs to an organization' USING ERRCODE = '23505';
    END IF;
    INSERT INTO organizations (kind, name, tax_id, municipality_code, description,
                               contact_email, contact_phone, status, created_by)
    VALUES ('association', p_name, p_tax_id, p_municipality_code, p_description,
            p_contact_email, p_contact_phone, 'pending', v_user)
    RETURNING id INTO v_org;
    INSERT INTO organization_members (user_id, organization_id, role) VALUES (v_user, v_org, 'admin');
    RETURN v_org;
END $$;

-- Aceptar una invitación: el email de la cuenta debe coincidir con el invitado.
CREATE OR REPLACE FUNCTION app_accept_invitation(p_token_hash text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE
    v_user uuid := app_current_user_id();
    v_email text;
    v_inv organization_invitations%ROWTYPE;
BEGIN
    SELECT lower(email) INTO v_email FROM users WHERE id = v_user;
    IF v_email IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_inv FROM organization_invitations WHERE token_hash = p_token_hash FOR UPDATE;
    IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.accepted_at IS NOT NULL
       OR v_inv.expires_at < now() THEN
        RAISE EXCEPTION 'invitation is not valid' USING ERRCODE = 'P0002';
    END IF;
    IF v_inv.email <> v_email THEN
        RAISE EXCEPTION 'invitation was sent to another email' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM organization_members WHERE user_id = v_user) THEN
        RAISE EXCEPTION 'user already belongs to an organization' USING ERRCODE = '23505';
    END IF;
    INSERT INTO organization_members (user_id, organization_id, role)
    VALUES (v_user, v_inv.organization_id, v_inv.role);
    UPDATE organization_invitations SET accepted_at = now(), accepted_by = v_user WHERE id = v_inv.id;
    RETURN v_inv.organization_id;
END $$;

-- Aprobar, rechazar, suspender o reactivar una organización (solo superadministrador).
CREATE OR REPLACE FUNCTION app_review_organization(p_org uuid, p_status text, p_note text)
    RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
BEGIN
    IF NOT app_is_platform_admin() THEN
        RAISE EXCEPTION 'platform admin only' USING ERRCODE = '42501';
    END IF;
    IF p_status NOT IN ('pending', 'approved', 'rejected', 'suspended') THEN
        RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
    UPDATE organizations
    SET status = p_status, review_note = p_note, reviewed_at = now(), reviewed_by = app_current_user_id()
    WHERE id = p_org;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
    END IF;
END $$;

-- Autorizar (o retirar la autorización de) una colonia: ayuntamiento de su municipio.
CREATE OR REPLACE FUNCTION app_set_colony_authorization(p_colony uuid, p_authorized boolean)
    RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE
    v_municipality char(5) := app_town_hall_municipality();
BEGIN
    IF v_municipality IS NULL THEN
        RAISE EXCEPTION 'town hall only' USING ERRCODE = '42501';
    END IF;
    UPDATE colonies
    SET authorized_at = CASE WHEN p_authorized THEN now() END,
        authorized_by = CASE WHEN p_authorized THEN app_current_user_id() END
    WHERE id = p_colony AND municipality_code = v_municipality;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'colony not found' USING ERRCODE = 'P0002';
    END IF;
END $$;

-- Validar (o dejar sin validar) una acción: ayuntamiento de su municipio.
CREATE OR REPLACE FUNCTION app_set_action_validation(p_action uuid, p_validated boolean)
    RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE
    v_municipality char(5) := app_town_hall_municipality();
BEGIN
    IF v_municipality IS NULL THEN
        RAISE EXCEPTION 'town hall only' USING ERRCODE = '42501';
    END IF;
    UPDATE actions
    SET validated_at = CASE WHEN p_validated THEN now() END,
        validated_by = CASE WHEN p_validated THEN app_current_user_id() END
    WHERE id = p_action AND municipality_code = v_municipality;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'action not found' USING ERRCODE = 'P0002';
    END IF;
END $$;

-- Si una colonia cambia de municipio, la autorización del ayuntamiento anterior caduca.
CREATE OR REPLACE FUNCTION app_reset_colony_authorization() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.municipality_code IS DISTINCT FROM OLD.municipality_code THEN
        NEW.authorized_at := NULL;
        NEW.authorized_by := NULL;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER colonies_reset_authorization BEFORE UPDATE OF municipality_code ON colonies
    FOR EACH ROW EXECUTE FUNCTION app_reset_colony_authorization();

-- Igual con la validación de una acción que pasa a otro municipio.
CREATE OR REPLACE FUNCTION app_reset_action_validation() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.municipality_code IS DISTINCT FROM OLD.municipality_code THEN
        NEW.validated_at := NULL;
        NEW.validated_by := NULL;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER actions_reset_validation BEFORE UPDATE OF municipality_code ON actions
    FOR EACH ROW EXECUTE FUNCTION app_reset_action_validation();

REVOKE ALL ON FUNCTION
    app_is_platform_admin(), app_current_org(), app_active_org(), app_active_association(),
    app_is_active_admin(), app_is_admin_of(uuid), app_town_hall_municipality(),
    app_shares_org(uuid), app_colony_municipality(uuid), app_cat_in_town_hall(uuid),
    app_register_association(text, text, text, text, text, text), app_accept_invitation(text),
    app_review_organization(uuid, text, text), app_set_colony_authorization(uuid, boolean),
    app_set_action_validation(uuid, boolean)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
    app_current_user_id(), app_is_platform_admin(), app_current_org(), app_active_org(),
    app_active_association(), app_is_active_admin(), app_is_admin_of(uuid),
    app_town_hall_municipality(), app_shares_org(uuid), app_colony_municipality(uuid),
    app_cat_in_town_hall(uuid),
    app_register_association(text, text, text, text, text, text), app_accept_invitation(text),
    app_review_organization(uuid, text, text), app_set_colony_authorization(uuid, boolean),
    app_set_action_validation(uuid, boolean), app_unaccent(text)
TO app_user;

-- ---------------------------------------------------------------------------
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_verifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipalities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE colonies                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cats                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_cats              ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_participants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_proposals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries  ENABLE ROW LEVEL SECURITY;

-- Personas: uno mismo, los compañeros de organización y el superadministrador.
GRANT SELECT (id, email, full_name, image, is_platform_admin, created_at) ON users TO app_user;
GRANT UPDATE (full_name) ON users TO app_user;
CREATE POLICY users_select ON users FOR SELECT TO app_user
    USING (id = app_current_user_id() OR app_shares_org(id) OR app_is_platform_admin());
CREATE POLICY users_update ON users FOR UPDATE TO app_user
    USING (id = app_current_user_id()) WITH CHECK (id = app_current_user_id());

GRANT SELECT ON municipalities TO app_user;
CREATE POLICY municipalities_read ON municipalities FOR SELECT TO app_user USING (true);

-- Organizaciones: la propia (en cualquier estado), las aprobadas para quien ya está
-- aprobado (nombres de asociaciones y ayuntamientos) y todas para el superadministrador.
GRANT SELECT ON organizations TO app_user;
GRANT INSERT ON organizations TO app_user;
GRANT UPDATE (name, tax_id, description, contact_email, contact_phone) ON organizations TO app_user;
GRANT DELETE ON organizations TO app_user;
CREATE POLICY organizations_select ON organizations FOR SELECT TO app_user
    USING (id = app_current_org()
           OR (status = 'approved' AND app_active_org() IS NOT NULL)
           OR app_is_platform_admin());
-- Los ayuntamientos no se registran: los da de alta el superadministrador.
CREATE POLICY organizations_insert ON organizations FOR INSERT TO app_user
    WITH CHECK (app_is_platform_admin() AND kind = 'town_hall');
CREATE POLICY organizations_update ON organizations FOR UPDATE TO app_user
    USING (app_is_admin_of(id) OR app_is_platform_admin())
    WITH CHECK (app_is_admin_of(id) OR app_is_platform_admin());
CREATE POLICY organizations_delete ON organizations FOR DELETE TO app_user
    USING (app_is_platform_admin());

-- Miembros: los ve su organización; el admin cambia roles y da de baja; cada cual
-- puede salir. El alta es solo por app_register_association / app_accept_invitation.
GRANT SELECT ON organization_members TO app_user;
GRANT UPDATE (role) ON organization_members TO app_user;
GRANT DELETE ON organization_members TO app_user;
CREATE POLICY organization_members_select ON organization_members FOR SELECT TO app_user
    USING (organization_id = app_current_org() OR app_is_platform_admin());
CREATE POLICY organization_members_update ON organization_members FOR UPDATE TO app_user
    USING (organization_id = app_active_org() AND app_is_active_admin())
    WITH CHECK (organization_id = app_active_org() AND app_is_active_admin());
CREATE POLICY organization_members_delete ON organization_members FOR DELETE TO app_user
    USING ((organization_id = app_active_org() AND app_is_active_admin())
           OR user_id = app_current_user_id());

-- Invitaciones: admins de la organización (aprobada) y superadministrador.
GRANT SELECT (id, organization_id, email, role, invited_by, expires_at, accepted_at, accepted_by,
              revoked_at, created_at) ON organization_invitations TO app_user;
GRANT INSERT ON organization_invitations TO app_user;
GRANT UPDATE (revoked_at) ON organization_invitations TO app_user;
CREATE POLICY organization_invitations_select ON organization_invitations FOR SELECT TO app_user
    USING ((organization_id = app_active_org() AND app_is_active_admin()) OR app_is_platform_admin());
CREATE POLICY organization_invitations_insert ON organization_invitations FOR INSERT TO app_user
    WITH CHECK (invited_by = app_current_user_id()
        AND accepted_at IS NULL AND accepted_by IS NULL AND revoked_at IS NULL AND (
        (organization_id = app_active_org() AND app_is_active_admin()) OR app_is_platform_admin()));
CREATE POLICY organization_invitations_update ON organization_invitations FOR UPDATE TO app_user
    USING ((organization_id = app_active_org() AND app_is_active_admin()) OR app_is_platform_admin())
    WITH CHECK ((organization_id = app_active_org() AND app_is_active_admin()) OR app_is_platform_admin());

-- Colonias: la asociación gestora (admins crean, editan y eliminan) y el ayuntamiento
-- del municipio (solo lectura; autoriza con app_set_colony_authorization).
GRANT SELECT ON colonies TO app_user;
GRANT INSERT ON colonies TO app_user;
GRANT UPDATE (name, description, latitude, longitude, municipality_code, address) ON colonies TO app_user;
GRANT DELETE ON colonies TO app_user;
CREATE POLICY colonies_select ON colonies FOR SELECT TO app_user
    USING (organization_id = app_active_association()
           OR municipality_code = app_town_hall_municipality());
CREATE POLICY colonies_insert ON colonies FOR INSERT TO app_user
    WITH CHECK (organization_id = app_active_association() AND app_is_active_admin()
                AND created_by = app_current_user_id()
                AND authorized_at IS NULL AND authorized_by IS NULL);
CREATE POLICY colonies_update ON colonies FOR UPDATE TO app_user
    USING (organization_id = app_active_association() AND app_is_active_admin())
    WITH CHECK (organization_id = app_active_association() AND app_is_active_admin());
CREATE POLICY colonies_delete ON colonies FOR DELETE TO app_user
    USING (organization_id = app_active_association() AND app_is_active_admin());

-- Gatos: cualquier miembro de la asociación los registra y edita; eliminan los admins o
-- quien lo registró. El ayuntamiento los ve si están en su municipio.
GRANT SELECT ON cats TO app_user;
GRANT INSERT ON cats TO app_user;
GRANT UPDATE (colony_id, name, sex, birth_date, birth_date_approximate, description, photo_key,
              latitude, longitude, municipality_code, address) ON cats TO app_user;
GRANT DELETE ON cats TO app_user;
CREATE POLICY cats_select ON cats FOR SELECT TO app_user
    USING (organization_id = app_active_association() OR app_cat_in_town_hall(id));
CREATE POLICY cats_insert ON cats FOR INSERT TO app_user
    WITH CHECK (organization_id = app_active_association() AND created_by = app_current_user_id());
CREATE POLICY cats_update ON cats FOR UPDATE TO app_user
    USING (organization_id = app_active_association())
    WITH CHECK (organization_id = app_active_association());
CREATE POLICY cats_delete ON cats FOR DELETE TO app_user
    USING (organization_id = app_active_association()
           AND (app_is_active_admin() OR created_by = app_current_user_id()));

-- Acciones: igual que los gatos; el ayuntamiento ve (y valida) las de su municipio.
GRANT SELECT ON actions TO app_user;
GRANT INSERT ON actions TO app_user;
GRANT UPDATE (colony_id, municipality_code, action_type, name, description, scheduled_at, is_urgent,
              status) ON actions TO app_user;
GRANT DELETE ON actions TO app_user;
CREATE POLICY actions_select ON actions FOR SELECT TO app_user
    USING (organization_id = app_active_association()
           OR municipality_code = app_town_hall_municipality());
CREATE POLICY actions_insert ON actions FOR INSERT TO app_user
    WITH CHECK (organization_id = app_active_association() AND created_by = app_current_user_id()
                AND validated_at IS NULL AND validated_by IS NULL);
CREATE POLICY actions_update ON actions FOR UPDATE TO app_user
    USING (organization_id = app_active_association())
    WITH CHECK (organization_id = app_active_association());
CREATE POLICY actions_delete ON actions FOR DELETE TO app_user
    USING (organization_id = app_active_association()
           AND (app_is_active_admin() OR created_by = app_current_user_id()));

-- Gatos y participantes de una acción: visibles si la acción lo es; los gestiona la
-- asociación de la acción.
GRANT SELECT, INSERT, DELETE ON action_cats, action_participants TO app_user;
CREATE POLICY action_cats_select ON action_cats FOR SELECT TO app_user
    USING (EXISTS (SELECT 1 FROM actions a WHERE a.id = action_id));
CREATE POLICY action_cats_write ON action_cats FOR INSERT TO app_user
    WITH CHECK (EXISTS (SELECT 1 FROM actions a WHERE a.id = action_id
                        AND a.organization_id = app_active_association()));
CREATE POLICY action_cats_delete ON action_cats FOR DELETE TO app_user
    USING (EXISTS (SELECT 1 FROM actions a WHERE a.id = action_id
                   AND a.organization_id = app_active_association()));
CREATE POLICY action_participants_select ON action_participants FOR SELECT TO app_user
    USING (EXISTS (SELECT 1 FROM actions a WHERE a.id = action_id));
CREATE POLICY action_participants_write ON action_participants FOR INSERT TO app_user
    WITH CHECK (EXISTS (SELECT 1 FROM actions a WHERE a.id = action_id
                        AND a.organization_id = app_active_association()));
CREATE POLICY action_participants_delete ON action_participants FOR DELETE TO app_user
    USING (EXISTS (SELECT 1 FROM actions a WHERE a.id = action_id
                   AND a.organization_id = app_active_association()));

-- Propuestas de cambio: las crea el ayuntamiento sobre elementos de su municipio; las
-- resuelven los admins de la asociación gestora; quien propone puede retirarlas.
GRANT SELECT ON change_proposals TO app_user;
GRANT INSERT ON change_proposals TO app_user;
GRANT UPDATE (status, resolution_note, resolved_at, resolved_by) ON change_proposals TO app_user;
CREATE POLICY change_proposals_select ON change_proposals FOR SELECT TO app_user
    USING (target_organization_id = app_active_org() OR proposed_by_organization_id = app_active_org());
CREATE POLICY change_proposals_insert ON change_proposals FOR INSERT TO app_user
    WITH CHECK (
        proposed_by_organization_id = app_active_org()
        AND proposed_by = app_current_user_id()
        AND status = 'pending'
        AND resolved_at IS NULL AND resolved_by IS NULL AND resolution_note IS NULL
        AND app_town_hall_municipality() IS NOT NULL
        AND ((target_type = 'colony' AND app_colony_municipality(colony_id) = app_town_hall_municipality())
             OR (target_type = 'cat' AND app_cat_in_town_hall(cat_id)))
    );
CREATE POLICY change_proposals_resolve ON change_proposals FOR UPDATE TO app_user
    USING (status = 'pending' AND target_organization_id = app_active_association() AND app_is_active_admin())
    WITH CHECK (status IN ('accepted', 'rejected') AND resolved_by = app_current_user_id()
                AND target_organization_id = app_active_association() AND app_is_active_admin());
CREATE POLICY change_proposals_withdraw ON change_proposals FOR UPDATE TO app_user
    USING (status = 'pending' AND proposed_by_organization_id = app_active_org())
    WITH CHECK (status = 'withdrawn' AND proposed_by_organization_id = app_active_org());

-- Envíos: cada persona ve los suyos; los escribe el worker.
GRANT SELECT ON notification_deliveries TO app_user;
CREATE POLICY notification_deliveries_select ON notification_deliveries FOR SELECT TO app_user
    USING (user_id = app_current_user_id());
