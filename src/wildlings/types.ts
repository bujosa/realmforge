export type ThreatQuality = "high" | "balanced";
export type ThreatBeat = "threshold" | "attack" | "nights-watch-victory" | "wildling-victory";
export type ThreatCue = "horn" | "wind" | "drums" | "beacons" | "settle";
export interface ThreatPoint { x: number; z: number; y?: number }
/** All coordinates are host scene units. North is negative Z; transform the group for other orientations. */
export interface ThreatRegion {
  minX: number;
  maxX: number;
  northZ: number;
  wallZ: number;
  wallHeight: number;
  /** Typically three public landmarks. No house or game-state dependency. */
  beacons: readonly ThreatPoint[];
}
export interface CameraKeyframe {
  time: number;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}
export interface ThreatStep {
  id: string;
  duration: number;
  caption: string;
  cue?: ThreatCue;
  reveal?: "bids" | "card";
}
export interface ThreatOptions {
  region: ThreatRegion;
  groundHeight: (x: number, z: number) => number;
  quality?: ThreatQuality;
  reducedMotion?: boolean;
  onCue?: (cue: ThreatCue) => void;
  onCaption?: (caption: string) => void;
  /** Requests a slot in the host director. Does not reveal or supply any game data. */
  onReveal?: (kind: "bids" | "card") => void;
  /** Host resolves affected regions from the already-public outcome; no hidden IDs are accepted here. */
  onHighlightRegions?: () => void;
  onStep?: (step: Readonly<ThreatStep> | null) => void;
  onCameraPath?: (path: readonly CameraKeyframe[]) => void;
}
export interface ThreatState {
  strength: number;
  visualStrength: number;
  imminent: boolean;
  beat: ThreatBeat | null;
  step: string | null;
  stepTime: number;
  beatTime: number;
  caption: string;
  cameraPath: readonly CameraKeyframe[];
}
export interface ThreatBudget { draws: number; triangles: number; particles: number; quality: ThreatQuality }
