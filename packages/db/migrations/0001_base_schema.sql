-- MVP de plataforma de licitaciones públicas (España)
-- PostgreSQL 14+; UUID por defecto con pgcrypto.
-- Nota: si usas Supabase Auth, enlaza public.users.id con auth.users.id,
-- y aplica políticas RLS por membresía en la aplicación.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Personas: la autenticación/passwords se gestiona fuera de este esquema.
CREATE TABLE users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               text NOT NULL,
    full_name           text,
    locale              text NOT NULL DEFAULT 'es',
    timezone            text NOT NULL DEFAULT 'Europe/Madrid',
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_ci_uq ON users (lower(email));

-- 2. Empresas (el cliente que paga y configura alertas).
CREATE TABLE companies (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name          text NOT NULL,
    display_name        text,
    tax_id              text,    -- Opcional: NO solicitar al registrarse si no es necesario.
    business_description text,
    company_type        text,    -- autonomo / sociedad / otro (catálogo en la app).
    base_province_code  char(2), -- Código oficial INE (texto, preserva ceros).
    base_municipality   text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 3. Varios usuarios por empresa; una persona puede estar en varias empresas.
CREATE TABLE company_members (
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                text NOT NULL DEFAULT 'member'
                        CHECK (role IN ('owner','admin','member')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, user_id)
);
CREATE INDEX company_members_user_idx ON company_members (user_id);

-- 4. Perfiles de alertas: una empresa puede tener muchos.
CREATE TABLE alert_profiles (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name                text NOT NULL,
    service_description text NOT NULL,   -- Descripción en lenguaje natural.
    cpv_codes           text[] NOT NULL DEFAULT '{}', -- CPV como texto (ceros iniciales).
    include_keywords    text[] NOT NULL DEFAULT '{}',
    exclude_keywords    text[] NOT NULL DEFAULT '{}',
    province_codes      text[] NOT NULL DEFAULT '{}', -- Territorio de ejecución.
    nationwide          boolean NOT NULL DEFAULT false,
    contract_types      text[] NOT NULL DEFAULT '{}', -- obras/servicios/suministros...
    min_budget_eur      numeric(16,2) CHECK (min_budget_eur >= 0),
    max_budget_eur      numeric(16,2) CHECK (max_budget_eur >= 0),
    email_frequency     text NOT NULL DEFAULT 'daily'
                        CHECK (email_frequency IN ('instant','daily','weekly','off')),
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT alert_profiles_budget_order_ck CHECK (
        min_budget_eur IS NULL OR max_budget_eur IS NULL
        OR min_budget_eur <= max_budget_eur
    )
);
CREATE INDEX alert_profiles_company_idx ON alert_profiles (company_id, is_active);

-- 5. Órganos de contratación: no confundir con el municipio de ejecución.
CREATE TABLE contracting_authorities (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    placsp_authority_id text,             -- Si está disponible.
    tax_id              text,
    administration_type text,             -- Ayuntamiento, Diputación, etc.
    province_code       char(2),
    municipality        text,
    parent_authority_id uuid REFERENCES contracting_authorities(id),
    profile_url         text,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contracting_authorities_placsp_idx
    ON contracting_authorities (placsp_authority_id)
    WHERE placsp_authority_id IS NOT NULL;
CREATE INDEX contracting_authorities_parent_idx ON contracting_authorities (parent_authority_id);

-- 6. Expedientes normalizados: un expediente puede tener N fuentes y N lotes.
CREATE TABLE tenders (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id        uuid REFERENCES contracting_authorities(id),
    expediente_number   text,  -- No es globalmente único.
    title               text NOT NULL,
    description         text,
    contract_type       text,  -- works/services/supplies/concession/other
    procedure_type      text,
    status              text NOT NULL DEFAULT 'unknown'
                        CHECK (status IN ('planned','open','closed','awarded',
                                         'formalized','cancelled','suspended','unknown')),
    main_cpv_code       text,
    cpv_codes           text[] NOT NULL DEFAULT '{}',
    execution_provinces text[] NOT NULL DEFAULT '{}',
    execution_municipality text,
    base_budget_ex_vat_eur numeric(16,2) CHECK (base_budget_ex_vat_eur >= 0),
    estimated_value_eur numeric(16,2) CHECK (estimated_value_eur >= 0),
    first_published_at  timestamptz,
    submission_deadline_at timestamptz,
    primary_official_url text,
    raw_summary         jsonb NOT NULL DEFAULT '{}'::jsonb,
    first_seen_at       timestamptz NOT NULL DEFAULT now(),
    last_seen_at        timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tenders_status_deadline_idx ON tenders (status, submission_deadline_at);
CREATE INDEX tenders_authority_idx ON tenders (authority_id);
CREATE INDEX tenders_cpv_gin_idx ON tenders USING gin (cpv_codes);
CREATE INDEX tenders_execution_provinces_gin_idx ON tenders USING gin (execution_provinces);
CREATE INDEX tenders_fulltext_idx ON tenders USING gin (
    to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(description,''))
);

-- 7. Lotes: puede existir un lote con CPV, importe y plazo propios.
CREATE TABLE tender_lots (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id           uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    source_lot_code     text NOT NULL, -- Ej. "1", "LOT-0001".
    title               text,
    description         text,
    cpv_codes           text[] NOT NULL DEFAULT '{}',
    execution_provinces text[] NOT NULL DEFAULT '{}',
    base_budget_ex_vat_eur numeric(16,2) CHECK (base_budget_ex_vat_eur >= 0),
    estimated_value_eur numeric(16,2) CHECK (estimated_value_eur >= 0),
    submission_deadline_at timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tender_id, source_lot_code)
);
CREATE INDEX tender_lots_tender_idx ON tender_lots (tender_id);
CREATE INDEX tender_lots_cpv_gin_idx ON tender_lots USING gin (cpv_codes);

-- 8. Procedencia: una licitación puede venir de PLACSP, una CA y TED.
CREATE TABLE tender_sources (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id           uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    source_platform     text NOT NULL, -- placsp_direct, placsp_aggregated, ted, catalunya...
    external_record_id  text NOT NULL, -- ID estable EN ESA fuente.
    official_url        text NOT NULL,
    source_updated_at   timestamptz,
    first_seen_at       timestamptz NOT NULL DEFAULT now(),
    last_seen_at        timestamptz NOT NULL DEFAULT now(),
    raw_payload         jsonb, -- Para cargas grandes, guardar fichero bruto en object storage.
    UNIQUE (source_platform, external_record_id)
);
CREATE INDEX tender_sources_tender_idx ON tender_sources (tender_id);

-- 9. Avisos: ampliación, corrección, suspensión, adjudicación...
CREATE TABLE tender_events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id           uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    tender_source_id    uuid REFERENCES tender_sources(id) ON DELETE SET NULL,
    external_notice_id  text, -- ID por anuncio/version si lo publica la fuente.
    event_type          text NOT NULL,
    headline            text,
    details             text,
    effective_at        timestamptz,
    official_url        text,
    payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tender_events_external_notice_uq
    ON tender_events (tender_source_id, external_notice_id)
    WHERE tender_source_id IS NOT NULL AND external_notice_id IS NOT NULL;
CREATE INDEX tender_events_tender_idx ON tender_events (tender_id, effective_at DESC);

-- 10. Resultados del matching. El score NO es elegibilidad legal.
CREATE TABLE tender_matches (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_profile_id    uuid NOT NULL REFERENCES alert_profiles(id) ON DELETE CASCADE,
    tender_id           uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    score               numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
    match_reason        text,
    matched_lot_codes   text[] NOT NULL DEFAULT '{}',
    feedback            text CHECK (feedback IN ('relevant','irrelevant')),
    calculated_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (alert_profile_id, tender_id)
);
CREATE INDEX tender_matches_alert_score_idx ON tender_matches (alert_profile_id, score DESC);

-- 11. Seguimiento interno: independiente del estado oficial del expediente.
CREATE TABLE tracked_tenders (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tender_id           uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    assigned_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
    workflow_status     text NOT NULL DEFAULT 'saved'
                        CHECK (workflow_status IN ('saved','evaluating','preparing',
                                                  'submitted','won','lost','archived')),
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, tender_id)
);
CREATE INDEX tracked_tenders_company_status_idx ON tracked_tenders (company_id, workflow_status);

-- 12. Lista de tareas/documentos por licitación seguida.
CREATE TABLE tender_tasks (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tracked_tender_id   uuid NOT NULL REFERENCES tracked_tenders(id) ON DELETE CASCADE,
    assigned_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
    title               text NOT NULL,
    description         text,
    due_at              timestamptz,
    completed_at        timestamptz,
    origin              text NOT NULL DEFAULT 'manual'
                        CHECK (origin IN ('manual','template','ai_suggested')),
    source_reference    text, -- Página/cláusula o URL de documentación oficial.
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tender_tasks_due_idx ON tender_tasks (due_at) WHERE completed_at IS NULL;
CREATE INDEX tender_tasks_tracking_idx ON tender_tasks (tracked_tender_id);

-- 13. Entregas de notificaciones: idempotencia para evitar duplicados.
CREATE TABLE notification_deliveries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    alert_profile_id    uuid REFERENCES alert_profiles(id) ON DELETE SET NULL,
    tender_id           uuid REFERENCES tenders(id) ON DELETE SET NULL,
    tender_event_id     uuid REFERENCES tender_events(id) ON DELETE SET NULL,
    notification_type   text NOT NULL, -- new_match, amendment, deadline...
    channel             text NOT NULL DEFAULT 'email'
                        CHECK (channel IN ('email','in_app')),
    dedupe_key          text NOT NULL UNIQUE,
    status              text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','sent','failed','cancelled')),
    scheduled_at        timestamptz NOT NULL DEFAULT now(),
    sent_at             timestamptz,
    provider_message_id text,
    error_message       text
);
CREATE INDEX notification_deliveries_queue_idx
    ON notification_deliveries (scheduled_at) WHERE status = 'queued';
CREATE INDEX notification_deliveries_company_idx ON notification_deliveries (company_id, scheduled_at DESC);

-- 14. Facturación opcional para MVP de pago (€9 / €29). No almacenar tarjetas.
CREATE TABLE company_subscriptions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    plan_code           text NOT NULL DEFAULT 'free',
    status              text NOT NULL DEFAULT 'inactive',
    billing_provider    text, -- stripe, etc.
    external_customer_id text,
    external_subscription_id text,
    current_period_end  timestamptz,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMIT;
