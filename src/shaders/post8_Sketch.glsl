#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform ivec2 u_Dimensions;
uniform sampler2D u_frame;

void main() {
  float hatchYoffset = 5.0;
  float luminanceThreshold1 = 1.0 / 4.0;
  float luminanceThreshold2 = 0.7 / 4.0;
  float luminanceThreshold3 = 0.5 / 4.0;
  float luminanceThreshold4 = 0.3 / 4.0;

  vec4 finalColor = texture(u_frame, fs_UV);

  float lum = dot(finalColor.rgb, vec3(0.2126, 0.7152, 0.0722));

  vec4 multiplier = vec4(1.0,1.0,1.0, 1.0);

  vec2 pos = vec2(fs_UV.x * float(u_Dimensions.x), fs_UV.y * float(u_Dimensions.y));

  if (lum < luminanceThreshold1)
  {
    float value = mod(floor(pos.x + pos.y), 10.0);
    if (value == 0.0)
    multiplier = vec4(0.0, 0.0, 0.0, 1.0); 
  }

  if (lum < luminanceThreshold2)
  {
    float value = mod(floor(pos.x - pos.y) , 10.0);
    if (value == 0.0) {
      multiplier = vec4(0.0, 0.0, 0.0, 1.0);
    }
  }

  if (lum < luminanceThreshold3)
  {
    float value = mod(floor(pos.x + pos.y - hatchYoffset), 10.0);
    if (value == 0.0) {
      multiplier = vec4(0.0, 0.0, 0.0, 1.0);
    }
  }

  if (lum < luminanceThreshold4)
  {

    float value = mod(floor(pos.x - pos.y - hatchYoffset), 10.0);
    if (value == 0.0) {
      multiplier = vec4(0.0, 0.0, 0.0, 1.0);
    }
  }


  out_Col = multiplier;
}