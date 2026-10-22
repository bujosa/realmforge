export function loadManifest() { return import("./manifest"); }
export async function loadModelLoader() {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import("three/examples/jsm/loaders/GLTFLoader.js"), import("three/examples/jsm/libs/meshopt_decoder.module.js")]);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
