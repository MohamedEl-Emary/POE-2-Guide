import { CURRENT_PATCH } from '../config';

export type ContentStatus = 'current' | 'needs-review' | 'outdated';

/**
 * What a page should display about its freshness.
 * - current:  written for CURRENT_PATCH (or newer) and marked `status: current`
 * - review:   written for an older patch, or marked `status: needs-review`
 * - outdated: marked `status: outdated`; stays online but is never recommended
 */
export type PatchState = 'current' | 'review' | 'outdated';

/** Compares dotted versions numerically: "0.5.5" < "1.0" < "1.0.1". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function getPatchState(
  { patch, status }: { patch: string; status: ContentStatus },
  currentPatch: string = CURRENT_PATCH,
): PatchState {
  if (status === 'outdated') return 'outdated';
  if (status === 'needs-review' || compareVersions(patch, currentPatch) < 0) return 'review';
  return 'current';
}

/** Outdated pages stay published but are left out of featured/recommended lists. */
export function isRecommendable(data: { patch: string; status: ContentStatus }): boolean {
  return getPatchState(data) !== 'outdated';
}
