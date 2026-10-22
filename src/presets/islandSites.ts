/** Frozen demo map coordinates; optional host layout data, not library placement policy. */
export const REFERENCE = [194.36363636363603, 617.818181818182];
export const SITES = [
  { id: "ten-towers", point: [140, 620], towers: 10, radius: 35 },
  { id: "hammerhorn", point: [80, 580], towers: 3, radius: 21 },
  { id: "grey-garden", point: [145, 605], towers: 1, radius: 16 },
  { id: "blacktyde", point: [149.11, 568.53], towers: 1, radius: 16 },
  { id: "orkmont", point: [139, 600], towers: 2, radius: 18 },
  { id: "saltcliffe", point: [103.11, 664.48], towers: 1, radius: 16 }
];
// Static base/FFC map pads, conservatively including the complete 1–4 formation
// envelope and both maps' power slots. Dimensions below are physical metres.
export const PADS = [
  { x: 130.24165, y: 630.36744, hx: 150, hz: 45 },
  { x: 74.27584, y: 587.98791, hx: 25, hz: 25 },
  { x: 128.16667, y: 609.66667, hx: 25, hz: 25 },
  { x: 128.5, y: 610.66667, hx: 25, hz: 25 },
  { x: 124.66667, y: 584, hx: 30, hz: 30 },
  { x: 88.51656, y: 584.05121, hx: 15, hz: 15 },
  { x: 108.36364, y: 607.81818, hx: 150, hz: 150 }
];

