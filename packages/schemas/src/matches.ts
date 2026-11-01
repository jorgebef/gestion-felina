import { z } from "zod";

export const MATCH_VIEWS = ["active", "new", "relevant", "dismissed"] as const;
export type MatchView = (typeof MATCH_VIEWS)[number];

export const matchListSchema = z.object({
  profile: z.uuid().optional().catch(undefined),
  view: z.enum(MATCH_VIEWS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});
export type MatchListQuery = z.infer<typeof matchListSchema>;

export const matchFeedbackSchema = z.object({
  feedback: z.enum(["relevant", "irrelevant"]).nullable(),
});
export type MatchFeedback = z.infer<typeof matchFeedbackSchema>["feedback"];
