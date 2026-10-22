import { registerStories } from "../registry";
import { exploreSeat, exploreSampler } from "../exploreScenes";
import { namedSeats, titleCase } from "../../src/presets/demo";
const ids=[...new Set([...namedSeats,"lannisport","gulltown"])];
for (const id of ids) registerStories({
  id:`explore/${id}`,title:`${titleCase(id)} · inhabited site`,category:"Explore",
  description:"Explore a composed QA site at 50 m/unit: production seat, surrounding terrain, approach village, trees, livestock, barrels, torches and smoke. Seven cities use complete production recipes. Other seats use a smaller synthetic settlement; this is not a reconstruction of the streamed game map. Choose Walk for the street entrance, or Explore to fly freely.",
  controls:{ detailed:{type:"boolean",label:"Detailed geometry",default:true},life:{type:"boolean",label:"Torches & smoke",default:true} },
  build:({camera,values})=>exploreSeat(id,camera,Boolean(values.detailed),Boolean(values.life)),
});
registerStories({id:"explore/westeros-sampler",title:"Westeros sampler · river to coast",category:"Explore",description:"A synthetic landscape combining four production castle complexes, a village street, forest, river, bridge, mountains, cliffs, coast and animated sea. All objects retain the game's relative scale (50 m/unit). Walk starts at the village; Explore flies above the landscape.",build:({camera})=>exploreSampler(camera)});
