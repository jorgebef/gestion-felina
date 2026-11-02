import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react-native";
import { Text, View } from "react-native";
import { toast } from "sonner-native";

import { errorMessage } from "@felina/client/errors";
import { MAX_PHOTO_BYTES } from "@felina/schemas/cat";

import { Button } from "@/components/ui/button";

import { photoFile, pickPhoto } from "./cat-photo";
import { EntityAvatar, type AvatarEntity } from "./entity-avatar";

type PhotoFile = ReturnType<typeof photoFile>;

/** Shows a profile photo and lets its owner take or choose a new one, or remove it. */
export function AvatarUpload({
  entity,
  name,
  upload,
  remove,
}: {
  entity: Exclude<AvatarEntity, { kind: "cat" }>;
  name: string;
  upload: (file: PhotoFile) => Promise<unknown>;
  remove: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  // Every list shows thumbnails (and the viewer its own): refresh them all.
  const refresh = () => queryClient.invalidateQueries();
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

  const choose = async () => {
    const asset = await pickPhoto("Foto de perfil");
    if (!asset) return;
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      toast.error("La foto no puede superar los 8 MB");
      return;
    }
    save.mutate(photoFile(asset));
  };

  return (
    <View className="flex-row items-center gap-4">
      <EntityAvatar entity={entity} name={name} size="xl" />
      <View className="flex-1 gap-2">
        <Button
          variant="outline"
          icon={Camera}
          loading={save.isPending}
          disabled={clear.isPending}
          onPress={() => void choose()}
          className="self-start"
        >
          {entity.avatar ? "Cambiar foto" : "Subir foto"}
        </Button>
        {entity.avatar ? (
          <Button
            variant="ghost"
            tone="negative"
            icon={Trash2}
            loading={clear.isPending}
            disabled={save.isPending}
            onPress={() => clear.mutate()}
            className="self-start"
          >
            Quitar
          </Button>
        ) : null}
        <Text className="text-xs text-muted-foreground">JPG, PNG o WebP de hasta 8 MB.</Text>
      </View>
    </View>
  );
}
