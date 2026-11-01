import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  WORKFLOW_LABELS,
  WORKFLOW_STATUSES,
  type WorkflowStatusValue,
} from "@licita/domain/tenders";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatRelativeDays } from "@/lib/format";
import { trackedDetailQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Spain local date + time inputs → ISO instant with the correct offset. */
function toIso(date: string, time: string): string | undefined {
  if (!date) return undefined;
  const local = new Date(`${date}T${time || "09:00"}:00`);
  return Number.isNaN(local.getTime()) ? undefined : local.toISOString();
}

export function TrackingPanel({ tenderId }: { tenderId: string }) {
  const queryClient = useQueryClient();
  const detail = useQuery(trackedDetailQuery(tenderId));
  const [notes, setNotes] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [taskTime, setTaskTime] = useState("");

  useEffect(() => {
    setNotes(detail.data?.tracked.notes ?? "");
  }, [detail.data?.tracked.notes]);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tracked"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["tenders", tenderId] }),
    ]);

  const update = useMutation({
    mutationFn: (data: { workflowStatus?: WorkflowStatusValue; notes?: string | null }) =>
      api().tracked.update(detail.data!.tracked.id, data),
    onSuccess: async (_r, vars) => {
      toast.success(vars.notes !== undefined ? "Notas guardadas" : "Estado actualizado");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const addTask = useMutation({
    mutationFn: () =>
      api().tracked.createTask(detail.data!.tracked.id, {
        title: taskTitle,
        dueAt: toIso(taskDate, taskTime),
      }),
    onSuccess: async () => {
      setTaskTitle("");
      setTaskDate("");
      setTaskTime("");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const toggleTask = useMutation({
    mutationFn: (v: { id: string; completed: boolean }) =>
      api().tasks.setCompleted(v.id, v.completed),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const removeTask = useMutation({
    mutationFn: (id: string) => api().tasks.delete(id),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (detail.isPending) {
    return (
      <div className="surface flex items-center gap-2 p-5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando seguimiento…
      </div>
    );
  }
  if (!detail.data) return null;
  const { tracked, tasks } = detail.data;

  return (
    <section className="surface p-5" aria-labelledby="tracking-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="tracking-title" className="font-semibold">
          Seguimiento de tu empresa
        </h2>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> Privado
        </span>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="workflow">Estado interno</Label>
        <Select
          value={tracked.workflowStatus}
          onValueChange={(v) => update.mutate({ workflowStatus: v as WorkflowStatusValue })}
        >
          <SelectTrigger id="workflow" className="w-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {WORKFLOW_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Independiente del estado oficial de la licitación.
        </p>
      </div>

      <div className="mt-5 space-y-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Requisitos de solvencia, dudas, contactos…"
          className="bg-card"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending || notes === (tracked.notes ?? "")}
            onClick={() => update.mutate({ notes })}
          >
            Guardar notas
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-medium">Tareas</h3>
        {tasks.length ? (
          <ul className="mt-2 divide-y rounded-lg border">
            {tasks.map((task) => {
              const done = Boolean(task.completedAt);
              return (
                <li key={task.id} className="flex items-start gap-3 px-3 py-2.5">
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={done}
                    disabled={toggleTask.isPending}
                    onCheckedChange={(c) =>
                      toggleTask.mutate({ id: task.id, completed: c === true })
                    }
                    className="mt-0.5"
                  />
                  <label htmlFor={`task-${task.id}`} className="min-w-0 flex-1 text-sm">
                    <span className={cn(done && "text-muted-foreground line-through")}>
                      {task.title}
                    </span>
                    {task.dueAt ? (
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(task.dueAt)}
                        {!done ? ` (${formatRelativeDays(task.dueAt)})` : ""}
                      </span>
                    ) : null}
                  </label>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Eliminar tarea ${task.title}`}
                    onClick={() => removeTask.mutate(task.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Añade pasos como «Pedir certificado de solvencia» o «Revisar pliego técnico».
          </p>
        )}

        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (taskTitle.trim().length >= 2) addTask.mutate();
          }}
        >
          <Input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Nueva tarea"
            aria-label="Título de la tarea"
            className="bg-card"
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
              aria-label="Fecha de la tarea"
              className="bg-card"
            />
            <Input
              type="time"
              value={taskTime}
              onChange={(e) => setTaskTime(e.target.value)}
              aria-label="Hora de la tarea"
              className="w-28 bg-card"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Añadir tarea"
              disabled={addTask.isPending || taskTitle.trim().length < 2}
            >
              {addTask.isPending ? (
                <Loader2 className="animate-spin" />
              ) : taskDate ? (
                <CalendarPlus />
              ) : (
                <Plus />
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
