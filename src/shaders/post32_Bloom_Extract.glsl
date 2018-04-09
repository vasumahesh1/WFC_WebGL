#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform float u_Bloom_DS;
uniform sampler2D u_frame;

void main() {
  vec4 baseColor = texture(u_frame, fs_UV * u_Bloom_DS);
  float brightness = dot(baseColor.rgb, vec3(0.2126, 0.7152, 0.0722));

  if(brightness > 1.0) {
    out_Col = vec4(baseColor.rgb, 1.0);
  }
  else {
    out_Col = vec4(0.0, 0.0, 0.0, 1.0);
  }
}