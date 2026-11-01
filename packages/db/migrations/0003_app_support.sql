-- 0003 · Campos, índices y tablas auxiliares necesarias para el MVP.
-- Solo se AÑADEN estructuras; no se renombra ni elimina nada del esquema base.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() es STABLE; este envoltorio IMMUTABLE permite usarlo en columnas
-- generadas e índices (patrón habitual; el diccionario se fija explícitamente).
CREATE OR REPLACE FUNCTION app_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT unaccent('unaccent'::regdictionary, $1) $$;

-- ---------------------------------------------------------------------------
-- Búsqueda de licitaciones insensible a tildes ("construccion" = "construcción").
-- El índice tenders_fulltext_idx del esquema base se conserva.
ALTER TABLE tenders ADD COLUMN search_document tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', app_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('spanish', app_unaccent(coalesce(description, ''))), 'B') ||
    setweight(to_tsvector('simple', coalesce(expediente_number, '')), 'C')
) STORED;
CREATE INDEX tenders_search_document_idx ON tenders USING gin (search_document);
CREATE INDEX tenders_published_idx ON tenders (first_published_at DESC NULLS LAST);
CREATE INDEX tenders_budget_idx ON tenders (base_budget_ex_vat_eur);

-- ---------------------------------------------------------------------------
-- Perfiles de alerta: sectores/actividades elegidos en lenguaje natural.
ALTER TABLE alert_profiles ADD COLUMN sectors text[] NOT NULL DEFAULT '{}';

-- Coincidencias: `calculated_at` cambia en cada recálculo; `first_matched_at`
-- permite saber qué oportunidades son realmente nuevas.
ALTER TABLE tender_matches ADD COLUMN first_matched_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX tender_matches_tender_idx ON tender_matches (tender_id);

-- Notificaciones: reintentos acotados de envíos fallidos.
ALTER TABLE notification_deliveries
    ADD COLUMN attempt_count   integer NOT NULL DEFAULT 0,
    ADD COLUMN last_attempt_at timestamptz;
CREATE INDEX notification_deliveries_retry_idx
    ON notification_deliveries (last_attempt_at) WHERE status = 'failed';

-- ---------------------------------------------------------------------------
-- Auditoría de importaciones (una fila por ejecución de un conector).
CREATE TABLE import_runs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connector           text NOT NULL,              -- p. ej. placsp_direct
    source_url          text NOT NULL,
    triggered_by        text NOT NULL DEFAULT 'cli', -- cli / cron / http
    status              text NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','succeeded','partial','failed')),
    started_at          timestamptz NOT NULL DEFAULT now(),
    finished_at         timestamptz,
    pages_fetched       integer NOT NULL DEFAULT 0,
    entries_seen        integer NOT NULL DEFAULT 0,
    tenders_created     integer NOT NULL DEFAULT 0,
    tenders_updated     integer NOT NULL DEFAULT 0,
    tenders_unchanged   integer NOT NULL DEFAULT 0,
    events_created      integer NOT NULL DEFAULT 0,
    errors_count        integer NOT NULL DEFAULT 0,
    errors              jsonb NOT NULL DEFAULT '[]'::jsonb, -- Muestra acotada de errores.
    -- Marca de agua: `updated` más reciente procesado; la siguiente ejecución
    -- incremental se detiene al alcanzarla.
    high_water_mark     timestamptz,
    message             text
);
CREATE INDEX import_runs_connector_idx ON import_runs (connector, started_at DESC);

-- ---------------------------------------------------------------------------
-- Catálogo CPV 2008 oficial (lista CODICE de PLACSP), para selector y sugerencias.
CREATE TABLE cpv_codes (
    code                text PRIMARY KEY CHECK (code ~ '^[0-9]{8}$'),
    label_es            text NOT NULL,
    search_document     tsvector GENERATED ALWAYS AS (
                            to_tsvector('spanish', app_unaccent(label_es))
                        ) STORED
);
CREATE INDEX cpv_codes_search_idx ON cpv_codes USING gin (search_document);

-- ---------------------------------------------------------------------------
-- updated_at automático.
CREATE OR REPLACE FUNCTION app_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER users_touch BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER companies_touch BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER alert_profiles_touch BEFORE UPDATE ON alert_profiles
    FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER tracked_tenders_touch BEFORE UPDATE ON tracked_tenders
    FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER company_subscriptions_touch BEFORE UPDATE ON company_subscriptions
    FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
