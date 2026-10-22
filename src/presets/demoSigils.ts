/** Original abstract geometric demo marks. These do not reproduce house emblems. */
import { registerSigil } from "../heraldry/sources";
import stark from "./sigils/stark.svg?raw";
import lannister from "./sigils/lannister.svg?raw";
import baratheon from "./sigils/baratheon.svg?raw";
import greyjoy from "./sigils/greyjoy.svg?raw";
import tyrell from "./sigils/tyrell.svg?raw";
import martell from "./sigils/martell.svg?raw";
import arryn from "./sigils/arryn.svg?raw";
import targaryen from "./sigils/targaryen.svg?raw";
import bolton from "./sigils/bolton.svg?raw";

export function installDemoSigils(): void {
  Object.entries({ stark, lannister, baratheon, greyjoy, tyrell, martell, arryn, targaryen, bolton }).forEach(([id, svg]) => registerSigil(id, svg));
}
