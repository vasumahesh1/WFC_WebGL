import {vec2, vec3, vec4, mat4, glMatrix} from 'gl-matrix';
import * as Stats from 'stats-js';
import * as DAT from 'dat-gui';
import MeshInstanced from './geometry/MeshInstanced';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import {setGL} from './globals';
import {readTextFile} from './globals';
import ShaderProgram, {Shader} from './rendering/gl/ShaderProgram';
import Texture from './rendering/gl/Texture';
import SpotLight from './lights/SpotLight';
import WFC from './WFC';

// Define an object with application parameters and button callbacks
// const controls = {
//   // Extra credit: Add interactivity
// };

function axisAngleToQuaternion(axis: vec3, angle: number) {
  let quat = vec4.create();
  let cos = Math.cos(angle / 2.0);
  let sin = Math.sin(angle / 2.0);

  let scaledAxis = vec3.create();
  vec3.scale(scaledAxis, axis, sin);

  quat[0] = scaledAxis[0];
  quat[1] = scaledAxis[1];
  quat[2] = scaledAxis[2];
  quat[3] = cos;

  return quat;
}

let shouldCapture: boolean = false;

const MOONLIGHT_COLOR = [68, 77, 175];
const WHITE_COLOR = [255, 255, 255];
let useMoonlight:boolean = true;

function toggleLightColor() {
  if (useMoonlight) {
    controls.skyLight.color = WHITE_COLOR;
  } else {
    controls.skyLight.color = MOONLIGHT_COLOR;
  }

  useMoonlight = !useMoonlight;
}

let wfc: any;

function doWFC() {
  wfc = new WFC('Test', null, 20, 20, 6, true, "empty");

  for (let k = 0; k < 10; k++) {
    let result = wfc.run();

    if (result) {
      console.log('DONE!');
      break;

    } else {
      // console.log(wfc.textOutput());
      // console.log(wfc.observed);
      console.log('CONTRADICTION!');
    }
  }

  return wfc.transformOutput();
}

const SM_VIEWPORT_TRANSFORM:mat4 = mat4.fromValues(
  0.5, 0.0, 0.0, 0.0,
  0.0, 0.5, 0.0, 0.0,
  0.0, 0.0, 0.5, 0.0,
  0.5, 0.5, 0.5, 1.0);

let controls = {
  saveImage: saveImage,
  doWFC: doWFC,
  toggleLightColor: toggleLightColor,
  skyLight: {
    color: WHITE_COLOR,
    intensity: 6,
    direction: [15, 15, 15]
  },
  godray: {
    enabled: true,
    blend: 1.0,
    iterations: 4,
    density: 1.0,
    weight: 0.75,
    decay: 0.75,
    exposure: 1.0
  },
  dof: {
    enabled: false,
    focalLength: 20,
    inFocusPlaneSize: 15,
    blend: 1.0
  },
  tonemap: {
    enabled: true
  },
  bloom: {
    enabled: true,
    blend: 1.0,
    iterations: 1
  },
  artistic: {
    effect: 'none'
  }
};

let obj0: string;

let tex0: Texture;
let lights: Array<SpotLight> = [];

let meshes:any = {
  'down' : './resources/test/down.obj',
  'line' : './resources/test/line.obj',
  'turn' : './resources/test/turn.obj',
  'up' : './resources/test/up.obj',
  'ground' : './resources/test/ground.obj',
  'vertical' : './resources/test/vertical.obj',
  'wall1' : './resources/test/wall1.obj',
  'gate1' : './resources/test/gate1.obj',
  'stair1' : './resources/test/stair1.obj',
  'stair2' : './resources/test/stair2.obj',
  'filler1' : './resources/test/filler1.obj',
  'platform' : './resources/test/platform.obj',
  'pipeL' : './resources/test/pipe1.obj',
  'pipeT' : './resources/test/pipe2.obj',
  'wallside1' : './resources/test/wallside1.obj',
};

let textures: any = [
  ['./resources/test/down.png', './resources/textures/default_emissive.png'],
  ['./resources/test/line.png', './resources/textures/default_emissive.png'],
  ['./resources/test/turn.png', './resources/textures/default_emissive.png'],
  ['./resources/test/up.png', './resources/textures/default_emissive.png'],
  ['./resources/test/ground.png', './resources/textures/default_emissive.png'],
  ['./resources/test/vertical.png', './resources/textures/default_emissive.png'],
  ['./resources/test/wall1.png', './resources/textures/default_emissive.png'],
  ['./resources/test/gate1.png', './resources/textures/default_emissive.png'],
  ['./resources/test/stair1.png', './resources/textures/default_emissive.png'],
  ['./resources/test/stair2.png', './resources/textures/default_emissive.png'],
  ['./resources/test/filler1.png', './resources/textures/default_emissive.png'],
  ['./resources/test/platform.png', './resources/textures/default_emissive.png'],
  ['./resources/test/pipe1.png', './resources/textures/default_emissive.png'],
  ['./resources/test/pipe2.png', './resources/textures/default_emissive.png'],
  ['./resources/test/wallside1.png', './resources/textures/default_emissive.png'],
];

let sceneOBJs: { [symbol: string]: string; } = { };
let sceneMeshMap: { [symbol: string]: MeshInstanced; } = { };
let sceneMeshes: Array<MeshInstanced> = [];
let sceneTextures: Array<Array<Texture>> = [];

var timer = {
  deltaTime: 0.0,
  startTime: 0.0,
  currentTime: 0.0,
  updateTime: function() {
    var t = Date.now();
    t = (t - timer.startTime) * 0.001;
    timer.deltaTime = t - timer.currentTime;
    timer.currentTime = t;
  },
}


function loadOBJText() {
  obj0 = readTextFile('../resources/obj/wahoo.obj');

  for(var key in meshes) {
    sceneOBJs[key] = readTextFile(meshes[key]);
  }
}

function testUV(camera: Camera) {
  let light = lights[0];
  let p1 = vec4.fromValues(0, 0, 0, 1.0);
  let p2 = vec4.fromValues(light.direction[0], light.direction[1], light.direction[2], 1.0);

  let viewProj = mat4.create();
  mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);

  vec4.transformMat4(p1, p1, viewProj);
  vec4.transformMat4(p2, p2, viewProj);

  vec4.scale(p1, p1, 1.0 / p1[3]);
  vec4.scale(p2, p2, 1.0 / p2[3]);

  p1[0] = (p1[0] + 1.0) * 0.5;
  p2[0] = (p2[0] + 1.0) * 0.5;

  p1[1] = (1.0 - p1[1]) * 0.5;
  p2[1] = (1.0 - p2[1]) * 0.5;

  let dir = vec2.fromValues(p2[0] - p1[0], p2[1] - p1[1]);
  // vec2.normalize(dir, dir);

  console.log('Light Direction in UV Space is: ', dir[0], dir[1]);
}

function loadScene() {
  let transforms = doWFC();

  for(var key in sceneOBJs) {
    let mesh = new MeshInstanced('InstanceMesh_' + key, sceneOBJs[key]);
    sceneMeshes.push(mesh);
    sceneMeshMap[key] = mesh;
  }

  let groundMesh = sceneMeshMap['ground'];

  // for (var x = 0; x < 10; ++x) {
  //   for (var y = 0; y < 10; ++y) {
  //     groundMesh.addInstance(vec4.fromValues(x * 3, y * 3, 0, 1), axisAngleToQuaternion(vec3.fromValues(1,0,0), 0), vec3.fromValues(1,1,1));
  //   }
  // }

  for (var itr = 0; itr < transforms.length; ++itr) {
    let voxel = transforms[itr];

    let mesh = sceneMeshMap[voxel.mesh];

    if (mesh) {
      mesh.addInstance(voxel.position, vec4.fromValues(voxel.rotation[0], voxel.rotation[1], voxel.rotation[2], voxel.rotation[3]), voxel.scale);
    }
  }

  for (var itr = 0; itr < sceneMeshes.length; ++itr) {
    sceneMeshes[itr].create();
  }

  for (var itr = 0; itr < textures.length; ++itr) {
    let tex1 = new Texture(textures[itr][0]);
    let tex2 = new Texture(textures[itr][1]);
    sceneTextures.push([tex1, tex2]);
  }

  tex0 = new Texture('./resources/textures/wahoo.bmp')
}

function saveImage() {
  shouldCapture = true;
}

function downloadImage() {
  // Dump the canvas contents to a file.
  var canvas = <HTMLCanvasElement>document.getElementById("canvas");
  canvas.toBlob(function(blob) {
    var link = document.createElement("a");
    link.download = "image.png";

    link.href = URL.createObjectURL(blob);
    console.log(blob);

    link.click();

  }, 'image/png');
}

function setShadowMapData(shader: any, shader2: any) {
  let lightDir = controls.skyLight.direction;
  let lightDirection =  vec3.fromValues(lightDir[0], lightDir[1], lightDir[2]);

  let lightSpaceOrthoProj = mat4.create();
  mat4.ortho(lightSpaceOrthoProj, -20.0, 20.0, -20.0, 20.0, 0.1, 100.0);

  let lightSpaceView = mat4.create();
  mat4.lookAt(lightSpaceView, lightDirection, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
  let lightSpaceModel = mat4.create();
  let lightSpaceViewProj = mat4.create();

  mat4.multiply(lightSpaceViewProj, lightSpaceOrthoProj, lightSpaceView);

  // Convert Model Space -> Light Space Matrix (outputs NDC) to output texCoords between 0 & 1
  let lightSpaceToViewport = mat4.create();
  mat4.multiply(lightSpaceToViewport, SM_VIEWPORT_TRANSFORM, lightSpaceViewProj);

  shader.setShadowMapMatrices(lightSpaceViewProj, lightSpaceToViewport);
  shader2.setShadowMapMatrices(lightSpaceViewProj, lightSpaceToViewport);

  // let t = vec4.fromValues(25,25,20,1);
  // vec4.transformMat4(t, t, lightSpaceViewProj);
  // console.log(t);
}


function main() {
  // Initial display for framerate
  const stats = Stats();
  stats.setMode(0);
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.top = '0px';
  document.body.appendChild(stats.domElement);

  // Add controls to the gui
  const gui = new DAT.GUI();
  gui.add(controls, 'saveImage').name('Save Image');
  gui.add(controls, 'doWFC').name('Do WFC');
  gui.add(controls, 'toggleLightColor').name('Toggle Sky Color');

  var group;

  group = gui.addFolder('Depth of Field');
  group.add(controls.dof, 'enabled').name('Enabled').listen();
  group.add(controls.dof, 'blend', 0, 1.0).step(0.05).name('Blend Amount').listen();
  group.add(controls.dof, 'focalLength', 0, 30.0).step(0.05).name('Focal Length').listen();
  group.add(controls.dof, 'inFocusPlaneSize', 0, 30.0).step(0.05).name('Focal Plane Size').listen();

  group = gui.addFolder('Tonemap');
  group.add(controls.tonemap, 'enabled').name('Enabled').listen();

  group = gui.addFolder('Sky Light');
  group.addColor(controls.skyLight, 'color').name('Color').listen();
  group.add(controls.skyLight, 'intensity', 0, 10.0).step(0.05).name('Intensity').listen();

  group = group.addFolder('Light Position');
  group.add(controls.skyLight.direction, '0', -20, 20).step(0.5).name('X').listen();
  group.add(controls.skyLight.direction, '1', -20, 20).step(0.5).name('Y').listen();
  group.add(controls.skyLight.direction, '2', -20, 20).step(0.5).name('Z').listen();

  group = gui.addFolder('Bloom');
  group.add(controls.bloom, 'blend', 0, 1.0).step(0.05).name('Blend Amount').listen();
  group.add(controls.bloom, 'iterations', 1.0, 10.0).step(1.0).name('Iterations').listen();
  group.add(controls.bloom, 'enabled').name('Enabled').listen();

  group = gui.addFolder('God Rays');
  group.add(controls.godray, 'blend', 0, 1.0).step(0.05).name('GR Blend Amount').listen();
  group.add(controls.godray, 'iterations', 1.0, 10.0).step(1.0).name('Iterations').listen();
  group.add(controls.godray, 'enabled').name('Enabled').listen();
  group.add(controls.godray, 'density', 0.0, 4.0).step(0.05).name('Density').listen();
  group.add(controls.godray, 'weight', 0.0, 10.0).step(0.25).name('Weight').listen();
  group.add(controls.godray, 'decay', 0.0, 1.0).step(0.05).name('Decay').listen();
  group.add(controls.godray, 'exposure', 0.0, 10.0).step(0.25).name('Exposure').listen();
  
  group = gui.addFolder('Artistic');
  group.add(controls.artistic, 'effect', { 'None': 'none', 'Pencil Sketch': 'sketch' } ).name('Effect');

  // get canvas and webgl context
  const canvas = <HTMLCanvasElement> document.getElementById('canvas');
  const gl = <WebGL2RenderingContext> canvas.getContext('webgl2');
  if (!gl) {
    alert('WebGL 2 not supported!');
  }
  // `setGL` is a function imported above which sets the value of `gl` in the `globals.ts` module.
  // Later, we can import `gl` from `globals.ts` to access it
  setGL(gl);

  // Initial call to load scene
  loadScene();

  const camera = new Camera(vec3.fromValues(0, 0, 25), vec3.fromValues(0, 0, 0));

  const renderer = new OpenGLRenderer(canvas);
  renderer.setClearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);

  const standardDeferred = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/standard-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/standard-frag.glsl')),
    ]);

  const standardShadowMap = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/sm-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/sm-frag.glsl')),
    ]);

  standardDeferred.setupTexUnits(["tex_Color", "emi_Color"]);
  standardShadowMap.setupTexUnits(["tex_Color", "emi_Color"]);

  renderer.deferredShader.setSpotLights(lights);
  renderer.post32Passes[6].setSpotLights(lights);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function tick() {
    camera.update();
    stats.begin();
    gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    timer.updateTime();
    renderer.updateTime(timer.deltaTime, timer.currentTime);

    // standardDeferred.bindTexToUnit("tex_Color", tex0, 0);

    // testUV(camera);

    let lightDirection = controls.skyLight.direction;
    let skyColor = controls.skyLight.color;
    let intensity = controls.skyLight.intensity;

    setShadowMapData(standardShadowMap, renderer.deferredShader);
    renderer.deferredShader.setLightPosition(vec3.fromValues(lightDirection[0], lightDirection[1], lightDirection[2]));
    renderer.deferredShader.setLightColor(vec3.fromValues(skyColor[0] * intensity / 255, skyColor[1] * intensity / 255, skyColor[2] * intensity / 255));

    renderer.clear();
    renderer.clearGB();

    // TODO: pass any arguments you may need for shader passes
    // forward render mesh info into gbuffers
    // renderer.renderToGBuffer(camera, standardDeferred, [mesh0, mesh1, mesh2]);
    renderer.renderToGBuffer(camera, standardDeferred, sceneMeshes, sceneTextures);
    renderer.renderToShadowMap(camera, standardShadowMap, sceneMeshes, sceneTextures);
    // render from gbuffers into 32-bit color buffer
    renderer.renderFromGBuffer(camera);
    // apply 32-bit post and tonemap from 32-bit color to 8-bit color
    // renderer.renderPostProcessHDR();
    // // apply 8-bit post and draw
    // renderer.renderPostProcessLDR();

    renderer.renderPass_Bloom(controls.bloom);
    renderer.renderPass_GodRay(camera, controls.godray);

    renderer.renderPass_Composite(controls);

    renderer.renderPass_DOF(camera, controls.dof);

    renderer.renderPass_ToneMapping(controls.tonemap);
    
    if (controls.artistic.effect == 'none') {
      renderer.renderPass_Present(camera);
    } else if (controls.artistic.effect == 'sketch') {
      renderer.renderPass_PresentSketch(camera);
    }

    stats.end();

    if (shouldCapture) {
      downloadImage();
      shouldCapture = false;
    }

    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
  }, false);

  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.setAspectRatio(window.innerWidth / window.innerHeight);
  camera.updateProjectionMatrix();

  // Start the render loop
  tick();
}


function setup() {
  timer.startTime = Date.now();
  loadOBJText();
  main();
}

setup();
