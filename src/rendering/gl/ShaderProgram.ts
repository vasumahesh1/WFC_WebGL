import {vec4, mat4, vec3, mat3} from 'gl-matrix';
import Drawable from './Drawable';
import Texture from './Texture';
import {gl} from '../../globals';

var activeProgram: WebGLProgram = null;

export class Shader {
  shader: WebGLShader;

  constructor(type: number, source: string) {
    this.shader = gl.createShader(type);
    gl.shaderSource(this.shader, source);
    gl.compileShader(this.shader);

    if (!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(this.shader);
    }
  }
};

class ShaderProgram {
  prog: WebGLProgram;

  attrVertPos: number;
  attrNor: number;
  attrUv: number;
  attrCol: number;
  attrInstancePos: number;
  attrInstanceScale: number;
  attrInstanceRotation: number;

  unifModel: WebGLUniformLocation;
  unifModelInvTr: WebGLUniformLocation;
  unifViewProj: WebGLUniformLocation;
  unifView: WebGLUniformLocation;
  unifProj: WebGLUniformLocation;
  unifColor: WebGLUniformLocation;
  unifTime: WebGLUniformLocation;
  unifEye: WebGLUniformLocation;

  unifTexUnits: Map<string, WebGLUniformLocation>;

  unifSMLightSpace: WebGLUniformLocation;
  unifSMLightViewport: WebGLUniformLocation;

  constructor(shaders: Array<Shader>) {
    this.prog = gl.createProgram();

    for (let shader of shaders) {
      gl.attachShader(this.prog, shader.shader);
    }
    gl.linkProgram(this.prog);
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(this.prog);
    }

    this.attrVertPos = gl.getAttribLocation(this.prog, "vs_Pos");
    this.attrNor = gl.getAttribLocation(this.prog, "vs_Nor");
    this.attrCol = gl.getAttribLocation(this.prog, "vs_Col");
    this.attrUv = gl.getAttribLocation(this.prog, "vs_UV");
    this.attrInstancePos = gl.getAttribLocation(this.prog, "vs_InstPos");
    this.attrInstanceScale = gl.getAttribLocation(this.prog, "vs_InstScale");
    this.attrInstanceRotation = gl.getAttribLocation(this.prog, "vs_InstRotation");
    
    this.unifModel = gl.getUniformLocation(this.prog, "u_Model");
    this.unifEye = gl.getUniformLocation(this.prog, "u_Eye");
    this.unifModelInvTr = gl.getUniformLocation(this.prog, "u_ModelInvTr");
    this.unifViewProj = gl.getUniformLocation(this.prog, "u_ViewProj");
    this.unifView = gl.getUniformLocation(this.prog, "u_View");
    this.unifProj = gl.getUniformLocation(this.prog, "u_Proj");
    this.unifColor = gl.getUniformLocation(this.prog, "u_Color");
    this.unifTime = gl.getUniformLocation(this.prog, "u_Time");

    this.unifSMLightSpace = gl.getUniformLocation(this.prog, "u_LightSpaceMatrix");
    this.unifSMLightViewport = gl.getUniformLocation(this.prog, "u_LightViewportMatrix");

    this.unifTexUnits = new Map<string, WebGLUniformLocation>();
  }

  setEye(vec: vec3) {
    this.use();
    if (this.unifEye !== -1) {
      gl.uniform3fv(this.unifEye, vec);
    }
  }

  setShadowMapMatrices(lightSpace: mat4, lightViewport: mat4) {
    this.use();
    if (this.unifSMLightSpace !== -1) {
      gl.uniformMatrix4fv(this.unifSMLightSpace, false, lightSpace);
    }

    if (this.unifSMLightViewport !== -1) {
      gl.uniformMatrix4fv(this.unifSMLightViewport, false, lightViewport);
    }
  }

  setupTexUnits(handleNames: Array<string>) {
    for (let handle of handleNames) {
      var location = gl.getUniformLocation(this.prog, handle);
      if (location !== -1) {
        this.unifTexUnits.set(handle, location);
      } else {
        console.log("Could not find handle for texture named: \'" + handle + "\'!");
      }
    }
  }

  // Bind the given Texture to the given texture unit
  bindTexToUnit(handleName: string, tex: Texture, unit: number) {
    this.use();
    var location = this.unifTexUnits.get(handleName);
    if (location !== undefined) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      tex.bindTex();
      gl.uniform1i(location, unit);
    } else {
      console.log("Texture with handle name: \'" + handleName + "\' was not found");
    }
  }

  use() {
    if (activeProgram !== this.prog) {
      gl.useProgram(this.prog);
      activeProgram = this.prog;
    }
  }

  setModelMatrix(model: mat4) {
    this.use();
    if (this.unifModel !== -1) {
      gl.uniformMatrix4fv(this.unifModel, false, model);
    }

    if (this.unifModelInvTr !== -1) {
      let modelinvtr: mat4 = mat4.create();
      mat4.transpose(modelinvtr, model);
      mat4.invert(modelinvtr, modelinvtr);
      gl.uniformMatrix4fv(this.unifModelInvTr, false, modelinvtr);
    }
  }

  setViewProjMatrix(vp: mat4) {
    this.use();
    if (this.unifViewProj !== -1) {
      gl.uniformMatrix4fv(this.unifViewProj, false, vp);
    }
  }

  setViewMatrix(vp: mat4) {
    this.use();
    if (this.unifView !== -1) {
      gl.uniformMatrix4fv(this.unifView, false, vp);
    }
  }

  setProjMatrix(vp: mat4) {
    this.use();
    if (this.unifProj !== -1) {
      gl.uniformMatrix4fv(this.unifProj, false, vp);
    }
  }

  setGeometryColor(color: vec4) {
    this.use();
    if (this.unifColor !== -1) {
      gl.uniform4fv(this.unifColor, color);
    }
  }

  setTime(t: number) {
    this.use();
    if (this.unifTime !== -1) {
      gl.uniform1f(this.unifTime, t);
    }
  }

  draw(d: Drawable) {
    this.use();

    if (this.attrVertPos != -1 && d.bindVert()) {
      gl.enableVertexAttribArray(this.attrVertPos);
      gl.vertexAttribPointer(this.attrVertPos, 4, gl.FLOAT, false, 0, 0);

      if (d.isInstanced()) {
        gl.vertexAttribDivisor(this.attrVertPos, 0);
      }
    }

    if (this.attrInstancePos != -1 && d.bindInstancePos()) {
      gl.enableVertexAttribArray(this.attrInstancePos);
      gl.vertexAttribPointer(this.attrInstancePos, 4, gl.FLOAT, false, 0, 0);

      if (d.isInstanced()) {
        gl.vertexAttribDivisor(this.attrInstancePos, 1);
      }
    }

    if (this.attrInstanceRotation != -1 && d.bindInstanceRotation()) {
      gl.enableVertexAttribArray(this.attrInstanceRotation);
      gl.vertexAttribPointer(this.attrInstanceRotation, 4, gl.FLOAT, false, 0, 0);

      if (d.isInstanced()) {
        gl.vertexAttribDivisor(this.attrInstanceRotation, 1);
      }
    }

    if (this.attrInstanceScale != -1 && d.bindInstanceScale()) {
      gl.enableVertexAttribArray(this.attrInstanceScale);
      gl.vertexAttribPointer(this.attrInstanceScale, 4, gl.FLOAT, false, 0, 0);

      if (d.isInstanced()) {
        gl.vertexAttribDivisor(this.attrInstanceScale, 1);
      }
    }

    if (this.attrNor != -1 && d.bindNor()) {
      gl.enableVertexAttribArray(this.attrNor);
      gl.vertexAttribPointer(this.attrNor, 4, gl.FLOAT, false, 0, 0);

      if (d.isInstanced()) {
        gl.vertexAttribDivisor(this.attrNor, 0);
      }
    }

    if (this.attrCol != -1 && d.bindCol()) {
      gl.enableVertexAttribArray(this.attrCol);
      gl.vertexAttribPointer(this.attrCol, 4, gl.FLOAT, false, 0, 0);

      if (d.isInstanced()) {
        gl.vertexAttribDivisor(this.attrCol, 0);
      }
    }

    if (this.attrUv != -1 && d.bindUv()) {
      gl.enableVertexAttribArray(this.attrUv);
      gl.vertexAttribPointer(this.attrUv, 2, gl.FLOAT, false, 0, 0);

      if (d.isInstanced()) {
        gl.vertexAttribDivisor(this.attrUv, 0);
      }
    }

    d.bindIdx();

    if (d.isInstanced()) {
      gl.drawElementsInstanced(d.drawMode(), d.elemCount(), gl.UNSIGNED_INT, 0, d.instanceCount());
    } else {
      gl.drawElements(d.drawMode(), d.elemCount(), gl.UNSIGNED_INT, 0);
    }

    if (this.attrVertPos != -1) gl.disableVertexAttribArray(this.attrVertPos);
    if (this.attrNor != -1) gl.disableVertexAttribArray(this.attrNor);
    if (this.attrInstancePos != -1) gl.disableVertexAttribArray(this.attrInstancePos);
    if (this.attrInstanceRotation != -1) gl.disableVertexAttribArray(this.attrInstanceRotation);
    if (this.attrInstanceScale != -1) gl.disableVertexAttribArray(this.attrInstanceScale);
    if (this.attrNor != -1) gl.disableVertexAttribArray(this.attrNor);
    if (this.attrCol != -1) gl.disableVertexAttribArray(this.attrCol);
    if (this.attrUv != -1) gl.disableVertexAttribArray(this.attrUv);
  }
};

export default ShaderProgram;
