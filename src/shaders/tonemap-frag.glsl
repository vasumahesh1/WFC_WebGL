#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform sampler2D u_frame;
uniform int u_UseTonemap;

// Uncharted 2 Tonemapping made by John Hable, filmicworlds.com
vec3 uc2Tonemap(vec3 x)
{
   return ((x*(0.15*x+0.1*0.5)+0.2*0.02)/(x*(0.15*x+0.5)+0.2*0.3))-0.02/0.3;
}

vec3 tonemap(vec3 x, float exposure, float invGamma, float whiteBalance) {
    vec3 white = vec3(whiteBalance);
    vec3 color = uc2Tonemap(exposure * x);
    vec3 whitemap = 1.0 / uc2Tonemap(white);
    color *= whitemap;
    return pow(color, vec3(invGamma));
}

void main() {
	vec3 fragColor = texture(u_frame, fs_UV).xyz;

  if (u_UseTonemap > 0) {
    float whiteBalance = 9.2;
    float exposure = 10.0;
    float invGamma = 1.0 / 0.8;

    fragColor = tonemap(fragColor , exposure, invGamma, whiteBalance);
  }

  out_Col = vec4(fragColor, 1.0);
}
