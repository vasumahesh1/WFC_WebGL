import {mat4, vec4, vec3, vec2} from 'gl-matrix';
import Drawable from './Drawable';
import Camera from '../../Camera';
import {gl} from '../../globals';
import ShaderProgram, {Shader} from './ShaderProgram';
import PostProcess from './PostProcess'
import Square from '../../geometry/Square';


class OpenGLRenderer {
  gBuffer: WebGLFramebuffer; // framebuffer for deferred rendering

  gbTargets: WebGLTexture[]; // references to different 4-channel outputs of the gbuffer
                             // Note that the constructor of OpenGLRenderer initializes
                             // gbTargets[0] to store 32-bit values, while the rest
                             // of the array stores 8-bit values. You can modify
                             // this if you want more 32-bit storage.

  depthTexture: WebGLTexture; // You don't need to interact with this, it's just
                              // so the OpenGL pipeline can do depth sorting

  // post-processing buffers pre-tonemapping (32-bit color)
  post32Buffers: WebGLFramebuffer[];
  post32Targets: WebGLTexture[];

  // post-processing buffers post-tonemapping (8-bit color)
  post8Buffers: WebGLFramebuffer[];
  post8Targets: WebGLTexture[];

  // post processing shader lists, try to limit the number for performance reasons
  post8Passes: PostProcess[];
  post32Passes: PostProcess[];

  downSampleGodRay: number = 1.0;
  downSampleBloom: number = 1.0;

  shadowMapSize: number = 4096.0;
  shadowTexture: WebGLTexture;

  currentTime: number; // timer number to apply to all drawing shaders

  // the shader that renders from the gbuffers into the postbuffers
  deferredShader :  PostProcess = new PostProcess(
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/deferred-render.glsl'))
    );

  skyShader :  PostProcess = new PostProcess(
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/sky-frag.glsl'))
    );

  // shader that maps 32-bit color to 8-bit color
  tonemapPass : PostProcess = new PostProcess(
    new Shader(gl.FRAGMENT_SHADER, require('../../shaders/tonemap-frag.glsl'))
    );


  add8BitPass(pass: PostProcess) {
    this.post8Passes.push(pass);
  }


  add32BitPass(pass: PostProcess) {
    this.post32Passes.push(pass);
  }


  constructor(public canvas: HTMLCanvasElement) {
    this.currentTime = 0.0;
    this.gbTargets = [undefined, undefined, undefined, undefined];
    this.post8Buffers = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
    this.post8Targets = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
    this.post8Passes = [];

    this.post32Buffers = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
    this.post32Targets = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
    this.post32Passes = [];

    // TODO: these are placeholder post shaders, replace them with something good
    this.add8BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/present.glsl')))); // 0
    this.add8BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post8_Sketch.glsl')))); // 1
    // this.add8BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/examplePost2-frag.glsl'))));

    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_DOF.glsl')))); // 0

    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_Bloom_Extract.glsl')))); // 1 // Extract High Luminance Pixels
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_Bloom_BlurX.glsl')))); // 2 // Extract High Luminance Pixels
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_Bloom_BlurY.glsl')))); // 3 // Extract High Luminance Pixels
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_Composite.glsl')))); // 4 // Extract High Luminance Pixels

    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_GodRay_Pre.glsl')))); // 5 // Extract High Luminance Pixels
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_GodRay_Sample.glsl')))); // 6 // Extract High Luminance Pixels
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_GodRay_BlurX.glsl')))); // 7 // Extract High Luminance Pixels
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_GodRay_BlurY.glsl')))); // 8 // Extract High Luminance Pixels

    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_DOF_NearPass.glsl')))); // 9
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_DOF_FarPass.glsl')))); // 10
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_DOF_BlurX.glsl')))); // 11
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_DOF_BlurY.glsl')))); // 12
    this.add32BitPass(new PostProcess(new Shader(gl.FRAGMENT_SHADER, require('../../shaders/post32_DOF_Composite.glsl')))); // 13

    if (!gl.getExtension("OES_texture_float_linear")) {
      console.error("OES_texture_float_linear not available");
    }

    if (!gl.getExtension("EXT_color_buffer_float")) {
      console.error("FLOAT color buffer not available");
    }

    var gb0loc = gl.getUniformLocation(this.deferredShader.prog, "u_gb0");
    var gb1loc = gl.getUniformLocation(this.deferredShader.prog, "u_gb1");
    var gb2loc = gl.getUniformLocation(this.deferredShader.prog, "u_gb2");
    var gb3loc = gl.getUniformLocation(this.deferredShader.prog, "u_gb3");
    var smloc = gl.getUniformLocation(this.deferredShader.prog, "u_sm");

    this.deferredShader.use();
    gl.uniform1i(gb0loc, 0);
    gl.uniform1i(gb1loc, 1);
    gl.uniform1i(gb2loc, 2);
    gl.uniform1i(gb3loc, 3);
    gl.uniform1i(smloc, 4);
  }


  setClearColor(r: number, g: number, b: number, a: number) {
    gl.clearColor(r, g, b, a);
  }


  setSize(width: number, height: number) {
    // console.log(width, height);
    this.canvas.width = width;
    this.canvas.height = height;

    // --- GBUFFER CREATION START ---
    // refresh the gbuffers
    this.gBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gBuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]);

    for (let i = 0; i < this.gbTargets.length; i ++) {
      this.gbTargets[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.gbTargets[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      if (i == 0 || i == 1) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.FLOAT, null);
      }
      else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }

      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, this.gbTargets[i], 0);
    }
    // depth attachment
    this.depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthTexture, 0);

    var FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
        console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use FBO[0]\n");
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // create the framebuffers for post processing
    for (let i = 0; i < this.post8Buffers.length; i++) {

      // 8 bit buffers have unsigned byte textures of type gl.RGBA8
      this.post8Buffers[i] = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[i]);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

      this.post8Targets[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.post8Targets[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.post8Targets[i], 0);

      FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
        console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use 8 bit FBO\n");
      }

      // 32 bit buffers have float textures of type gl.RGBA32F
      this.post32Buffers[i] = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[i]);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

      // God Ray Buffers
      if (i == 3 || i == 4) {
        this.post32Targets[i] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.drawingBufferWidth / this.downSampleGodRay, gl.drawingBufferHeight / this.downSampleGodRay, 0, gl.RGBA, gl.FLOAT, null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.post32Targets[i], 0);
      } else if (i == 5 || i == 1) {
        this.post32Targets[i] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.drawingBufferWidth / this.downSampleBloom, gl.drawingBufferHeight / this.downSampleBloom, 0, gl.RGBA, gl.FLOAT, null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.post32Targets[i], 0);
      } else if (i == 9) {
        this.post32Targets[i] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.shadowMapSize, this.shadowMapSize, 0, gl.RGBA, gl.FLOAT, null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.post32Targets[i], 0);

         // Shadow Texture Depth Attachment
         // This is super needed because it tells OpenGL that we need Depth Sorting with this frame buffer that we are using.
         // Shadow Mapping has it's own framebuffer like any other post32 process, but it needs depth sorting too for the geometry vertices which will be
         // sorted by the light.
         this.shadowTexture = gl.createTexture();
         gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
         gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
         gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, this.shadowMapSize, this.shadowMapSize, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
         gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTexture, 0);
      } else{
        this.post32Targets[i] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.FLOAT, null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.post32Targets[i], 0);
      }

      FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (FBOstatus != gl.FRAMEBUFFER_COMPLETE) {
        console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use 8 bit FBO\n");
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }


  updateTime(deltaTime: number, currentTime: number) {
    this.deferredShader.setTime(currentTime);
    for (let pass of this.post8Passes) pass.setTime(currentTime);
    for (let pass of this.post32Passes) pass.setTime(currentTime);
    this.currentTime = currentTime;
  }


  clear() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }


  clearGB() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gBuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  renderToGBuffer(camera: Camera, gbProg: ShaderProgram, drawables: Array<Drawable>, textures: Array<Array<any>>) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gBuffer);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.enable(gl.DEPTH_TEST);

    let model = mat4.create();
    let viewProj = mat4.create();
    let view = camera.viewMatrix;
    let proj = camera.projectionMatrix;
    let color = vec4.fromValues(0.5, 0.5, 0.5, 1);

    mat4.identity(model);
    mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);
    gbProg.setViewProjMatrix(viewProj);
    gbProg.setGeometryColor(color);
    gbProg.setViewMatrix(view);
    gbProg.setProjMatrix(proj);

    gbProg.setTime(this.currentTime);

    for (let idx in drawables) {

      gbProg.setModelMatrix(drawables[idx].modelMatrix);

      gbProg.bindTexToUnit("tex_Color", textures[idx][0], 0);
      gbProg.bindTexToUnit("emi_Color", textures[idx][1], 1);

      gbProg.draw(drawables[idx]);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  }

  renderToShadowMap(camera: Camera, gbProg: ShaderProgram, drawables: Array<Drawable>, textures: Array<Array<any>>) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[9]);
    gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    let model = mat4.create();
    let viewProj = mat4.create();
    let view = camera.viewMatrix;
    let proj = camera.projectionMatrix;

    mat4.identity(model);
    mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);
    gbProg.setViewProjMatrix(viewProj);
    gbProg.setViewMatrix(view);
    gbProg.setProjMatrix(proj);

    for (let idx in drawables) {
      gbProg.setModelMatrix(drawables[idx].modelMatrix);

      gbProg.draw(drawables[idx]);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  }

  renderFromGBuffer(camera: Camera) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[0]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let view = camera.viewMatrix;
    let proj = camera.projectionMatrix;
    this.deferredShader.setViewMatrix(view);
    this.deferredShader.setProjMatrix(proj);

    this.deferredShader.setScreenSize(this.canvas.width, this.canvas.height);

    for (let i = 0; i < this.gbTargets.length; i ++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.gbTargets[i]);
    }

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[9]);

    this.deferredShader.draw();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  // // TODO: pass any info you need as args
  // renderPostProcessHDR() {
  //   // TODO: replace this with your post 32-bit pipeline
  //   // the loop shows how to swap between frame buffers and textures given a list of processes,
  //   // but specific shaders (e.g. bloom) need specific info as textures
  //   let i = 0;
  //   for (i = 0; i < this.post32Passes.length; i++){
  //     // Pingpong framebuffers for each pass.
  //     // In other words, repeatedly flip between storing the output of the
  //     // current post-process pass in post32Buffers[1] and post32Buffers[0].
  //     gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[(i + 1) % 2]);

  //     gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  //     gl.disable(gl.DEPTH_TEST);
  //     gl.enable(gl.BLEND);
  //     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //     // Recall that each frame buffer is associated with a texture that stores
  //     // the output of a render pass. post32Targets is the array that stores
  //     // these textures, so we alternate reading from the 0th and 1th textures
  //     // each frame (the texture we wrote to in our previous render pass).
  //     gl.activeTexture(gl.TEXTURE0);
  //     gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[(i) % 2]);

  //     this.post32Passes[i].draw();

  //     // bind default frame buffer
  //     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  //   }

  //   // apply tonemapping
  //   // TODO: if you significantly change your framework, ensure this doesn't cause bugs!
  //   // render to the first 8 bit buffer if there is more post, else default buffer
  //   if (this.post8Passes.length > 0) {
  //     gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[0]);
  //   }
  //   else {
  //     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  //   }

  //   gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

  //   gl.disable(gl.DEPTH_TEST);
  //   gl.enable(gl.BLEND);
  //   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //   gl.activeTexture(gl.TEXTURE0);
  //   // bound texture is the last one processed before

  //   gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[Math.max(0, i) % 2]);

  //   this.tonemapPass.draw();

  // }


  // // TODO: pass any info you need as args
  // renderPostProcessLDR() {
  //   // TODO: replace this with your post 8-bit pipeline
  //   // the loop shows how to swap between frame buffers and textures given a list of processes,
  //   // but specific shaders (e.g. motion blur) need specific info as textures
  //   for (let i = 0; i < this.post8Passes.length; i++){
  //     // pingpong framebuffers for each pass
  //     // if this is the last pass, default is bound
  //     if (i < this.post8Passes.length - 1) gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[(i + 1) % 2]);
  //     else gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  //     gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  //     gl.disable(gl.DEPTH_TEST);
  //     gl.enable(gl.BLEND);
  //     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //     gl.activeTexture(gl.TEXTURE0);
  //     gl.bindTexture(gl.TEXTURE_2D, this.post8Targets[(i) % 2]);

  //     this.post8Passes[i].draw();

  //     // bind default
  //     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  //   }
  // }

  renderPass_Bloom_Extract(params: any) {
    let activePass = this.post32Passes[1];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[1]);
    gl.viewport(0, 0, gl.drawingBufferWidth / this.downSampleBloom, gl.drawingBufferHeight / this.downSampleBloom);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[0]);

    activePass.setBloomDownsample(this.downSampleBloom);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_Bloom_BlurX(params: any) {
    let activePass = this.post32Passes[2];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[5]);
    gl.viewport(0, 0, gl.drawingBufferWidth / this.downSampleBloom, gl.drawingBufferHeight / this.downSampleBloom);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[1]);

    activePass.setBloomDownsample(this.downSampleBloom);
    activePass.setScreenSize(this.canvas.width / this.downSampleBloom, this.canvas.height / this.downSampleBloom);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_Bloom_BlurY(params: any) {
    let activePass = this.post32Passes[3];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[1]);
    gl.viewport(0, 0, gl.drawingBufferWidth / this.downSampleBloom, gl.drawingBufferHeight / this.downSampleBloom);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[5]);

    activePass.setBloomDownsample(this.downSampleBloom);
    activePass.setScreenSize(this.canvas.width / this.downSampleBloom, this.canvas.height / this.downSampleBloom);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_Composite(params: any) {
    let activePass = this.post32Passes[4];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[2]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[0]);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[1]);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[4]);

    activePass.setGodRayDownsample(this.downSampleGodRay);
    activePass.setBloomDownsample(this.downSampleBloom);

    activePass.setBloomBlur(1);
    activePass.setGodRay(2);
    activePass.setBloomBlend(params.bloom.blend);
    activePass.setGodRayBlend(params.godray.blend);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  clearBloomBuffer() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[1]);
    gl.viewport(0, 0, gl.drawingBufferWidth / this.downSampleBloom, gl.drawingBufferHeight / this.downSampleBloom);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_Bloom(params: any) {
    if (!params.enabled) {
      this.clearBloomBuffer();
      return;
    }

    this.renderPass_Bloom_Extract(params);
    this.renderPass_Bloom_BlurX(params);
    this.renderPass_Bloom_BlurY(params);

    let count = params.iterations - 1;

    for (var itr = 0; itr < count; ++itr) {
      this.renderPass_Bloom_BlurX(params);
      this.renderPass_Bloom_BlurY(params);
    }
  }

  renderPass_DOF_NearPass(camera: Camera, params: any) {
    let activePass = this.post32Passes[9];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[6]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[2]);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.gbTargets[0]);

    activePass.setPassParams_DOF(params);
    activePass.setGBufferTarget0(1);
    activePass.setScreenSize(this.canvas.width, this.canvas.height);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_DOF_FarPass(camera: Camera, params: any) {
    let activePass = this.post32Passes[10];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[8]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[2]);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.gbTargets[0]);

    activePass.setPassParams_DOF(params);
    activePass.setGBufferTarget0(1);
    activePass.setScreenSize(this.canvas.width, this.canvas.height);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_DOF_BlurX(camera: Camera, params: any, num: number, target: number) {
    let activePass = this.post32Passes[11];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[target]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[num]);

    activePass.setPassParams_DOF(params);
    activePass.setScreenSize(this.canvas.width, this.canvas.height);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_DOF_BlurY(camera: Camera, params: any, num: number, target: number) {
    let activePass = this.post32Passes[12];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[target]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[num]);

    activePass.setPassParams_DOF(params);
    activePass.setScreenSize(this.canvas.width, this.canvas.height);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_DOF_Composite(camera: Camera, params: any) {
    let activePass = this.post32Passes[13];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[7]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[2]);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[6]);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[8]);

    activePass.setPassParams_DOF(params);
    activePass.setGBufferTarget0(1);
    activePass.setGBufferTarget1(2);
    activePass.setScreenSize(this.canvas.width, this.canvas.height);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_DOF(camera: Camera, params: any) {
    if (!params.enabled) {
      this.renderPass_Copy(2, 7);
      return;
    }

    this.renderPass_DOF_NearPass(camera, params);
    this.renderPass_DOF_BlurX(camera, params, 6, 7);
    this.renderPass_DOF_BlurY(camera, params, 7, 6);

    this.renderPass_DOF_FarPass(camera, params);
    this.renderPass_DOF_BlurX(camera, params, 8, 7);
    this.renderPass_DOF_BlurY(camera, params, 7, 8);

    this.renderPass_DOF_Composite(camera, params);
  }

  renderPass_ToneMapping(config: any)
  {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post8Buffers[0]);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    // bound texture is the last one processed before
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[7]); // TODO: 7

    let val = config.enabled ? 1 : 0;
    this.tonemapPass.setToneMapping(val);
    this.tonemapPass.draw();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  renderPass_GodRay_Pre(camera: any, params: any) {
    let activePass = this.post32Passes[5];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[3]);
    gl.viewport(0, 0, gl.drawingBufferWidth / this.downSampleGodRay, gl.drawingBufferHeight / this.downSampleGodRay);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.gbTargets[3]);
    activePass.setGBufferTarget3(1);
    activePass.setGodRayDownsample(this.downSampleGodRay);

    activePass.setScreenSize(this.canvas.width, this.canvas.height);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_GodRay_Sample(camera: any, params: any) {
    let activePass = this.post32Passes[6];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[4]);
    gl.viewport(0, 0, gl.drawingBufferWidth / this.downSampleGodRay, gl.drawingBufferHeight / this.downSampleGodRay);

    gl.clear(gl.COLOR_BUFFER_BIT);

    let view = camera.viewMatrix;
    let proj = camera.projectionMatrix;
    activePass.setViewMatrix(view);
    activePass.setProjMatrix(proj);
    activePass.setGodRayDownsample(this.downSampleGodRay);
    activePass.setGodRaySampleOptions(params);

    // bind: u_frame
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[3]);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.gbTargets[0]);
    activePass.setGBufferTarget0(1);

    activePass.setScreenSize(this.canvas.width / this.downSampleGodRay, this.canvas.height / this.downSampleGodRay);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_GodRay_BlurX(params: any) {
    let activePass = this.post32Passes[7];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[3]);
    gl.viewport(0, 0, gl.drawingBufferWidth / this.downSampleGodRay, gl.drawingBufferHeight / this.downSampleGodRay);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[4]);
    activePass.setGodRayDownsample(this.downSampleGodRay);

    activePass.setScreenSize(this.canvas.width / this.downSampleGodRay, this.canvas.height / this.downSampleGodRay);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_GodRay_BlurY(params: any) {
    let activePass = this.post32Passes[8];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[4]);
    gl.viewport(0, 0, gl.drawingBufferWidth / this.downSampleGodRay, gl.drawingBufferHeight / this.downSampleGodRay);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[3]);

    activePass.setGodRayDownsample(this.downSampleGodRay);

    activePass.setScreenSize(this.canvas.width / this.downSampleGodRay, this.canvas.height / this.downSampleGodRay);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  clearGodRayBuffer() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[4]);
    gl.viewport(0, 0, gl.drawingBufferWidth / this.downSampleGodRay, gl.drawingBufferHeight / this.downSampleGodRay);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_GodRay(camera: any, params: any) {
    if (!params.enabled) {
      this.clearGodRayBuffer();
      return;
    }

    this.renderPass_GodRay_Pre(camera, params);
    this.renderPass_GodRay_Sample(camera, params);
    this.renderPass_GodRay_BlurX(params);
    this.renderPass_GodRay_BlurY(params);

    let count = params.iterations - 1;

    for (var itr = 0; itr < count; ++itr) {
      this.renderPass_GodRay_BlurX(params);
      this.renderPass_GodRay_BlurY(params);
    }
  }

  renderPass_Copy(idx1:number, idx2:number) {
    let activePass = this.post8Passes[0]; // Default Present

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post32Buffers[idx2]);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT  | gl.DEPTH_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post32Targets[idx1]);

    activePass.setScreenSize(this.canvas.width, this.canvas.height);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_Present(camera: Camera) {
    let activePass = this.post8Passes[0];

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT  | gl.DEPTH_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post8Targets[0]);

    activePass.setScreenSize(this.canvas.width, this.canvas.height);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  renderPass_PresentSketch(camera: Camera) {
    let activePass = this.post8Passes[1];

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT  | gl.DEPTH_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.post8Targets[0]);

    activePass.setScreenSize(this.canvas.width, this.canvas.height);
    activePass.draw();

    // bind default frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  render(camera: Camera, prog: ShaderProgram, drawables: Array<Drawable>) {
    let model = mat4.create();
    let viewProj = mat4.create();
    let color = vec4.fromValues(1, 0, 0, 1);
    // Each column of the axes matrix is an axis. Right, Up, Forward.
    // let axes = mat3.fromValues(camera.right[0], camera.right[1], camera.right[2],
    //                            camera.up[0], camera.up[1], camera.up[2],
    //                            camera.forward[0], camera.forward[1], camera.forward[2]);

    mat4.identity(model);
    mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);
    prog.setModelMatrix(model);
    prog.setViewProjMatrix(viewProj);
    //prog.setCameraAxes(axes);
    for (let drawable of drawables) {
      prog.draw(drawable);
    }
  }

};

export default OpenGLRenderer;
