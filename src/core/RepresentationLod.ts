/**
 * Board ↔ physical representation switch with hysteresis and a dithered
 * cross-fade (docs/v3-world-scale-design.md §2.5 "Fundido", §4.2).
 *
 * - Physical below 0.87·d_c, board form above 1.15·d_c; in between the
 *   current form stays (15 % hysteresis band, no flicker on a threshold).
 * - A switch is a 250 ms cross-fade through screen-door dithering
 *   (`alphaHash`, no transparency sorting): the old form dithers out during
 *   the first half and the new one dithers in during the second. One mesh
 *   per object is enough, so the overlap never doubles the draw cost.
 * - Reduced motion: hard cut.
 * - At most 4 fades start per frame (fast zooms stagger the rest).
 *
 * Pure and deterministic: callers pass `now` (ms) and the distance.
 */

export type Representation = "board" | "physical";

export const HYSTERESIS_NEAR = 0.87;
export const HYSTERESIS_FAR = 1.15;
export const CROSSFADE_MS = 250;
export const MAX_FADE_STARTS_PER_FRAME = 4;

export interface RepresentationState {
  /** Form to draw now. */
  form: Representation;
  /** Dither coverage of that form (1 = solid). */
  alpha: number;
  /** A fade is running: keep rendering. */
  fading: boolean;
}

/** `from` → `to` cross-fade started at `started`; settled when they match. */
interface Entry { from: Representation; to: Representation; started: number; seen: number }

export default class RepresentationLod {
  private entries = new Map<string, Entry>();
  private startsThisFrame = 0;
  private frame = 0;

  /** Call once per rendered frame before `update()`. */
  beginFrame(): void {
    this.startsThisFrame = 0;
    this.frame++;
  }

  /** Form an object would settle in at `distance` with no history. */
  static settled(distance: number, dc: number): Representation {
    return distance <= dc ? "physical" : "board";
  }

  update(id: string, distance: number, dc: number, now: number, reducedMotion: boolean): RepresentationState {
    const entry = this.entries.get(id);
    if (!entry) {
      // First sight (mount, reconnect, seek): no fade, no history replay.
      const form = RepresentationLod.settled(distance, dc);
      this.entries.set(id, { from: form, to: form, started: -Infinity, seen: this.frame });
      return { form, alpha: 1, fading: false };
    }
    entry.seen = this.frame;
    const wanted: Representation =
      distance < HYSTERESIS_NEAR * dc ? "physical" : distance > HYSTERESIS_FAR * dc ? "board" : entry.to;
    if (wanted != entry.to) {
      if (reducedMotion) {
        entry.from = entry.to = wanted;
      } else if (entry.from == entry.to) {
        // Stagger: at most N new fades per frame, the rest wait a frame.
        if (this.startsThisFrame >= MAX_FADE_STARTS_PER_FRAME) return { form: entry.to, alpha: 1, fading: true };
        this.startsThisFrame++;
        entry.to = wanted;
        entry.started = now;
      } else {
        // Reversal mid-fade (two forms: wanted is the old one): swap the
        // ends and mirror the progress, so the coverage does not pop.
        const elapsed = Math.min(CROSSFADE_MS, Math.max(0, now - entry.started));
        entry.from = entry.to;
        entry.to = wanted;
        entry.started = now - (CROSSFADE_MS - elapsed);
      }
    }
    if (entry.from == entry.to) return { form: entry.to, alpha: 1, fading: false };
    const t = Math.min(1, Math.max(0, (now - entry.started) / CROSSFADE_MS));
    if (t >= 1) {
      entry.from = entry.to;
      return { form: entry.to, alpha: 1, fading: false };
    }
    // First half: old form 1 → 0. Second half: new form 0 → 1.
    return t < 0.5
      ? { form: entry.from, alpha: 1 - t * 2, fading: true }
      : { form: entry.to, alpha: t * 2 - 1, fading: true };
  }

  /** Current settled or target form, without advancing anything. */
  form(id: string): Representation | undefined {
    return this.entries.get(id)?.to;
  }

  /** Drop entries not updated for `frames` frames (pieces that left). */
  prune(frames = 2): void {
    this.entries.forEach((entry, id) => { if (this.frame - entry.seen >= frames) this.entries.delete(id); });
  }

  clear(): void {
    this.entries.clear();
  }
}
