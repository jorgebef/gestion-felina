import { z } from "zod";

import { isProvinceCode } from "@licita/domain/provinces";
import { CONTRACT_TYPES, TENDER_STATUSES } from "@licita/domain/tenders";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

const amount = z.coerce.number().nonnegative().optional().catch(undefined);

/** URL search params of the tender search page; invalid values are dropped, not fatal. */
export const tenderSearchSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  cpv: z
    .string()
    .regex(/^\d{2,8}$/)
    .optional()
    .catch(undefined),
  type: z.enum(CONTRACT_TYPES).optional().catch(undefined),
  province: z.string().refine(isProvinceCode).optional().catch(undefined),
  authority: z.uuid().optional().catch(undefined),
  status: z
    .enum(["active", ...TENDER_STATUSES, "all"])
    .optional()
    .catch(undefined),
  minBudget: amount,
  maxBudget: amount,
  publishedFrom: isoDate,
  publishedTo: isoDate,
  deadlineFrom: isoDate,
  deadlineTo: isoDate,
  sort: z.enum(["recent", "deadline", "relevance", "budget"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export type TenderSearch = z.infer<typeof tenderSearchSchema>;

export const PAGE_SIZE = 20;
