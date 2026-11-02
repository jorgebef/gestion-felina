-- 0005 · Gestores de colonia y eliminaciones validadas.
--
--   * Cada colonia puede tener gestores: miembros de la asociación que la editan y
--     registran o editan sus gatos. Los administradores son gestores de todas.
--     El resto de miembros ve las colonias, pero no las modifica ni toca sus gatos.
--   * Los gatos sin colonia y las acciones los sigue gestionando cualquier miembro.
--   * Eliminar colonias, gatos o acciones es cosa de los administradores. El resto
--     (gestores y miembros, según lo que puedan editar) solicita la eliminación, que
--     queda pendiente hasta que un administrador la apruebe o la rechace.

-- ---------------------------------------------------------------------------
-- Gestores de colonia

CREATE TABLE colony_managers (
    colony_id   uuid NOT NULL REFERENCES colonies(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (colony_id, user_id)
);
CREATE INDEX colony_managers_user_idx ON colony_managers (user_id);

-- Solo miembros de la asociación de la colonia.
CREATE OR REPLACE FUNCTION app_check_colony_manager_member() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM colonies c
        JOIN organization_members m ON m.organization_id = c.organization_id
        WHERE c.id = NEW.colony_id AND m.user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'colony managers must belong to the colony''s association'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER colony_managers_member BEFORE INSERT OR UPDATE ON colony_managers
    FOR EACH ROW EXECUTE FUNCTION app_check_colony_manager_member();

-- Quien deja la asociación deja de gestionar sus colonias.
CREATE OR REPLACE FUNCTION app_drop_colony_managers_of_member() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM colony_managers cm USING colonies c
    WHERE cm.colony_id = c.id AND c.organization_id = OLD.organization_id
      AND cm.user_id = OLD.user_id;
    RETURN OLD;
END $$;
CREATE TRIGGER organization_members_drop_colony_managers AFTER DELETE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION app_drop_colony_managers_of_member();

-- Puede gestionar la colonia: es de su asociación (aprobada) y es admin o gestor.
CREATE OR REPLACE FUNCTION app_can_manage_colony(target_colony uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM colonies c
            WHERE c.id = target_colony AND c.organization_id = app_active_association()
              AND (app_is_active_admin() OR EXISTS (
                  SELECT 1 FROM colony_managers cm
                  WHERE cm.colony_id = c.id AND cm.user_id = app_current_user_id()))
        )
    $$;

-- Puede editar el gato: es de su asociación y no tiene colonia o gestiona su colonia.
CREATE OR REPLACE FUNCTION app_can_edit_cat(target_cat uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM cats c
            WHERE c.id = target_cat AND c.organization_id = app_active_association()
              AND (c.colony_id IS NULL OR app_can_manage_colony(c.colony_id))
        )
    $$;

-- Una castración realizada marca sus gatos como castrados aunque quien la complete no
-- gestione sus colonias (las acciones son de cualquier miembro). Devuelve cuántos cambian.
CREATE OR REPLACE FUNCTION app_mark_action_cats_sterilized(p_action uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM actions
                   WHERE id = p_action AND organization_id = app_active_association()) THEN
        RAISE EXCEPTION 'action not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE cats SET sterilized = true
    WHERE sterilized = false AND id IN (
        SELECT ac.cat_id FROM action_cats ac JOIN actions a ON a.id = ac.action_id
        WHERE ac.action_id = p_action AND a.action_type = 'sterilization' AND a.status = 'done');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END $$;

-- ---------------------------------------------------------------------------
-- Solicitudes de eliminación

CREATE TABLE deletion_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_type     text NOT NULL CHECK (target_type IN ('colony', 'cat', 'action')),
    -- Se vacían al eliminar el elemento; `target_label` conserva su nombre en el historial.
    colony_id       uuid REFERENCES colonies(id) ON DELETE SET NULL,
    cat_id          uuid REFERENCES cats(id) ON DELETE SET NULL,
    action_id       uuid REFERENCES actions(id) ON DELETE SET NULL,
    target_label    text NOT NULL,
    reason          text,
    requested_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    resolution_note text,
    resolved_at     timestamptz,
    resolved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT deletion_requests_target_ck CHECK (
        (target_type = 'colony' AND cat_id IS NULL AND action_id IS NULL) OR
        (target_type = 'cat' AND colony_id IS NULL AND action_id IS NULL) OR
        (target_type = 'action' AND colony_id IS NULL AND cat_id IS NULL)
    ),
    -- Una solicitud pendiente siempre apunta a un elemento que existe.
    CONSTRAINT deletion_requests_pending_target_ck CHECK (
        status <> 'pending' OR num_nonnulls(colony_id, cat_id, action_id) = 1
    )
);
CREATE INDEX deletion_requests_org_idx ON deletion_requests (organization_id, status, created_at DESC);
-- Como mucho una solicitud pendiente por elemento.
CREATE UNIQUE INDEX deletion_requests_pending_colony_uq ON deletion_requests (colony_id)
    WHERE status = 'pending';
CREATE UNIQUE INDEX deletion_requests_pending_cat_uq ON deletion_requests (cat_id)
    WHERE status = 'pending';
CREATE UNIQUE INDEX deletion_requests_pending_action_uq ON deletion_requests (action_id)
    WHERE status = 'pending';

-- Al eliminar el elemento (lo hace un administrador, aprobando o directamente), sus
-- solicitudes pendientes quedan aprobadas por esa persona.
CREATE OR REPLACE FUNCTION app_approve_deletion_requests() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE deletion_requests
    SET status = 'approved', resolved_at = now(), resolved_by = app_current_user_id()
    WHERE status = 'pending' AND CASE TG_TABLE_NAME
        WHEN 'colonies' THEN colony_id = OLD.id
        WHEN 'cats' THEN cat_id = OLD.id
        ELSE action_id = OLD.id END;
    RETURN OLD;
END $$;
CREATE TRIGGER colonies_approve_deletion_requests BEFORE DELETE ON colonies
    FOR EACH ROW EXECUTE FUNCTION app_approve_deletion_requests();
CREATE TRIGGER cats_approve_deletion_requests BEFORE DELETE ON cats
    FOR EACH ROW EXECUTE FUNCTION app_approve_deletion_requests();
CREATE TRIGGER actions_approve_deletion_requests BEFORE DELETE ON actions
    FOR EACH ROW EXECUTE FUNCTION app_approve_deletion_requests();

REVOKE ALL ON FUNCTION
    app_can_manage_colony(uuid), app_can_edit_cat(uuid), app_mark_action_cats_sterilized(uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
    app_can_manage_colony(uuid), app_can_edit_cat(uuid), app_mark_action_cats_sterilized(uuid)
TO app_user;

-- ---------------------------------------------------------------------------
-- Permisos

ALTER TABLE colony_managers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

-- Gestores: los ve la asociación de la colonia; los asignan y quitan sus administradores.
GRANT SELECT, INSERT, DELETE ON colony_managers TO app_user;
CREATE POLICY colony_managers_select ON colony_managers FOR SELECT TO app_user
    USING (EXISTS (SELECT 1 FROM colonies c
                   WHERE c.id = colony_id AND c.organization_id = app_active_association()));
CREATE POLICY colony_managers_insert ON colony_managers FOR INSERT TO app_user
    WITH CHECK (app_is_active_admin() AND added_by = app_current_user_id()
                AND EXISTS (SELECT 1 FROM colonies c
                            WHERE c.id = colony_id AND c.organization_id = app_active_association()));
CREATE POLICY colony_managers_delete ON colony_managers FOR DELETE TO app_user
    USING (app_is_active_admin()
           AND EXISTS (SELECT 1 FROM colonies c
                       WHERE c.id = colony_id AND c.organization_id = app_active_association()));

-- Colonias: las editan sus gestores (y los admins); solo los admins las eliminan.
DROP POLICY colonies_update ON colonies;
CREATE POLICY colonies_update ON colonies FOR UPDATE TO app_user
    USING (organization_id = app_active_association() AND app_can_manage_colony(id))
    WITH CHECK (organization_id = app_active_association() AND app_can_manage_colony(id));

-- Gatos: los de una colonia, solo sus gestores (y los admins); los sueltos, cualquier
-- miembro. Solo los admins los eliminan.
DROP POLICY cats_insert ON cats;
CREATE POLICY cats_insert ON cats FOR INSERT TO app_user
    WITH CHECK (organization_id = app_active_association() AND created_by = app_current_user_id()
                AND (colony_id IS NULL OR app_can_manage_colony(colony_id)));
DROP POLICY cats_update ON cats;
CREATE POLICY cats_update ON cats FOR UPDATE TO app_user
    USING (organization_id = app_active_association()
           AND (colony_id IS NULL OR app_can_manage_colony(colony_id)))
    WITH CHECK (organization_id = app_active_association()
                AND (colony_id IS NULL OR app_can_manage_colony(colony_id)));
DROP POLICY cats_delete ON cats;
CREATE POLICY cats_delete ON cats FOR DELETE TO app_user
    USING (organization_id = app_active_association() AND app_is_active_admin());

-- Acciones: cualquier miembro las crea y edita; solo los admins las eliminan.
DROP POLICY actions_delete ON actions;
CREATE POLICY actions_delete ON actions FOR DELETE TO app_user
    USING (organization_id = app_active_association() AND app_is_active_admin());

-- Solicitudes de eliminación: las ve toda la asociación. Las crea quien puede editar el
-- elemento (y no es admin: los admins eliminan directamente); las resuelven los admins;
-- quien la pidió puede retirarla mientras está pendiente.
GRANT SELECT, INSERT ON deletion_requests TO app_user;
GRANT UPDATE (status, resolution_note, resolved_at, resolved_by) ON deletion_requests TO app_user;
CREATE POLICY deletion_requests_select ON deletion_requests FOR SELECT TO app_user
    USING (organization_id = app_active_association());
CREATE POLICY deletion_requests_insert ON deletion_requests FOR INSERT TO app_user
    WITH CHECK (
        organization_id = app_active_association()
        AND NOT app_is_active_admin()
        AND requested_by = app_current_user_id()
        AND status = 'pending'
        AND resolved_at IS NULL AND resolved_by IS NULL AND resolution_note IS NULL
        AND ((target_type = 'colony' AND app_can_manage_colony(colony_id))
             OR (target_type = 'cat' AND app_can_edit_cat(cat_id))
             OR (target_type = 'action' AND EXISTS (
                     SELECT 1 FROM actions a
                     WHERE a.id = action_id AND a.organization_id = app_active_association())))
    );
CREATE POLICY deletion_requests_resolve ON deletion_requests FOR UPDATE TO app_user
    USING (organization_id = app_active_association() AND app_is_active_admin())
    WITH CHECK (organization_id = app_active_association() AND app_is_active_admin()
                AND status <> 'withdrawn');
CREATE POLICY deletion_requests_withdraw ON deletion_requests FOR UPDATE TO app_user
    USING (status = 'pending' AND requested_by = app_current_user_id()
           AND organization_id = app_active_association())
    WITH CHECK (status = 'withdrawn' AND requested_by = app_current_user_id()
                AND organization_id = app_active_association());
