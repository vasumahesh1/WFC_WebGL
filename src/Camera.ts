import * as CameraControls from '3d-view-controls';
import {vec3, mat4} from 'gl-matrix';

class Camera {
  controls: any;
  projectionMatrix: mat4 = mat4.create();
  viewMatrix: mat4 = mat4.create();
  fovy: number = 45.0 * 3.1415962 / 180.0;
  aspectRatio: number = 1;
  near: number = 0.1;
  far: number = 1000;
  position: vec3 = vec3.create();
  direction: vec3 = vec3.create();
  target: vec3 = vec3.create();
  up: vec3 = vec3.create();

  constructor(position: vec3, target: vec3) {
    this.controls = CameraControls(document.getElementById('canvas'), {
      eye: position,
      center: target,
    });
    // this.controls.mode = 'turntable';
    vec3.add(this.target, this.position, this.direction);
    mat4.lookAt(this.viewMatrix, this.controls.eye, this.controls.center, this.controls.up);
  }

  setAspectRatio(aspectRatio: number) {
    this.aspectRatio = aspectRatio;
  }

  updateProjectionMatrix() {
    mat4.perspective(this.projectionMatrix, this.fovy, this.aspectRatio, this.near, this.far);
  }

  getPosition() {
    return this.controls.eye;
  }

  update(cameraControls? : any) {
    this.controls.tick();

    vec3.add(this.target, this.position, this.direction);
    mat4.lookAt(this.viewMatrix, this.controls.eye, this.controls.center, this.controls.up);
    this.updateProjectionMatrix();

    if (cameraControls && cameraControls.isOrtho) {  
      mat4.ortho(this.projectionMatrix, -100.0, 100.0, -100.0, 100.0, -100, 200.0);
      mat4.lookAt(this.viewMatrix, [30, 40, 30], vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 1));
    }

  }
};

export default Camera;
