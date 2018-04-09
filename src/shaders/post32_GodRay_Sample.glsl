#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;
uniform float u_GodRay_DS;

#define MAX_SPOT_LIGHTS 20
#define NUM_SAMPLES 200

struct SpotLight {
    vec4 ambient;
    vec4 diffuse;
    vec4 specular;

    vec3 position;
    float range;
    float contrib;

    vec3 direction;
    float kSpot;

    vec3 attn;
};

uniform SpotLight u_SpotLights[MAX_SPOT_LIGHTS];
uniform uint u_NumSpotLights;

uniform sampler2D u_frame;
uniform sampler2D u_gb0;

uniform mat4 u_View;
uniform mat4 u_Proj;
uniform vec4 u_CamPos;
uniform vec4 u_GodRay_Options;

vec4 computeGodRay(vec4 inputColor) {
  vec2 texCoord = fs_UV;

  // vec4 gbData = texture(u_gb0, texCoord);

  float density = u_GodRay_Options.x;
  float weight = u_GodRay_Options.y;
  float decay = u_GodRay_Options.z;
  float exposure = u_GodRay_Options.w;

  for (uint i = uint(0); i < u_NumSpotLights; i++) {
    SpotLight light = u_SpotLights[i];

    vec4 p1 = u_Proj * u_View * vec4(0, 0, 0, 1.0);
    vec4 p2 = u_Proj * u_View * vec4(light.direction, 1.0);
    p1 /= p1.w; // NDC
    p2 /= p2.w; // NDC

    p1.x = (p1.x + 1.0) * 0.5;
    p1.y = (p1.y + 1.0) * 0.5; // Pixel Space

    p2.x = (p2.x + 1.0) * 0.5;
    p2.y = (p2.y + 1.0) * 0.5; // Pixel Space

    vec2 deltaPos = normalize(vec2(p2.xy - p1.xy)); // 

    vec4 lightScreenPos = u_Proj * u_View * vec4(light.position, 1.0);
    lightScreenPos /= lightScreenPos.w; // NDC

    lightScreenPos.x = (lightScreenPos.x + 1.0) * 0.5;
    lightScreenPos.y = (lightScreenPos.y + 1.0) * 0.5; // Pixel Space

    // if (lightScreenPos.x >= -1.0 && lightScreenPos.x <= 1.0 && lightScreenPos.y >= -1.0 && lightScreenPos.y <= 1.0) {
      // Safe to Process God Ray
      float illuminationDecay = 1.0;

      vec2 lightToCoord = texCoord - lightScreenPos.xy;
      vec2 deltaTexCoord = deltaPos;

      // deltaTexCoord = lightToCoord;

      if (length(lightToCoord) > 0.075) {
        continue;
      }

      float dotValue = dot(normalize(lightToCoord), deltaTexCoord);
      float cosFactor = acos(dotValue);

      if (dotValue < 0.0) {
        continue;
      }

      // 25 degree search limit
      // if (abs(cosFactor) > 0.436332) {
      //   continue;
      // }

      deltaTexCoord *= 1.0 / float(NUM_SAMPLES) * density;

      for (uint j = uint(0); j < uint(NUM_SAMPLES); j++) {
        // Step sample location along ray.
        texCoord -= deltaTexCoord;
        // Retrieve sample at new location.
        vec3 sampledValue = texture(u_frame, texCoord).xyz;
        // Apply sample attenuation scale/decay factors.
        sampledValue *= illuminationDecay * weight;
        // Accumulate combined color.
        inputColor += vec4(sampledValue, 0.0f);
        // Update exponential decay factor.
        illuminationDecay *= decay;
      }
    // }
  }

  return vec4(inputColor.xyz * exposure, 1.0);
}

// float4 main(float2 texCoord : TEXCOORD0) : COLOR0
// {
//   // Calculate vector from pixel to light source in screen space.
//    half2 deltaTexCoord = (texCoord - ScreenLightPos.xy);
//   // Divide by number of samples and scale by control factor.
//   deltaTexCoord *= 1.0f / NUM_SAMPLES * Density;
//   // Store initial sample.
//    half3 color = tex2D(frameSampler, texCoord);
//   // Set up illumination decay factor.
//    half illuminationDecay = 1.0f;
//   // Evaluate summation from Equation 3 NUM_SAMPLES iterations.
//    for (int i = 0; i < NUM_SAMPLES; i++)
//   {
//     // Step sample location along ray.
//     texCoord -= deltaTexCoord;
//     // Retrieve sample at new location.
//    half3 sample = tex2D(frameSampler, texCoord);
//     // Apply sample attenuation scale/decay factors.
//     sample *= illuminationDecay * Weight;
//     // Accumulate combined color.
//     color += sample;
//     // Update exponential decay factor.
//     illuminationDecay *= Decay;
//   }
//   // Output final color with a further scale control factor.
//    return float4( color * Exposure, 1);
// }

void main() {
  vec4 finalColor = texture(u_frame, fs_UV);
  finalColor = computeGodRay(finalColor);

  out_Col = finalColor;
}