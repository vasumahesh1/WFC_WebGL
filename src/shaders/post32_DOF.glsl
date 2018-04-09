#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform float u_DOF_Blend;
uniform float u_DOF_Focal;
uniform sampler2D u_frame;
uniform sampler2D u_gb0;
uniform ivec2 u_Dimensions;

const int FILTER_SIZE = 11;
const float BLUR_MATRIX[121] = float[](
    0.006849, 0.007239, 0.007559, 0.007795, 0.007941, 0.00799, 0.007941,
    0.007795, 0.007559, 0.007239, 0.006849, 0.007239, 0.007653, 0.00799,
    0.00824, 0.008394, 0.008446, 0.008394, 0.00824, 0.00799, 0.007653, 0.007239,
    0.007559, 0.00799, 0.008342, 0.008604, 0.008764, 0.008819, 0.008764,
    0.008604, 0.008342, 0.00799, 0.007559, 0.007795, 0.00824, 0.008604,
    0.008873, 0.009039, 0.009095, 0.009039, 0.008873, 0.008604, 0.00824,
    0.007795, 0.007941, 0.008394, 0.008764, 0.009039, 0.009208, 0.009265,
    0.009208, 0.009039, 0.008764, 0.008394, 0.007941, 0.00799, 0.008446,
    0.008819, 0.009095, 0.009265, 0.009322, 0.009265, 0.009095, 0.008819,
    0.008446, 0.00799, 0.007941, 0.008394, 0.008764, 0.009039, 0.009208,
    0.009265, 0.009208, 0.009039, 0.008764, 0.008394, 0.007941, 0.007795,
    0.00824, 0.008604, 0.008873, 0.009039, 0.009095, 0.009039, 0.008873,
    0.008604, 0.00824, 0.007795, 0.007559, 0.00799, 0.008342, 0.008604,
    0.008764, 0.008819, 0.008764, 0.008604, 0.008342, 0.00799, 0.007559,
    0.007239, 0.007653, 0.00799, 0.00824, 0.008394, 0.008446, 0.008394, 0.00824,
    0.00799, 0.007653, 0.007239, 0.006849, 0.007239, 0.007559, 0.007795,
    0.007941, 0.00799, 0.007941, 0.007795, 0.007559, 0.007239, 0.006849);

vec3 getColor(float x, float y) {
  float posX = x / (float(u_Dimensions.x) - 1.0);
  float posY = y / (float(u_Dimensions.y) - 1.0);

  vec4 col = texture(u_frame, vec2(posX, posY));
  return col.xyz;
}

float getDepth(float x, float y) {
  float posX = x / (float(u_Dimensions.x) - 1.0);
  float posY = y / (float(u_Dimensions.y) - 1.0);

  vec4 col = texture(u_gb0, vec2(posX, posY));
  return col.w;
}

void main() {
  int halfSize = FILTER_SIZE / 2;

  vec2 coords = gl_FragCoord.xy - float(halfSize);

  float depth = getDepth(coords.x, coords.y);

  vec3 baseColor = getColor(coords.x, coords.y);

  float amount = clamp(depth / u_DOF_Focal, 0.0, 1.0);

  vec3 val = vec3(0, 0, 0);

  for (int i = 0; i < FILTER_SIZE; i++) {
    float x = coords.x + float(i);

    for (int j = 0; j < FILTER_SIZE; j++) {
      float y = coords.y + float(j);

      int key = j + (FILTER_SIZE * i);

      float filterValue = BLUR_MATRIX[key];
      val += filterValue * getColor(x, y);
    }
  }

  vec4 finalColor = vec4(mix(baseColor, val, amount), 1.0);

  out_Col = finalColor;
}