/* The skills graph's dots. Positions, sizes, brightness and colour all arrive
   per vertex from the frame loop, which owns the choreography; this only turns
   each point into a light: a hot core inside a soft halo, scaled by distance
   so the near side of the graph reads as near. Additive, so where dots pile up
   (the contact section pulls them all into one) the glow sums to a single
   bright point. */
export const NODE_VERT = `
attribute float aSize;
attribute float aBright;
attribute vec3  aColor;
uniform float uScale;
varying float vBright;
varying vec3  vColor;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position  = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / -mv.z;
  vBright = aBright;
  vColor  = aColor;
}`;

export const NODE_FRAG = `
varying float vBright;
varying vec3  vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if(d > 0.5) discard;
  float core = smoothstep(0.11, 0.0, d);
  float halo = smoothstep(0.5, 0.0, d);
  halo *= halo;
  vec3 col = vColor * (halo * 0.75 + core) + core * 0.55;
  gl_FragColor = vec4(col * vBright, 1.0);
}`;

/* Hero portrait: a real photograph standing in the same 3D scene as the object,
   as a flat card. It is deliberately NOT pushed into relief from a depth map:
   under perspective and the cursor-driven camera, different depths shift by
   different amounts and his face changes shape as the mouse moves. Flat, it keeps
   his exact features and still gets parallax against the object and dust passing
   in front of and behind it. uData packs the silhouette's outward edge normal in
   RG, scaled by how close the pixel sits to the edge, so the object's glow lands
   on the side facing it. */
export const PORTRAIT_VERT = `
varying vec2  vUv;
varying vec3  vWorld;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const PORTRAIT_FRAG = `
uniform sampler2D uMap;
uniform sampler2D uData;
uniform vec3  uLightPos;
uniform vec3  uColorC;
uniform float uKey;
varying vec2  vUv;
varying vec3  vWorld;
void main(){
  vec4 c = texture2D(uMap, vUv);
  if(c.a < 0.02) discard;
  vec2  e    = texture2D(uData, vUv).rg * 2.0 - 1.0;
  float band = length(e);
  vec2  n    = band > 0.001 ? e / band : vec2(0.0);
  vec3  toL  = uLightPos - vWorld;
  float face = max(dot(n, normalize(toL.xy)), 0.0);
  float fall = 1.0 / (1.0 + dot(toL, toL) * 0.12);
  float dark = 1.0 - dot(c.rgb, vec3(0.299, 0.587, 0.114));
  vec3  col  = c.rgb * uKey;
  col += uColorC * pow(band, 2.6) * face * fall * 2.6;
  // faint neutral edge light, strongest on dark cloth so it separates from the page
  col += vec3(0.925, 0.918, 0.89) * pow(band, 2.0) * 0.16 * dark * uKey;
  gl_FragColor = vec4(col, c.a);
}`;
