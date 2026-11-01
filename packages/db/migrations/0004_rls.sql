-- 0004 · Aislamiento entre empresas con Row Level Security.
--
-- Modelo:
--   * El servidor web abre una transacción por petición autenticada, ejecuta
--     `SET LOCAL ROLE app_user` y fija `app.user_id` con el id del usuario de la
--     sesión (ver src/db/tenant.ts). Todas las políticas se evalúan contra ese id.
--   * Los procesos internos (importación, matching, notificaciones) y Better Auth
--     usan el rol propietario de la base de datos, que no está sujeto a RLS.
--   * app_user no tiene permisos de escritura sobre membresías ni suscripciones:
--     no es posible autoconcederse el rol owner/admin ni cambiar el plan desde el
--     navegador. La única vía para crear empresa + membresía es app_create_company().

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN;
    END IF;
END $$;
-- El rol de conexión de la aplicación debe poder hacer SET ROLE app_user.
GRANT app_user TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO app_user;

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- SECURITY DEFINER evita la recursión de políticas al consultar company_members.
CREATE OR REPLACE FUNCTION app_is_member(target_company uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM company_members
            WHERE company_id = target_company AND user_id = app_current_user_id()
        )
    $$;

CREATE OR REPLACE FUNCTION app_has_role(target_company uuid, roles text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM company_members
            WHERE company_id = target_company AND user_id = app_current_user_id()
              AND role = ANY (roles)
        )
    $$;

CREATE OR REPLACE FUNCTION app_is_member_user(target_company uuid, target_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT app_is_member(target_company) AND EXISTS (
            SELECT 1 FROM company_members
            WHERE company_id = target_company AND user_id = target_user
        )
    $$;

CREATE OR REPLACE FUNCTION app_shares_company(target_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM company_members mine
            JOIN company_members theirs ON theirs.company_id = mine.company_id
            WHERE mine.user_id = app_current_user_id() AND theirs.user_id = target_user
        )
    $$;

CREATE OR REPLACE FUNCTION app_profile_company(target_profile uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$ SELECT company_id FROM alert_profiles WHERE id = target_profile $$;

CREATE OR REPLACE FUNCTION app_tracked_company(target_tracked uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$ SELECT company_id FROM tracked_tenders WHERE id = target_tracked $$;

-- Onboarding: crea empresa, membresía owner del usuario actual y plan Free.
CREATE OR REPLACE FUNCTION app_create_company(
    p_legal_name text,
    p_display_name text,
    p_business_description text,
    p_company_type text,
    p_base_province_code text,
    p_base_municipality text,
    p_tax_id text
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
DECLARE
    v_user uuid := app_current_user_id();
    v_company uuid;
BEGIN
    IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE id = v_user) THEN
        RAISE EXCEPTION 'app_create_company: no authenticated user' USING ERRCODE = '42501';
    END IF;
    INSERT INTO companies (legal_name, display_name, business_description, company_type,
                           base_province_code, base_municipality, tax_id)
    VALUES (p_legal_name, p_display_name, p_business_description, p_company_type,
            p_base_province_code, p_base_municipality, p_tax_id)
    RETURNING id INTO v_company;
    INSERT INTO company_members (company_id, user_id, role) VALUES (v_company, v_user, 'owner');
    INSERT INTO company_subscriptions (company_id, plan_code, status)
    VALUES (v_company, 'free', 'active');
    RETURN v_company;
END $$;

REVOKE ALL ON FUNCTION app_is_member(uuid), app_has_role(uuid, text[]),
    app_is_member_user(uuid, uuid), app_shares_company(uuid), app_profile_company(uuid),
    app_tracked_company(uuid),
    app_create_company(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_user_id(), app_is_member(uuid), app_has_role(uuid, text[]),
    app_is_member_user(uuid, uuid), app_shares_company(uuid), app_profile_company(uuid),
    app_tracked_company(uuid),
    app_create_company(text, text, text, text, text, text, text) TO app_user;

-- ---------------------------------------------------------------------------
-- Activar RLS en todas las tablas de la aplicación.
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracting_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_lots             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_matches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_tenders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_runs             ENABLE ROW LEVEL SECURITY;
-- Tablas de Better Auth: RLS sin políticas ni permisos → inaccesibles para app_user.
ALTER TABLE auth_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_verifications      ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Personas: cada usuario ve su ficha y la de sus compañeros de empresa; solo
-- edita sus preferencias. El email lo gestiona Better Auth.
GRANT SELECT (id, email, full_name, locale, timezone, image, created_at) ON users TO app_user;
GRANT UPDATE (full_name, locale, timezone) ON users TO app_user;
CREATE POLICY users_select ON users FOR SELECT TO app_user
    USING (id = app_current_user_id() OR app_shares_company(id));
CREATE POLICY users_update ON users FOR UPDATE TO app_user
    USING (id = app_current_user_id()) WITH CHECK (id = app_current_user_id());

-- Empresas: lectura para miembros; edición para owner/admin.
GRANT SELECT ON companies TO app_user;
GRANT UPDATE (legal_name, display_name, tax_id, business_description, company_type,
              base_province_code, base_municipality) ON companies TO app_user;
CREATE POLICY companies_select ON companies FOR SELECT TO app_user
    USING (app_is_member(id));
CREATE POLICY companies_update ON companies FOR UPDATE TO app_user
    USING (app_has_role(id, ARRAY['owner','admin']))
    WITH CHECK (app_has_role(id, ARRAY['owner','admin']));

-- Membresías: solo lectura (las invitaciones futuras irán por funciones definer).
GRANT SELECT ON company_members TO app_user;
CREATE POLICY company_members_select ON company_members FOR SELECT TO app_user
    USING (app_is_member(company_id));

-- Perfiles de alerta: CRUD completo dentro de la propia empresa.
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_profiles TO app_user;
CREATE POLICY alert_profiles_all ON alert_profiles FOR ALL TO app_user
    USING (app_is_member(company_id)) WITH CHECK (app_is_member(company_id));

-- Datos públicos de contratación: lectura para todos, sin escritura.
GRANT SELECT ON contracting_authorities, tenders, tender_lots, tender_sources,
               tender_events, cpv_codes TO app_user;
CREATE POLICY contracting_authorities_read ON contracting_authorities FOR SELECT TO app_user USING (true);
CREATE POLICY tenders_read ON tenders FOR SELECT TO app_user USING (true);
CREATE POLICY tender_lots_read ON tender_lots FOR SELECT TO app_user USING (true);
CREATE POLICY tender_sources_read ON tender_sources FOR SELECT TO app_user USING (true);
CREATE POLICY tender_events_read ON tender_events FOR SELECT TO app_user USING (true);

-- Estado de importación: metadatos operativos sin datos de clientes.
GRANT SELECT ON import_runs TO app_user;
CREATE POLICY import_runs_read ON import_runs FOR SELECT TO app_user USING (true);

-- Coincidencias: las genera el motor; el cliente solo puede valorarlas.
GRANT SELECT ON tender_matches TO app_user;
GRANT UPDATE (feedback) ON tender_matches TO app_user;
CREATE POLICY tender_matches_select ON tender_matches FOR SELECT TO app_user
    USING (app_is_member(app_profile_company(alert_profile_id)));
CREATE POLICY tender_matches_feedback ON tender_matches FOR UPDATE TO app_user
    USING (app_is_member(app_profile_company(alert_profile_id)))
    WITH CHECK (app_is_member(app_profile_company(alert_profile_id)));

-- Seguimiento privado. El responsable asignado debe pertenecer a la empresa.
GRANT SELECT, INSERT, DELETE ON tracked_tenders TO app_user;
GRANT UPDATE (assigned_user_id, workflow_status, notes) ON tracked_tenders TO app_user;
CREATE POLICY tracked_tenders_all ON tracked_tenders FOR ALL TO app_user
    USING (app_is_member(company_id))
    WITH CHECK (
        app_is_member(company_id)
        AND (assigned_user_id IS NULL OR app_is_member_user(company_id, assigned_user_id))
    );

GRANT SELECT, INSERT, DELETE ON tender_tasks TO app_user;
GRANT UPDATE (assigned_user_id, title, description, due_at, completed_at, source_reference)
    ON tender_tasks TO app_user;
CREATE POLICY tender_tasks_all ON tender_tasks FOR ALL TO app_user
    USING (app_is_member(app_tracked_company(tracked_tender_id)))
    WITH CHECK (
        app_is_member(app_tracked_company(tracked_tender_id))
        AND (assigned_user_id IS NULL
             OR app_is_member_user(app_tracked_company(tracked_tender_id), assigned_user_id))
    );

-- Notificaciones: cada persona ve las suyas; las escribe solo el proceso interno.
GRANT SELECT ON notification_deliveries TO app_user;
CREATE POLICY notification_deliveries_select ON notification_deliveries FOR SELECT TO app_user
    USING (user_id = app_current_user_id() AND app_is_member(company_id));

-- Suscripción: solo lectura desde la aplicación.
GRANT SELECT ON company_subscriptions TO app_user;
CREATE POLICY company_subscriptions_select ON company_subscriptions FOR SELECT TO app_user
    USING (app_is_member(company_id));
