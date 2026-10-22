import type { CameraKeyframe, ThreatBeat, ThreatRegion, ThreatStep } from "./types";

/** Total active attack playback is 5 + 3 = 8 seconds; public reveal waiting is host-owned. */
export function threatSteps(beat: ThreatBeat, strength: number): ThreatStep[] {
  switch (beat) {
    case "threshold": return [{ id: "gather", duration: 2.5, caption: `The wildlings gather: ${strength}/12`, cue: "horn" }];
    case "attack": return [
      { id: "horn-1", duration: .45, caption: "Beyond the Wall", cue: "horn" },
      { id: "horn-2", duration: .45, caption: "Beyond the Wall", cue: "horn" },
      { id: "horn-3", duration: .45, caption: "The wildlings attack the Wall", cue: "horn" },
      { id: "horizon", duration: 1.65, caption: "The North is burning", cue: "drums" },
      { id: "bids", duration: 1, caption: "The Watch calls for aid", reveal: "bids" },
      { id: "card", duration: 1, caption: "The wildling card", reveal: "card" },
    ];
    case "nights-watch-victory": return [{ id: "hold", duration: 3, caption: "The Wall holds", cue: "beacons" }];
    case "wildling-victory": return [{ id: "breach", duration: 3, caption: "The cold reaches south", cue: "wind" }];
  }
}
export function threatCameraPath(beat: ThreatBeat, region: ThreatRegion, ground: number): CameraKeyframe[] {
  const x = (region.minX + region.maxX) / 2, span = region.maxX - region.minX;
  const wall = region.wallZ, h = ground + region.wallHeight;
  const view = (time: number, px: number, py: number, pz: number, tx: number, ty: number, tz: number): CameraKeyframe => ({ time, position: [px, py, pz], target: [tx, ty, tz] });
  if (beat === "threshold") return [
    view(0, x + span * .13, h + span * .3, wall + span * .7, x, ground + region.wallHeight * .55, wall),
    view(2.5, x + span * .08, h + span * .18, wall + span * .5, x, ground + region.wallHeight * .65, wall - span * .12),
  ];
  if (beat === "attack") return [
    view(0, x, h + span * .12, wall + span * .38, x, ground + region.wallHeight * .85, wall),
    view(1.35, x, h + span * .12, wall + span * .38, x, ground + region.wallHeight * .85, wall),
    view(3, x + span * .04, h + span * .13, wall + span * .16, x, ground + span * .16, region.northZ),
    view(5, x + span * .04, h + span * .13, wall + span * .16, x, ground + span * .16, region.northZ),
  ];
  return [];
}
