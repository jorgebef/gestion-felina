import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, UserRoundCog, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { RowsSkeleton } from "@/components/app/skeletons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { EntityAvatar } from "./EntityAvatar";
import { errorMessage } from "@/lib/errors";
import { membersQuery } from "@/lib/queries";

export interface ColonyManager {
  userId: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

const NOBODY = "none";

/**
 * Members who manage the colony (edit it and its cats). Admins manage every colony, so
 * only the association's other members can be named, and only by admins.
 */
export function ColonyManagers({
  colonyId,
  managers,
  canManageManagers,
  loading,
}: {
  colonyId: string;
  managers: ColonyManager[];
  canManageManagers: boolean;
  loading: boolean;
}) {
  const queryClient = useQueryClient();
  const members = useQuery({ ...membersQuery, enabled: canManageManagers });
  const [selected, setSelected] = useState(NOBODY);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["colonies"] });

  const add = useMutation({
    mutationFn: (userId: string) => api().colonies.addManager(colonyId, userId),
    onSuccess: async () => {
      toast.success("Gestor añadido");
      setSelected(NOBODY);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api().colonies.removeManager(colonyId, userId),
    onSuccess: async () => {
      toast.success("Gestor retirado");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const candidates = (members.data ?? []).filter(
    (m) => m.role !== "admin" && !managers.some((x) => x.userId === m.userId),
  );
  const labels = Object.fromEntries([
    [NOBODY, "Elige una persona del equipo"],
    ...candidates.map((m) => [m.userId, m.name || m.email]),
  ]);

  return (
    <section className="surface p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <UserRoundCog className="size-4 text-brand" /> Gestores
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Editan la colonia y registran o editan sus gatos. Los administradores de la asociación
        gestionan todas las colonias.
      </p>
      {loading ? (
        <RowsSkeleton
          framed={false}
          rows={2}
          className="-mx-4 mt-2 divide-y-0"
          label="Cargando gestores…"
        />
      ) : managers.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {managers.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2.5">
                <EntityAvatar
                  entity={{ kind: "user", id: m.userId, avatar: m.avatar }}
                  name={m.name || m.email}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.name || m.email}</span>
                  {m.name ? (
                    <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                  ) : null}
                </span>
              </span>
              {canManageManagers ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Quitar a ${m.name || m.email}`}
                  onClick={() => remove.mutate(m.userId)}
                  disabled={remove.isPending}
                >
                  <X />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Sin gestores asignados.</p>
      )}

      {canManageManagers && candidates.length ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (selected !== NOBODY) add.mutate(selected);
          }}
        >
          <Select items={labels} value={selected} onValueChange={(v) => setSelected(v ?? NOBODY)}>
            <SelectTrigger className="min-w-0 flex-1 bg-card" aria-label="Persona del equipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  <EntityAvatar
                    entity={{ kind: "user", id: m.userId, avatar: m.avatar }}
                    name={m.name || m.email}
                    size="xs"
                  />
                  {m.name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            variant="outline"
            className="bg-card"
            disabled={selected === NOBODY || add.isPending}
          >
            {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Añadir
          </Button>
        </form>
      ) : null}
      {canManageManagers && members.data && !candidates.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Las demás personas del equipo son administradoras: ya gestionan todas las colonias.
        </p>
      ) : null}
    </section>
  );
}
