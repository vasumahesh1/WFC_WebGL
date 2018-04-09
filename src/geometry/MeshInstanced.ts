import { vec2, vec3, vec4, mat4 } from 'gl-matrix';
import Drawable from '../rendering/gl/Drawable';
import { gl } from '../globals';

var Loader = require('webgl-obj-loader');

var Logger = require('debug');
var dCreate = Logger("mainApp:meshInstanced:trace");
var dCreateInfo = Logger("mainApp:meshInstanced:info");

let CHUNK_SIZE = 200;

function concatFloat32Array(first: Float32Array, second: Float32Array) {
  var firstLength = first.length;
  var secondLength = second.length
  var result = new Float32Array(firstLength + secondLength);

  result.set(first);
  result.set(second, firstLength);

  return result;
}

function concatUint32Array(first: Uint32Array, second: Uint32Array) {
  var firstLength = first.length;
  var secondLength = second.length
  var result = new Uint32Array(firstLength + secondLength);

  result.set(first);
  result.set(second, firstLength);

  return result;
}


function degreeToRad(deg: number) {
  return deg * 0.0174533;
}

class MeshInstanced extends Drawable {
  indices: Uint32Array;
  vertices: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  positions: Float32Array;
  scales: Float32Array;
  rotations: Float32Array;
  uvs: Float32Array;

  instancePosition: Array<number>;
  instanceScale: Array<number>;
  instanceRotation: Array<number>;

  baseColor: vec4;
  uvOffset: vec2;
  uvScale: number;
  rawMesh: any;

  name: string;
  objString: string;

  constructor(n: string = "Unknown Mesh", objString: string) {
    super();
    this.instanced = true;
    this.name = n;

    this.objString = objString;
    this.uvScale = 1.0;

    let model = mat4.create();
    mat4.identity(model);
    this.modelMatrix = model;

    this.instances = 0;
    this.baseColor = vec4.fromValues(1,1,1,1);
    this.uvOffset = vec2.fromValues(0,0);

    this.instancePosition = new Array<number>();
    this.instanceScale = new Array<number>();
    this.instanceRotation = new Array<number>();

    this.positions = new Float32Array([]);
    this.scales = new Float32Array([]);
    this.rotations = new Float32Array([]);
    this.normals = new Float32Array([]);
    this.vertices = new Float32Array([]);
    this.colors = new Float32Array([]);
    this.uvs = new Float32Array([]);
    this.indices = new Uint32Array([]);
  }

  load(url: string) {
    let ref = this;

    return new Promise(function(resolve, reject) {
      Loader.downloadMeshes({ mesh: url }, function(meshes: any) {
        ref.rawMesh = meshes.mesh;
        resolve();
      });
    });
  }

  setColor(color: vec4) {
    this.baseColor = color;
  }

  addInstance(position: vec4, orient: vec4, scale: vec3) {

    this.instancePosition.push(position[0], position[1], position[2], position[3]);
    this.instanceScale.push(scale[0], scale[1], scale[2], 0.0);
    this.instanceRotation.push(orient[0], orient[1], orient[2], orient[3]);

    this.instances++;
  }

  create() {
    this.vertices = new Float32Array([]);
    this.colors = new Float32Array([]);
    this.indices = new Uint32Array([]);
    this.normals = new Float32Array([]);

    this.rawMesh = new Loader.Mesh(this.objString);

    let vertices = this.rawMesh.vertices;
    let indices = this.rawMesh.indices;
    let vertexNormals = this.rawMesh.vertexNormals;
    let vertexUvs = this.rawMesh.textures;

    let vertexCount = vertices.length;

    dCreate("Loading Vertices: " + vertexCount);
    dCreate("Loading Indices: " + indices.length);
    dCreate("Loading Normals: " + vertexNormals.length);

    let colorArr =  new Float32Array([
      this.baseColor[0],
      this.baseColor[1],
      this.baseColor[2],
      1.0
    ]);

    let uvCounter = 0;

    for (var itr = 0; itr < vertexCount; itr+= 3) {
      let arr =  new Float32Array([
        vertices[itr],
        vertices[itr + 1],
        vertices[itr + 2],
        1.0
      ]);

      let arrN =  new Float32Array([
        vertexNormals[itr],
        vertexNormals[itr + 1],
        vertexNormals[itr + 2],
        1.0
      ]);

      let arrUV =  new Float32Array([
        this.uvOffset[0] + vertexUvs[uvCounter] * this.uvScale,
        this.uvOffset[1] + vertexUvs[uvCounter + 1] * this.uvScale
      ]);

      uvCounter += 2;

      this.vertices = concatFloat32Array(this.vertices, arr);
      this.normals = concatFloat32Array(this.normals, arrN);
      this.colors = concatFloat32Array(this.colors, colorArr);
      this.uvs = concatFloat32Array(this.uvs, arrUV);
    }

    this.positions = new Float32Array(this.instancePosition);
    this.rotations = new Float32Array(this.instanceRotation);
    this.scales = new Float32Array(this.instanceScale);

    this.indices = new Uint32Array(indices);

    this.generateIdx();
    this.generateVert();
    this.generateNor();
    this.generateUv();
    this.generateColor();
    this.generateInstancePos();
    this.generateInstanceRotation();
    this.generateInstanceScale();

    this.count = this.indices.length;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufNor);
    gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInstancePosition);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInstanceRotation);
    gl.bufferData(gl.ARRAY_BUFFER, this.rotations, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInstanceScale);
    gl.bufferData(gl.ARRAY_BUFFER, this.scales, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufVert);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol);
    gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUv);
    gl.bufferData(gl.ARRAY_BUFFER, this.uvs, gl.STATIC_DRAW);
      
    dCreateInfo(`Created ${this.name} with ${this.instances} Instances`);
  }
};

export default MeshInstanced;
