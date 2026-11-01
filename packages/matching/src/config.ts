/**
 * Tunable weights of the deterministic matching engine. The score (0–100) measures how
 * relevant a tender is for a profile; it is NOT a probability of winning nor a check of
 * legal eligibility.
 *
 *   score = RELEVANCE_SHARE × relevance + LOCATION_SHARE × location + BUDGET_SHARE × budget
 *
 * `relevance` (0–1) combines only the signals the profile actually configured (CPV,
 * keywords, description), so a profile without CPV codes is not penalised for it.
 */
export const MATCHING_CONFIG = {
  relevanceWeights: { cpv: 45, keywords: 35, text: 20 },
  shares: { relevance: 85, location: 10, budget: 5 },
  /** Matches below this score are not stored. */
  minScore: 30,
  /** How many description terms count as "full" textual coverage. */
  textCoverageTerms: 6,
  /**
   * Minimum CPV similarity that counts as a relevance signal on its own: the tender's
   * code must be inside the profile's code or a broader category containing it. A
   * code from the same family only adds points (e.g. pest control vs. cleaning).
   */
  minCpvSignal: 0.7,
  /** Similarity by depth of the shared CPV prefix. */
  cpvSimilarity: {
    withinProfileCode: 1,
    broaderTenderCode: 0.7,
    sameGroup: 0.5,
    sameDivision: 0.3,
  },
  keywordBase: 0.6,
  locationFallback: { authorityInProfile: 0.8, unspecified: 0.5 },
  budgetUnknown: 0.5,
} as const;

export type MatchingConfig = typeof MATCHING_CONFIG;
