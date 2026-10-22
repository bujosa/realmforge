/** One shared main-thread reserve for the composer and K11 builders. The
 * reset is on the next animation frame, so concurrent zone/flora jobs cannot
 * each spend a full budget in the same frame. Placement is still clock-free. */
let spent = 0;
let deadline = Infinity;
/** Check at every candidate, without allocating one iterator result per rejected cell. */
export const builderShouldYield = (): boolean => performance.now() >= deadline;
let resetPending = false;
let allocations = 0;
function scheduleReset(): void {
  if (!resetPending && typeof requestAnimationFrame != "undefined") {
    resetPending = true;
    requestAnimationFrame(() => { spent = 0; allocations = 0; resetPending = false; });
  }
}
/** One cold geometry/buffer allocation per rendered frame across owned builders. */
export function takeColdAllocation(): boolean {
  scheduleReset();
  if (typeof requestAnimationFrame == "undefined") return true;
  if (allocations) { deadline = Math.min(deadline, performance.now()); return false; }
  allocations++; return true;
}
export function advanceBuilder<T>(job: Generator<void, T, unknown>, sliceMs = 2): { done: boolean; value?: T; ms: number } {
  scheduleReset();
  if (typeof requestAnimationFrame == "undefined") spent = 0;
  const start = performance.now(), allowance = Math.max(0, Math.min(4, sliceMs, 6 - spent));
  deadline = start + allowance;
  let done = false, value: T | undefined;
  while (performance.now() - start < allowance) {
    const step = job.next();
    if (step.done) { done = true; value = step.value; break; }
  }
  const ms = performance.now() - start; spent += ms;
  return { done, value, ms };
}

export const builderFrame = (): Promise<void> => new Promise(resolve => {
  if (typeof requestAnimationFrame != "undefined") requestAnimationFrame(() => resolve());
  else setTimeout(resolve, 0);
});
