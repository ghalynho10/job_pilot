export type MatchScoreTier = "high" | "medium" | "low";

export function getMatchScoreTier(matchScore: number): MatchScoreTier {
  if (matchScore >= 90) {
    return "high";
  }

  if (matchScore >= 80) {
    return "medium";
  }

  return "low";
}
