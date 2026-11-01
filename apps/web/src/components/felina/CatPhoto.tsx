import { Camera, Cat as CatIcon, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MAX_PHOTO_BYTES } from "@felina/schemas/cat";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
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
  if (failed) {
    return (
      <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)}>
        <CatIcon className="size-1/3" />
      </div>
    );
  }
  return (
    <img
      src={api().cats.photoUrl(catId, version)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("bg-muted object-cover", className)}
    />
  );
}

/**
 * Chooses and uploads the main photo. Uploading happens right away; the form only sends
 * the returned `photoKey` when it is saved.
 */
export function PhotoInput({
  photoKey,
  currentUrl,
  onChange,
  error,
  disabled,
}: {
  photoKey: string | null;
  /** Existing photo when editing. */
  currentUrl?: string;
  onChange: (photoKey: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setUploadError("La foto no puede superar los 8 MB");
      return;
    }
    setUploading(true);
    try {
      const { photoKey: key } = await api().cats.uploadPhoto(file);
      setPreview(URL.createObjectURL(file));
      onChange(key);
    } catch (e) {
      setUploadError(errorMessage(e));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const shown = preview ?? (photoKey ? currentUrl : undefined);
  const message = uploadError ?? error;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div
        className={cn(
          "grid size-32 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted",
          message && "border-negative",
        )}
      >
        {shown ? (
          <img src={shown} alt="Foto principal" className="size-full object-cover" />
        ) : (
          <CatIcon className="size-10 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-2">
        <input
          ref={input}
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
          {shown ? "Cambiar foto" : "Añadir foto"}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG o WebP, hasta 8 MB.</p>
        {message ? <p className="text-xs text-negative">{message}</p> : null}
      </div>
    </div>
  );
}
