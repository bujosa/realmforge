import * as THREE from "three";

// A tiny, water-only radiance cache. No frame-by-frame scene capture, no HDRI,
// and no replacement of the scene environment used by other table materials.
export function waterEnvironment(renderer: THREE.WebGLRenderer, outdoor = false): THREE.WebGLRenderTarget {
  const sky = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(10, 16, 8);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 direction;
      void main() {
        vec3 d = normalize(direction);
        vec3 table = vec3(0.055, 0.032, 0.020);
        vec3 horizon = vec3(0.24, 0.34, 0.36);
        vec3 sky = vec3(0.55, 0.68, 0.72);
        vec3 radiance = mix(table, mix(horizon, sky, smoothstep(0.0, 0.8, d.y)), smoothstep(-0.3, 0.12, d.y));
        float windowLight = pow(max(0.0, dot(d, normalize(vec3(-0.6, 0.75, -0.28)))), 28.0);
        radiance += vec3(1.0, 0.83, 0.61) * windowLight * 1.6;
        float skylight = exp(-pow((d.z + 0.45) / 0.14, 2.0)) * (1.0 - smoothstep(0.5, 0.8, abs(d.x))) * smoothstep(0.45, 0.8, d.y);
        radiance += vec3(0.85, 1.0, 1.08) * skylight * 2.4;
        ${outdoor ? `
          // An overcast outdoor sky has no candle/window reflection. A broad
          // cloud lobe gives soft highlights without a second scene render.
          radiance = mix(vec3(0.10,0.15,0.18), vec3(0.45,0.57,0.64), smoothstep(-0.1,0.85,d.y));
          float cloud = pow(max(0.0,dot(d,normalize(vec3(-0.5,0.8,-0.4)))),5.0);
          radiance += vec3(0.5,0.57,0.59) * cloud * 0.6;
        ` : ""}
        gl_FragColor = vec4(radiance, 1.0);
      }
    `
  });
  sky.add(new THREE.Mesh(geometry, material));
  const generator = new THREE.PMREMGenerator(renderer);
  try {
    return generator.fromScene(sky, 0.05, 0.1, 30, { size: 64 });
  } finally {
    generator.dispose();
    material.dispose();
    geometry.dispose();
  }
}
