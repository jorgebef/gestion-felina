import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { api } from "@/lib/api";

export function TrackButton({
  tenderId,
  tracked,
  size = "sm",
}: {
  tenderId: string;
  tracked: boolean;
  size?: "sm" | "default";
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (tracked) await api().tenders.untrack(tenderId);
      else await api().tenders.track(tenderId);
    },
    onSuccess: async () => {
      toast.success(
        tracked ? "Has dejado de seguir la licitación" : "Guardada en Mis licitaciones",
      );
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Button
      type="button"
      variant={tracked ? "secondary" : "outline"}
      size={size}
      disabled={mutation.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mutation.mutate();
      }}
      aria-pressed={tracked}
    >
      {mutation.isPending ? (
        <Loader2 className="animate-spin" />
      ) : tracked ? (
        <BookmarkCheck />
      ) : (
        <Bookmark />
      )}
      {tracked ? "Guardada" : "Guardar"}
    </Button>
  );
}
