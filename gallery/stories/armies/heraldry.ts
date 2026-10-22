/** Original silhouettes drawn for this lab; no licensed franchise artwork.
 * Only demo data uses house names. ArmyBatch consumes the host's injected source.
 */
import { registerSigil, sigilSource } from "../../../src/heraldry/sources";

const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>`;
const wolf = svg('<path d="M91 369l29-83-31-52 54 13 10-120 64 69 42-45 52 29 34 56 103 28-28 49-74 5-28 49-51-13-22 46-37-24-24 46-27-31-39 34 10-55-34 30zm183-146 15 22 27-4-16-21z" fill-rule="evenodd"/><path d="m327 283 53 7-32 21-29-7z"/>');
const kraken = svg('<path d="M215 220c-27-19-43-69-22-106 20-36 106-36 126 0 21 37 5 87-22 106l-4 41h-74z"/><path d="M241 234c-31 7-57 25-66 54-13 41-47 65-74 44-14-11-14-28-7-39-35 4-39 48-13 67 36 27 93-5 115-47 7-13 22-22 33-25-34 36-21 91-61 104-18 6-35 0-40-14-6 34 28 56 57 39 43-26 26-87 58-105-5 53 6 98-23 123-13 11-30 7-39-1 3 31 42 39 61 17 23-27 12-72 14-112 2 40-9 85 14 112 19 22 58 14 61-17-9 8-26 12-39 1-29-25-18-70-23-123 32 18 15 79 58 105 29 17 63-5 57-39-5 14-22 20-40 14-40-13-27-68-61-104 11 3 26 12 33 25 22 42 79 74 115 47 26-19 22-63-13-67 7 11 7 28-7 39-27 21-61-3-74-44-9-29-35-47-66-54z"/>');
const stag = svg('<path d="M230 224h52l34 58-24 48 16 92-29 4-23-76-23 76-29-4 16-92-24-48zM227 245l-36-51-41-13-31-42-31-9-19-45 22-8 15 32 26 10 19 28 30 6-12-42-30-28-6-38 22-5 7 32 30 26 18 58 32 34zM285 245l36-51 41-13 31-42 31-9 19-45-22-8-15 32-26 10-19 28-30 6 12-42 30-28 6-38-22-5-7 32-30 26-18 58-32 34z"/><path d="m202 236-46-24 8 38 49 26h86l49-26 8-38-46 24z"/>');
const lion = svg('<path d="M262 113l29-36 34 15 13 31 41 9-12 36-45 6-5 47 44 48-13 29-65-33-19 46 29 45 60 7 12 30-88 8-42-51-30 50 5 41-35 5-23-65 40-73-28-42-44-6-20-29 62 1 29 25 4-46-35-23-32 4-26-29 54-8 29 15z"/><path d="M218 298c-89 4-133-43-111-98 12-30 43-24 42-2-1 18-29 24-23 43 9 26 53 26 78 12l14 45zM104 194l-17-25 14-28 26-5 14 26z"/>');
const rose = svg('<path d="M256 73c59-10 85 25 73 66 45-21 91 4 92 51 2 30-15 50-38 60 48 9 66 53 40 90-17 25-47 31-73 21 10 49-21 87-66 81-32-4-49-24-51-53-26 42-74 45-101 9-20-26-16-55 5-76-50 5-81-30-68-72 9-28 33-42 61-37-34-35-28-80 13-100 25-12 51-5 67 15-6-25 11-51 46-55z"/><circle cx="256" cy="259" r="74" fill="white"/><path d="M252 183c-35 3-65 30-67 65-3 41 28 76 70 78 36 2 66-23 69-54 3-27-16-53-44-55-23-2-43 14-42 34 0 14 12 27 26 27 11 0 17-8 17-16-2 4-7 6-12 4-8-3-7-12 0-17 13-9 32 2 31 20-1 22-26 36-49 29-26-8-37-34-27-57 12-29 45-38 74-25l9-19c-17-11-34-16-55-14z" fill-rule="evenodd"/>');
// A sun pierced by a spear; the rays and spear are filled geometry for SVGLoader.
const sun = svg('<circle cx="256" cy="256" r="104"/><path d="m256 61 23 70h-46zm0 390-23-70h46zM61 256l70-23v46zm390 0-70 23v-46zM118 118l65 34-32 32zm276 276-65-34 32-32zM118 394l34-65 32 32zm276-276-34 65-32-32zM120 414l-24-24L363 123l-11-29 68-20-20 68-29-11z"/>');

const marks: Record<string, string> = { greyjoy: kraken, stark: wolf, baratheon: stag, lannister: lion, tyrell: rose, martell: sun };

/** Restore the gallery's prior marks on teardown; other stories keep their own data. */
export function installArmyDemoHeraldry(): () => void {
  const previous = Object.entries(marks).map(([id]) => [id, sigilSource(id)] as const);
  for (const [id, source] of Object.entries(marks)) registerSigil(id, source);
  return () => { for (const [id, source] of previous) registerSigil(id, source); };
}
