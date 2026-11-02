-- «Castrado» pasa a ser un dato del gato que la asociación puede editar a mano. Antes se
-- deducía de las acciones de castración realizadas; ahora esas acciones lo marcan al
-- completarse (packages/core/src/actions.ts), pero nunca lo desmarcan.
ALTER TABLE cats ADD COLUMN sterilized boolean NOT NULL DEFAULT false;

-- Los gatos que ya tienen una castración realizada quedan castrados (sin tocar su
-- updated_at: no es una edición).
ALTER TABLE cats DISABLE TRIGGER cats_touch;
UPDATE cats c SET sterilized = true
WHERE EXISTS (
    SELECT 1 FROM action_cats ac JOIN actions a ON a.id = ac.action_id
    WHERE ac.cat_id = c.id AND a.action_type = 'sterilization' AND a.status = 'done'
);
ALTER TABLE cats ENABLE TRIGGER cats_touch;

GRANT UPDATE (sterilized) ON cats TO app_user;
