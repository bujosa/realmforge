import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { allStories, type StoryInstance } from "./registry";
// Every file under stories/ registers its own entries; no central list to edit.
import.meta.glob("./stories/**/*.ts", { eager: true });

const stage = document.getElementById("stage")!;
const nav = document.getElementById("nav")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#8fa07a");
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
camera.position.set(0, 3, 6);
const controls = new OrbitControls(camera, renderer.domElement);
scene.add(new THREE.HemisphereLight("#fff7e6", "#4a4030", 1.4));
const sun = new THREE.DirectionalLight("#ffffff", 2.2);
sun.position.set(4, 8, 3);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(20, 64), new THREE.MeshStandardMaterial({ color: "#7d8f5a", roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

let current: StoryInstance | null = null;
function show(id: string): void {
  const story = allStories().find(entry => entry.id == id) ?? allStories()[0];
  if (!story) return;
  if (current) { scene.remove(current.object); current.dispose?.(); }
  current = story.build({ scene, camera, renderer });
  scene.add(current.object);
  const box = new THREE.Box3().setFromObject(current.object);
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  controls.target.copy(box.getCenter(new THREE.Vector3()));
  camera.position.copy(controls.target).add(new THREE.Vector3(0, size * 0.45, size * 0.9));
  controls.update();
  for (const link of nav.querySelectorAll("a")) link.classList.toggle("active", link.dataset.id == story.id);
}

const categories = new Map<string, HTMLElement>();
for (const story of allStories()) {
  let section = categories.get(story.category);
  if (!section) {
    section = document.createElement("section");
    section.innerHTML = `<h2>${story.category}</h2>`;
    nav.appendChild(section);
    categories.set(story.category, section);
  }
  const link = document.createElement("a");
  link.href = `#${story.id}`;
  link.dataset.id = story.id;
  link.textContent = story.title;
  section.appendChild(link);
}
addEventListener("hashchange", () => show(location.hash.slice(1)));
show(location.hash.slice(1));

const clock = new THREE.Clock();
function resize(): void {
  const { clientWidth: width, clientHeight: height } = stage;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  current?.update?.(delta, clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
});
