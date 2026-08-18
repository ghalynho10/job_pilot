/**
 * Identity of a job posting as a user would judge it: the same employer, the
 * same role, for the same money is the same job, whatever ids the source
 * assigned it.
 *
 * Adzuna routinely lists one opening several times under different ids, so
 * deduplicating on its id alone leaves visible duplicates in the user's list.
 * Normalized for case and stray whitespace, because Adzuna's own data is not
 * consistent about either.
 *
 * Lives here rather than beside its caller in agent/adzuna.ts so it can be
 * imported and executed by a test, the way lib/match-score.ts is.
 */
export function jobSignature(
  company: string,
  title: string,
  location: string,
  salary: string | null,
): string {
  // Location is part of the key, not an afterthought: the same role at the same
  // company for the same money in two different cities is two real openings, and
  // dropping one of them is worse than showing a duplicate. A duplicate is
  // noise; a false merge is a job the user could have applied to, silently gone.
  //
  // JSON rather than a joined delimiter: a company or title containing the
  // separator would otherwise let two different jobs produce one signature.
  return JSON.stringify([
    company.trim().toLowerCase(),
    title.trim().toLowerCase(),
    location.trim().toLowerCase(),
    salary ?? "",
  ]);
}
