// Sigil sources are injectable: the library ships a neutral marker and a demo
// pack; host games register their own heraldry with registerSigil().
import stark from "./sigils/stark.svg?raw";
import lannister from "./sigils/lannister.svg?raw";
import baratheon from "./sigils/baratheon.svg?raw";
import greyjoy from "./sigils/greyjoy.svg?raw";
import tyrell from "./sigils/tyrell.svg?raw";
import martell from "./sigils/martell.svg?raw";
import arryn from "./sigils/arryn.svg?raw";
import targaryen from "./sigils/targaryen.svg?raw";
import bolton from "./sigils/bolton.svg?raw";

const sources: Record<string, string> = {
  neutral: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="128"/></svg>',
  stark, lannister, baratheon, greyjoy, tyrell, martell, arryn, targaryen, bolton,
};

let resolveIdentity: (house: string) => string = house => house;

export function registerSigil(house: string, svg: string): void {
  sources[house] = svg;
}

export function setSigilResolver(resolver: (house: string) => string): void {
  resolveIdentity = resolver;
}

export function sigilIdentity(house: string): string {
  const id = resolveIdentity(house);
  return sources[id] ? id : "neutral";
}

export function sigilSource(house: string): string {
  return sources[house] || sources.neutral;
}
