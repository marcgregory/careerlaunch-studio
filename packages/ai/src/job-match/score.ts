/**
 * Compute a match score (0–100) based on how many JD-required skills
 * the resume already covers.
 *
 * Formula: max(10, round((present / (present + missing)) * 100))
 *
 * Returns null if no skills were extracted from the JD (no score possible).
 */
export function computeMatchScore(
  presentSkills: string[],
  missingSkills: string[],
): number | null {
  const total = presentSkills.length + missingSkills.length;

  if (total === 0) return null;

  const ratio = presentSkills.length / total;
  return Math.max(10, Math.round(ratio * 100));
}
