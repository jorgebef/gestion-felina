-- 0005 · Procedencia de las importaciones: cada página descargada de la fuente.
--
-- Guarda URL, huella SHA-256 y tamaño de cada documento recibido y, si hay
-- almacenamiento de objetos (S3 compatible) configurado, la clave del original
-- archivado. Permite auditar o volver a procesar una importación sin descargarla
-- de nuevo. Es una tabla interna: el rol app_user no tiene ningún permiso sobre ella.

CREATE TABLE import_run_pages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    import_run_id   uuid NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
    page_number     integer NOT NULL CHECK (page_number > 0),
    source_url      text NOT NULL,
    content_sha256  text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    byte_size       integer NOT NULL CHECK (byte_size >= 0),
    storage_key     text,
    fetched_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX import_run_pages_run_page_uq ON import_run_pages (import_run_id, page_number);

ALTER TABLE import_run_pages ENABLE ROW LEVEL SECURITY;
