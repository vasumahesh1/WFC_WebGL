#version 300 es
precision highp float;

#define EPS 0.0001
#define PI 3.1415962

in vec2 fs_UV;
out vec4 out_Col;

uniform sampler2D u_gb0;
uniform sampler2D u_gb1;
uniform sampler2D u_gb2;
uniform sampler2D u_gb3;
uniform sampler2D u_sm;

uniform float u_Time;

uniform vec3 u_LightPos;
uniform vec3 u_LightColor;
uniform ivec2 u_Dimensions;

uniform mat4 u_View;
uniform mat4 u_Proj;
uniform mat4 u_LightSpaceMatrix;
uniform mat4 u_LightViewportMatrix;
uniform vec4 u_CamPos;

#define MAX_POINT_LIGHTS 20
#define MAX_SPOT_LIGHTS 20

struct PointLight {
    vec4 ambient;
    vec4 diffuse;
    vec4 specular;

    vec3 position;
    float range;
    float contrib;

    vec3 attn;
};

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

vec4 calculateSpotLightContribution(vec4 inputColor, vec3 normal, vec3 fragPosition) {
  if (u_NumSpotLights <= uint(0)) {
    return inputColor;
  }

  float alpha = inputColor.a;

  vec4 ambient, diffuse, spec;

  vec4 totalLightContrib = vec4(0, 0, 0, 0);

  for (uint i = uint(0); i < u_NumSpotLights; i++) {
    SpotLight light = u_SpotLights[i];

    // Initialize outputs.
    ambient = vec4(0.0f, 0.0f, 0.0f, 0.0f);
    diffuse = vec4(0.0f, 0.0f, 0.0f, 0.0f);
    spec    = vec4(0.0f, 0.0f, 0.0f, 0.0f);
    
    // The vector from the surface to the light.
    vec3 lightVec = vec3(u_View * vec4(light.position, 1.0)) - fragPosition;
    
    // The distance from surface to light.
    float d = length(lightVec);
  
    // Range test.
    // if( d > light.range ) {
    //   totalLightContrib += ambient;
    //   continue;
    // }
    
    // Normalize the light vector.
    lightVec /= d; 
  
    // Ambient term.
    // ambient = light.ambient;  // TODO: Material

    // Add diffuse and specular term, provided the surface is in 
    // the line of site of the light.

    float diffuseTerm = dot(lightVec, normal);

    // Flatten to avoid dynamic branching.
    if( diffuseTerm > 0.0f ) {
      vec3 v         = reflect(-lightVec, normal);
      float specFactor = pow(max(dot(v, normalize(vec3(u_CamPos))), 0.0f), 128.0); // TODO: Material
            
      diffuse = diffuseTerm * light.diffuse;
      spec    = specFactor * light.specular;
    }

    float spot = pow(max(dot(-lightVec, normalize(vec3(u_View * vec4(light.direction, 0.0)))), 0.0), light.kSpot);

    // Attenuate
    float att = spot / dot(light.attn, vec3(1.0f, d, d * d));

    diffuse *= att;
    spec    *= att;
    // ambient *= spot;

    totalLightContrib += light.contrib * (diffuse + spec) + ambient;
  }

  totalLightContrib += vec4(0.1, 0.1, 0.1, 0);

  inputColor = inputColor * totalLightContrib;

  inputColor.a = alpha;

  // TODO: Material alhpa

  return inputColor;
}

vec4 calculateMainLighting(vec4 inputColor, vec3 normal) {
  float alpha = inputColor.a;
  
  // Initialize outputs.
  vec4 ambient = vec4(0.0f, 0.0f, 0.0f, 0.0f);
  vec4 diffuse = vec4(0.0f, 0.0f, 0.0f, 0.0f);
  vec4 spec    = vec4(0.0f, 0.0f, 0.0f, 0.0f);

  // The vector from the surface to the light.
  vec3 lightVec = normalize(u_LightPos); // Directional Light
  
  // Ambient term.
  ambient = vec4(vec3(1.0), 1);

  // Add diffuse and specular term
  float diffuseTerm = dot(lightVec, normal);

  if( diffuseTerm > 0.0f ) {
    vec3 v         = reflect(-lightVec, normal);
    float specFactor = pow(max(dot(v, normalize(vec3(u_CamPos))), 0.0f), 128.0);
          
    diffuse = diffuseTerm * vec4(u_LightColor, 1.0);
    spec    = specFactor * vec4(u_LightColor, 1.0);
  }

  vec4 totalLightContrib = diffuse + spec + ambient;

  inputColor = inputColor * totalLightContrib;
  // inputColor = (inputColor * diffuse) + spec + ambient;

  inputColor.a = alpha;

  return inputColor;
}

void main() { 
	// read from GBuffers

  vec4 gb0 = texture(u_gb0, fs_UV);
  vec4 gb1 = texture(u_gb1, fs_UV);
  vec4 gb2 = texture(u_gb2, fs_UV);
  vec4 gb3 = texture(u_gb3, fs_UV);
	
  vec3 normal = gb0.xyz;
  float cameraDepth = gb0.w;

  float posX = (fs_UV.x / float(u_Dimensions.x)) * 2.0 - 1.0;
  float posY = 1.0 - (fs_UV.y / float(u_Dimensions.y)) * 2.0;

  vec2 ndcVec2 = vec2(posX, posY);

  float t = (cameraDepth - 0.1) / (100.0 - 0.1);
  // t = t * 2.0 - 1.0;
  // t = clamp(t, 0.0, 1.0);

  vec4 ndc = vec4(ndcVec2, t, 1.0) * cameraDepth;
  vec4 cameraSpacePos = inverse(u_Proj) * ndc;
  // cameraSpacePos /= cameraSpacePos.w;

  // float aspect = float(u_Dimensions.x) / float(u_Dimensions.y);

  // float fovy = 45.0 * 3.1415962 / 180.0;

  // vec3 ref =  vec3(0.0) + t * vec3(0, 0, 1);
  // float len = length(ref - vec3(0.0));
  // vec3 V = vec3(0,1,0) * len * tan(fovy / 2.0);
  // vec3 H = vec3(1,0,0) * aspect * len * tan(fovy / 2.0);

  // vec3 cameraSpacePos = ref + (ndc.x * H) + (ndc.y * V);

	vec4 diffuseColor = gb2;

  vec4 finalColor = calculateMainLighting(diffuseColor, normal);

  finalColor = calculateSpotLightContribution(finalColor, normal, gb1.xyz);
  // finalColor = calculateSpotLightContribution(finalColor, normal, cameraSpacePos.xyz);

  finalColor += (vec4(gb3.xyz, 0.0f) * 5.0);

  vec4 worldPos = inverse(u_View) * vec4(gb1.xyz, 1.0f);

  vec4 lightSpace = u_LightSpaceMatrix * worldPos;
  float shadowDepth = texture(u_sm, vec2((lightSpace.x + 1.0) * 0.5, (lightSpace.y + 1.0) * 0.5)).z;

  float bias = 0.005;
  if (shadowDepth < lightSpace.z  - bias) {
      finalColor = vec4(finalColor.xyz * 0.5, finalColor.a);
  }

	out_Col = finalColor;

  float distance = length(worldPos - u_CamPos);

  vec4 currentFog = vec4(0, 0, 0, 1);

  if (distance > 40.0f) {
    distance = distance - 40.0f;
    float power = distance * 0.1f;

    // Exponential Fog but start only some units ahead of the player
    // 1 - exp(-length(wpos - cpos) * c)
    float fogFactor = 1.0 - exp(-power);
    fogFactor = clamp(fogFactor, 0.0, 1.0);

    out_Col = mix(out_Col, currentFog, fogFactor);
  }
}