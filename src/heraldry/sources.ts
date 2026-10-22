// The host owns heraldry. Only an original neutral marker ships in the public API.
const sources: Record<string, string> = {
  neutral: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="128"/></svg>',
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
