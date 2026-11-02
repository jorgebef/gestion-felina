import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { MAX_PHOTO_BYTES } from "@felina/schemas/cat";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

import { EntityAvatar, type AvatarEntity } from "./EntityAvatar";

/** Shows a profile photo and lets its owner upload a new one or remove it. */
export function AvatarUpload({
  entity,
  name,
  upload,
  remove,
}: {
  entity: Exclude<AvatarEntity, { kind: "cat" }>;
  name: string;
  upload: (file: File) => Promise<unknown>;
  remove: () => Promise<unknown>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  // Every list shows thumbnails, and the viewer (route context) carries its own: refresh all.
  const refresh = async () => {
    await queryClient.invalidateQueries();
    await router.invalidate();
  };
  const save = useMutation({
    mutationFn: upload,
    onSuccess: async () => {
      toast.success("Foto actualizada");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const clear = useMutation({
    mutationFn: remove,
    onSuccess: async () => {
      toast.success("Foto eliminada");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const busy = save.isPending || clear.isPending;

  return (
    <div className="flex items-center gap-4">
      <EntityAvatar entity={entity} name={name} size="xl" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="bg-card"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : <Camera />}
            {entity.avatar ? "Cambiar foto" : "Subir foto"}
          </Button>
          {entity.avatar ? (
            <Button
              type="button"
              variant="ghost"
              className="text-negative hover:text-negative"
              disabled={busy}
              onClick={() => clear.mutate()}
            >
              {clear.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Quitar
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG o WebP de hasta 8 MB.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Foto de perfil"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > MAX_PHOTO_BYTES) {
            toast.error("La foto no puede superar los 8 MB");
            return;
          }
          save.mutate(file);
        }}
      />
    </div>
  );
}
