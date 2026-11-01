export const WARMUP_SIZE = 3;
const WRONG_WEIGHT = 3;
const RIGHT_WEIGHT = 1;

/**
 * Weighted pick without replacement (spec/03-data-model.md, warmupPool):
 * drills whose last attempt was wrong are 3x as likely to come back.
 */
export function pickWarmup(
  pool: readonly string[],
  lastWrong: ReadonlySet<string>,
  count: number,
  random: () => number,
): string[] {
  const remaining = [...pool];
  const picked: string[] = [];
  while (picked.length < count && remaining.length > 0) {
    const weights = remaining.map((id) => (lastWrong.has(id) ? WRONG_WEIGHT : RIGHT_WEIGHT));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let target = random() * total;
    let index = 0;
    while (index < remaining.length - 1 && target >= weights[index]) {
      target -= weights[index];
      index += 1;
    }
    picked.push(remaining[index]);
    remaining.splice(index, 1);
  }
  return picked;
}
