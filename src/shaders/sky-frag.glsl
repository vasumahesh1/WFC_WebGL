#version 300 es
precision highp float;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

const vec4 NIGHT_SKY_1 = vec4(0.0f, 39.0f, 36.0f, 255.0f) / 255.0f;
const vec4 NIGHT_SKY_2 = vec4(0.0f, 33.0f, 25.0f, 255.0f) / 255.0f;
const vec4 NIGHT_SKY_3 = vec4(0.0f, 0.0f, 18.0f, 255.0f) / 255.0f;
const vec4 NIGHT_SKY_4 = vec4(0.0f, 0.0f, 4.0f, 255.0f) / 255.0f;

uniform vec3 u_Eye;
uniform float u_Time;
uniform ivec2 u_Dimensions;
uniform mat4 u_InvViewProj;

in vec2 fs_UV;

out vec4 out_Col;


//  Classic Perlin 3D Noise
//  by Stefan Gustavson
//
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float cnoise(vec3 P) {
  vec3 Pi0 = floor(P);         // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0);  // Integer part + 1
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P);         // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0);  // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
  vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
  vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
  vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
  vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
  vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
  vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
  vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);

  vec4 norm0 = taylorInvSqrt(
      vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(
      vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111),
                 fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

float fbm(vec3 x) {
  float v = 0.0;
  float a = 0.5;
  vec3 shift = vec3(100);
  for (int i = 0; i < 8; ++i) {
    v += a * cnoise(x);
    x = x * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void addMeteor(vec2 uv, inout vec4 targetColor, float startX, float lengthX, float trailLength, float trailWidth, float timeSalt) {
  // Meteor Shower
  // y = 1-x^2
  float x = (uv.x - startX) / lengthX;
  float y = 1.0 - (x * x);

  float time = float(u_Time) * 0.5;

  float val = fract(time * timeSalt);

  if (x < val && x > val - trailLength && y <= uv.y + trailWidth && y >= uv.y - trailWidth) {
    targetColor = vec4(1.0f, 1.0f , 1.0f, 1.0f);
  }
}

vec4 getNightColor(vec3 rayDir) {
  float noise = fbm(rayDir * 237.5);

  vec4 color = vec4(0,0,0,1);

  if (noise > 0.5) {
    color = vec4(noise, noise, noise, 1.0);
  }

  return color;
}

vec2 sphereToUV(vec3 p)
{
    float phi = atan(p.z, p.x); // Returns atan(z/x)
    if(phi < 0.0)
    {
        phi += TWO_PI; // [0, TWO_PI] range now
    }

    float theta = acos(p.y); // [0, PI]
    return vec2(1.0 - phi / TWO_PI, 1.0 - theta / PI);
}

void main()
{
  // Convert Pixel Coords to 0 to 1 and then to NDC -1 to 1
  vec2 ndc = (gl_FragCoord.xy / vec2(u_Dimensions)) * 2.0 - 1.0;

  // Find a point on the Far Plane
  vec4 pointInFarPlane = vec4(ndc.xy, 1, 1);
  pointInFarPlane *= 1000.0;
  vec4 worldSpacePoint = u_InvViewProj * pointInFarPlane;

  // Ray from Camera to Far Plane World Point
  vec3 rayDir = normalize(worldSpacePoint.xyz - u_Eye.xyz);

  vec2 uv = sphereToUV(rayDir);

  vec4 targetColor = getNightColor(rayDir);

  addMeteor(uv, targetColor, 0.7f, 0.1f, 0.01f, 0.0005f, 0.008);
  addMeteor(uv, targetColor, 0.6f, 0.075f, 0.01f, 0.0005f, 0.00462);
  addMeteor(uv, targetColor, 0.3f, 0.05f, 0.01f, 0.0005f, 0.003423);
  addMeteor(uv, targetColor, 0.4f, 0.1f, 0.01f, 0.0005f, 0.003462);
  addMeteor(uv, targetColor, 0.1f, 0.1f, 0.01f, 0.0005f, 0.008852);

  out_Col = vec4(1,0,0,1);
}