import { mat4 } from 'gl-matrix';
import {gl} from '../../globals';

abstract class Drawable {
  count: number = 0;
  instances: number = 0;
  instanced: boolean = false;
  lines: boolean = false;

  modelMatrix: mat4 = mat4.create();

  bufIdx: WebGLBuffer;
  bufVert: WebGLBuffer;
  bufNor: WebGLBuffer;
  bufCol: WebGLBuffer;
  bufUv: WebGLBuffer;
  bufInstancePosition: WebGLBuffer;
  bufInstanceRotation: WebGLBuffer;
  bufInstanceScale: WebGLBuffer;

  idxBound: boolean = false;
  vertBound: boolean = false;
  norBound: boolean = false;
  colBound: boolean = false;
  uvBound: boolean = false;
  instPosBound: boolean = false;
  instScaBound: boolean = false;
  instRotBound: boolean = false;

  abstract create() : void;

  destory() {
    gl.deleteBuffer(this.bufIdx);
    gl.deleteBuffer(this.bufVert);
    gl.deleteBuffer(this.bufNor);
    gl.deleteBuffer(this.bufCol);
    gl.deleteBuffer(this.bufInstancePosition);
    gl.deleteBuffer(this.bufInstanceRotation);
    gl.deleteBuffer(this.bufInstanceScale);
  }

  generateIdx() {
    this.idxBound = true;
    this.bufIdx = gl.createBuffer();
  }

  generateVert() {
    this.vertBound = true;
    this.bufVert = gl.createBuffer();
  }

  generateInstancePos() {
    this.instPosBound = true;
    this.bufInstancePosition = gl.createBuffer();
  }

  generateInstanceScale() {
    this.instScaBound = true;
    this.bufInstanceScale = gl.createBuffer();
  }

  generateInstanceRotation() {
    this.instRotBound = true;
    this.bufInstanceRotation = gl.createBuffer();
  }

  generateNor() {
    this.norBound = true;
    this.bufNor = gl.createBuffer();
  }

  generateUv() {
    this.uvBound = true;
    this.bufUv = gl.createBuffer();
  }

  generateColor() {
    this.colBound = true;
    this.bufCol = gl.createBuffer();
  }

  bindIdx(): boolean {
    if (this.idxBound) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    }
    return this.idxBound;
  }

  bindVert(): boolean {
    if (this.vertBound) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufVert);
    }
    return this.vertBound;
  }

  bindCol(): boolean {
    if (this.colBound) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol);
    }
    return this.colBound;
  }

  bindInstancePos(): boolean {
    if (this.instPosBound) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInstancePosition);
    }
    return this.instPosBound;
  }

  bindInstanceRotation(): boolean {
    if (this.instRotBound) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInstanceRotation);
    }
    return this.instRotBound;
  }

  bindInstanceScale(): boolean {
    if (this.instScaBound) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInstanceScale);
    }
    return this.instScaBound;
  }

  bindNor(): boolean {
    if (this.norBound) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufNor);
    }
    return this.norBound;
  }

  bindUv(): boolean {
    if (this.uvBound) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUv);
    }
    return this.uvBound;
  }

  elemCount(): number {
    return this.count;
  }

  instanceCount(): number {
    return this.instances;
  }

  drawMode(): GLenum {
    if (this.lines) {
      return gl.LINES;
    }

    return gl.TRIANGLES;
  }

  isInstanced(): boolean {
    return this.instanced;
  }
};

export default Drawable;
