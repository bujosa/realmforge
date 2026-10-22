/** Six public geography materials, ordered like the CC0 texture arrays. */
export function surfaceDeclarations(): string {
  return `
    uniform highp sampler2DArray worldSurfaceAlbedo;
    uniform highp sampler2DArray worldSurfaceNormal;
    uniform highp sampler2DArray worldSurfaceRoughness;
    uniform float worldSurfaceDetail;
    uniform float worldSurfaceFade;
    vec2 worldSurfaceLayers = vec2(0.0);
    float worldSurfaceMix = 0.0;
    float worldSurfaceAmount = 0.0;
    float worldGround(vec2 p);
    vec2 worldSurfaceUv(vec2 p) { return p / 2.8; }
    vec3 worldSurfaceColor(float layer, vec2 p, vec3 position, vec3 planeWeights) {
      vec2 uv = worldSurfaceUv(p);
      vec2 rotated = mat2(0.8,-0.6,0.6,0.8) * uv + vec2(17.23,9.71);
      float variation = smoothstep(0.27,0.73,worldGround(p * 0.022));
      vec3 color = mix(texture(worldSurfaceAlbedo,vec3(uv,layer)).rgb,
        texture(worldSurfaceAlbedo,vec3(rotated,layer)).rgb,variation * 0.55);
      if (layer > 4.5 && planeWeights.z < 0.95) {
        vec2 rockX = worldSurfaceUv(position.yz);
        vec2 rockY = worldSurfaceUv(position.xz);
        vec3 side = texture(worldSurfaceAlbedo,vec3(rockX,5.0)).rgb * planeWeights.x
          + texture(worldSurfaceAlbedo,vec3(rockY,5.0)).rgb * planeWeights.y;
        color = color * planeWeights.z + side;
      }
      return color;
    }
    float worldSurfaceRough(float layer, vec2 p) {
      return texture(worldSurfaceRoughness,vec3(worldSurfaceUv(p),layer)).r;
    }
    vec3 worldSurfaceBump(float layer, vec2 p) {
      vec2 xy = texture(worldSurfaceNormal,vec3(worldSurfaceUv(p),layer)).rg * 2.0 - 1.0;
      return vec3(xy,sqrt(max(0.01,1.0-dot(xy,xy))));
    }
  `;
}

export function surfaceColor(shore: string, sandWidth: string): string {
  return `
    // Keep the existing field atlas authoritative, then enrich the local
    // material with public biome, slope and signed shore-distance splats.
    float coastSand = 1.0-smoothstep(0.0,${sandWidth},${shore});
    float rockWeight = max(smoothstep(0.10,0.43,slope),smoothstep(0.54,0.93,worldTerrain.z));
    float fieldWeight = field.a * farmable * (1.0-rockWeight);
    float dryWeight = clamp(biome.g*0.70 + (cover-0.44)*0.55,0.0,1.0);
    float weights[6];
    weights[0] = (0.75-dryWeight*0.32)*(1.0-rockWeight)*(1.0-coastSand)*(1.0-fieldWeight);
    weights[1] = (0.12+dryWeight*0.90)*(1.0-rockWeight)*(1.0-coastSand)*(1.0-fieldWeight);
    weights[2] = fieldWeight*1.65;
    weights[3] = (bare*0.66+0.06)*(1.0-coastSand)*(1.0-rockWeight);
    weights[4] = coastSand*1.35*(1.0-rockWeight*0.65);
    weights[5] = rockWeight*1.55;
    float best = -1.0, second = -1.0, firstLayer = 0.0, secondLayer = 0.0;
    for (int layer=0; layer<6; layer++) {
      float weight = weights[layer];
      if (weight > best) { second=best; secondLayer=firstLayer; best=weight; firstLayer=float(layer); }
      else if (weight > second) { second=weight; secondLayer=float(layer); }
    }
    worldSurfaceLayers = vec2(firstLayer,secondLayer);
    worldSurfaceMix = second/max(best+second,0.0001);
    vec3 lookPlanes = pow(abs(normalize(worldSlope)),vec3(4.0));
    lookPlanes /= max(dot(lookPlanes,vec3(1.0)),0.0001);
    vec3 textured = worldSurfaceColor(firstLayer,worldTerrain.xy,worldTerrain,lookPlanes);
    if (worldSurfaceDetail > 0.5) textured = mix(textured,
      worldSurfaceColor(secondLayer,worldTerrain.xy,worldTerrain,lookPlanes),worldSurfaceMix);
    float macro = 0.78 + worldGround(worldTerrain.xy*0.17)*0.48;
    worldSurfaceAmount = (1.0-snowLine)*0.82*(1.0-worldFieldWinter*0.18)*worldSurfaceFade;
    // The source photos have very different white balances. Retain public
    // biome/field colour, using their resolved albedo for grain and roughness.
    float texLight = dot(textured,vec3(0.2126,0.7152,0.0722));
    float detailLight = clamp(1.0 + (texLight - 0.21)*1.7,0.65,1.32);
    terrain *= mix(1.0,detailLight*macro,worldSurfaceAmount);
    // Coast colour follows the same continuous distance as the foam. Steep
    // faces stay stone; broad low shores become visible ochre sand.
    terrain = mix(terrain,vec3(0.69,0.49,0.23)*detailLight,coastSand*(1.0-rockWeight)*0.88*worldSurfaceFade);
    float luma = dot(terrain,vec3(0.2126,0.7152,0.0722));
    terrain = max(vec3(0.0),mix(vec3(luma),terrain,1.16));
  `;
}

export const surfaceNormal = `
  if (worldEnabled > 0.5 && worldSurfaceAmount > 0.001 && worldSurfaceDetail > 0.5) {
    vec3 a = worldSurfaceBump(worldSurfaceLayers.x,worldTerrain.xy);
    vec3 b = worldSurfaceBump(worldSurfaceLayers.y,worldTerrain.xy);
    vec3 detail = normalize(mix(a,b,worldSurfaceMix));
    vec3 groundNormal = normalize(vec3(detail.x,detail.z,-detail.y));
    float strength = worldSurfaceAmount * (worldSurfaceLayers.x > 4.5 ? 0.14 : 0.24);
    normal = normalize(mix(normal,normalize(mat3(viewMatrix)*groundNormal),strength));
  }
`;

export const surfaceRoughness = `
  if (worldEnabled > 0.5 && worldSurfaceAmount > 0.001) {
    float rough = worldSurfaceRough(worldSurfaceLayers.x,worldTerrain.xy);
    if (worldSurfaceDetail > 0.5) rough = mix(rough,worldSurfaceRough(worldSurfaceLayers.y,worldTerrain.xy),worldSurfaceMix);
    roughnessFactor = mix(roughnessFactor,clamp(rough,0.64,1.0),worldSurfaceAmount*0.7);
  }
`;
