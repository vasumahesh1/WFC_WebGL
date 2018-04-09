#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform vec2 u_DOF_Options; // x = Focal Length y = Focal plane size
uniform sampler2D u_frame;
uniform sampler2D u_gb0;
uniform ivec2 u_Dimensions;

vec3 getColor(float x, float y) {
  float posX = x / (float(u_Dimensions.x) - 1.0);
  float posY = y / (float(u_Dimensions.y) - 1.0);

  vec4 col = texture(u_frame, vec2(posX, posY));
  return col.xyz;
}

float getDepth(float x, float y) {
  // float posX = x / (float(u_Dimensions.x) - 1.0);
  // float posY = y / (float(u_Dimensions.y) - 1.0);

  vec4 col = texture(u_gb0, vec2(x, y));
  return col.w;
}

void main() {
  float cutoffDepth = u_DOF_Options.x + (u_DOF_Options.y / 2.0);

  float depth = getDepth(fs_UV.x, fs_UV.y);

  if (abs(depth) < cutoffDepth) {
    out_Col = vec4(0, 0, 0, 0);
    return;
  }

  vec4 finalColor = vec4(getColor(gl_FragCoord.x, gl_FragCoord.y), 1.0f);

  out_Col = finalColor;
}