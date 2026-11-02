import * as ImagePicker from "expo-image-picker";
import { Camera, Cat as CatIcon } from "lucide-react-native";
import { useState } from "react";
import { ActionSheetIOS, Alert, Platform, Text, View } from "react-native";

import { MAX_PHOTO_BYTES } from "@felina/schemas/cat";
import { errorMessage } from "@felina/client/errors";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Image } from "@/components/ui/image";
import { api, useCatPhotoSource } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Main photo of a cat (served by the API to people allowed to see the cat). */
export function CatPhoto({
  catId,
  version,
  alt,
  className,
}: {
  catId: string;
  version?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const source = useCatPhotoSource(catId, version);
  if (failed) {
    return (
      <View className={cn("items-center justify-center bg-muted", className)}>
        <Icon icon={CatIcon} color="muted-foreground" size={36} />
      </View>
    );
  }
  return (
    <Image
      source={source}
      accessibilityLabel={alt}
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
      recyclingKey={`${catId}:${version}`}
      onError={() => setFailed(true)}
      className={cn("bg-muted", className)}
    />
  );
}

type Source = "camera" | "library";

async function pick(source: Source): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      "Sin permiso",
      source === "camera"
        ? "Activa el acceso a la cámara en los ajustes del teléfono."
        : "Activa el acceso a las fotos en los ajustes del teléfono.",
    );
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0] ?? null);
}

function chooseSource(): Promise<Source | null> {
  return new Promise((resolve) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Hacer una foto", "Elegir de la galería", "Cancelar"], cancelButtonIndex: 2 },
        (i) => resolve(i === 0 ? "camera" : i === 1 ? "library" : null),
      );
      return;
    }
    Alert.alert("Foto principal", undefined, [
      { text: "Hacer una foto", onPress: () => resolve("camera") },
      { text: "Elegir de la galería", onPress: () => resolve("library") },
      { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

/**
 * Takes or chooses the main photo and uploads it right away; the form only sends the
 * returned `photoKey` when it is saved (same flow as the web app).
 */
export function PhotoInput({
  photoKey,
  current,
  onChange,
  error,
  disabled,
}: {
  photoKey: string | null;
  /** Existing photo when editing. */
  current?: { catId: string; version: string };
  onChange: (photoKey: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const choose = async () => {
    const source = await chooseSource();
    if (!source) return;
    const asset = await pick(source);
    if (!asset) return;
    setUploadError(null);
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      setUploadError("La foto no puede superar los 8 MB");
      return;
    }
    setUploading(true);
    try {
      const type = asset.mimeType ?? "image/jpeg";
      const { photoKey: key } = await api().cats.uploadPhoto({
        uri: asset.uri,
        name: asset.fileName ?? `foto.${type.split("/")[1] ?? "jpg"}`,
        type,
      });
      setPreview(asset.uri);
      onChange(key);
    } catch (e) {
      setUploadError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const message = uploadError ?? error;
  const hasPhoto = Boolean(preview ?? (photoKey && current));
  return (
    <View className="flex-row items-center gap-4">
      <View
        className={cn(
          "size-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted",
          message && "border-negative",
        )}
      >
        {preview ? (
          <Image source={{ uri: preview }} className="size-full" contentFit="cover" />
        ) : photoKey && current ? (
          <CatPhoto
            catId={current.catId}
            version={current.version}
            alt="Foto principal"
            className="size-full"
          />
        ) : (
          <Icon icon={CatIcon} color="muted-foreground" size={36} />
        )}
      </View>
      <View className="flex-1 gap-2">
        <Button
          variant="outline"
          icon={Camera}
          loading={uploading}
          disabled={disabled}
          onPress={() => void choose()}
          className="self-start"
        >
          {hasPhoto ? "Cambiar foto" : "Añadir foto"}
        </Button>
        <Text className="text-xs text-muted-foreground">JPG, PNG o WebP, hasta 8 MB.</Text>
        {message ? <Text className="text-xs text-negative">{message}</Text> : null}
      </View>
    </View>
  );
}
