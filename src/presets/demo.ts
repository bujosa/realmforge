/** Game-specific gallery labels and colors, deliberately outside the neutral public API. */
export const demoHouses = ["stark", "lannister", "baratheon", "greyjoy", "tyrell", "martell", "arryn", "targaryen", "bolton", "neutral"];
export const demoColors: Record<string, string> = { stark: "#d8d8d8", lannister: "#b3261e", baratheon: "#e0b31c", greyjoy: "#272c32", tyrell: "#2e7d32", martell: "#e66b16", arryn: "#5289bd", targaryen: "#912524", bolton: "#be8890", neutral: "#978064" };
export const namedSeats = ["winterfell", "kings-landing", "dragonstone", "highgarden", "storms-end", "pyke", "the-eyrie", "casterly-rock", "sunspear", "riverrun", "iron-bank", "harrenhal", "moat-cailin", "oldtown", "white-harbor", "seagard", "flints-finger", "the-reach", "crackclaw-point", "yronwood", "starfall", "the-vale-of-arryn", "pentos", "volantis"];
export const titleCase = (value: string): string => value.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
