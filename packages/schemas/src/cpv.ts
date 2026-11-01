import { z } from "zod";

export const cpvSuggestSchema = z.object({
  description: z.string().max(2000),
  sectors: z.array(z.string()).max(10),
  exclude: z.array(z.string()).max(100),
});
export type CpvSuggestInput = z.infer<typeof cpvSuggestSchema>;
