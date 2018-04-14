import { vec2, vec3, vec4, mat4 } from 'gl-matrix';
import { gl } from '../globals';

class SpotLight {
  ambient: vec4;
  diffuse: vec4;
  specular: vec4;

  position: vec3;
  range: number;
  contrib: number = 1;

  direction: vec3;
  kSpot: number;

  attn: vec3;

  constructor() {
  }

  static markLocations(program:any, container: any, numLights: number, variableName: string) {
    let attrLocations = [
      "ambient",
      "diffuse",
      "specular",
      "position",
      "range",
      "contrib",
      "direction",
      "kSpot",
      "attn"
    ];

    for (var lightItr = 0; lightItr < numLights; ++lightItr) {
      var uniformMap: any = {};

      for (var locItr = 0; locItr < attrLocations.length; ++locItr) {
        var name = attrLocations[locItr];
        uniformMap[name] = gl.getUniformLocation(program, variableName + "[" + lightItr + "]." + name);
      }

      container[lightItr] = uniformMap;
    }
  }

  setSpotLightData(uniformMap:any) {
    if (uniformMap.ambient == -1) {
      return;
    }

    gl.uniform4fv(uniformMap.ambient, this.ambient);
    gl.uniform4fv(uniformMap.diffuse, this.diffuse);
    gl.uniform4fv(uniformMap.specular, this.specular);
    gl.uniform3fv(uniformMap.position, this.position);
    gl.uniform1f(uniformMap.range, this.range);
    gl.uniform1f(uniformMap.contrib, this.contrib);
    gl.uniform3fv(uniformMap.direction, this.direction);
    gl.uniform1f(uniformMap.kSpot, this.kSpot);
    gl.uniform3fv(uniformMap.attn, this.attn);
  }
}

export default SpotLight;