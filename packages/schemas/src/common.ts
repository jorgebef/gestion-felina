import { z } from "zod";

export const idParamSchema = z.object({ id: z.uuid() });
export const searchTermSchema = z.object({ q: z.string().max(100).default("") });
