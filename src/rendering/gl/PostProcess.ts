import Texture from './Texture';
import {gl} from '../../globals';
import ShaderProgram, {Shader} from './ShaderProgram';
import Drawable from './Drawable';
import PointLight from '../../lights/PointLight';
import SpotLight from '../../lights/SpotLight';
import Square from '../../geometry/Square';
import {vec2, vec3, vec4, mat4} from 'gl-matrix';

const MAX_POINT_LIGHTS = 20;
const MAX_SPOT_LIGHTS = 20;

class PostProcess extends ShaderProgram {
	static screenQuad: Square = undefined; // Quadrangle onto which we draw the frame texture of the last render pass
	unifFrame: WebGLUniformLocation; // The handle of a sampler2D in our shader which samples the texture drawn to the quad
	name: string;

	unifLightPos: WebGLUniformLocation;
	unifLightColor: WebGLUniformLocation;
	unifTonemapEnabled: WebGLUniformLocation;
	unifDimensions: WebGLUniformLocation;
	unifBloomBlur: WebGLUniformLocation;
	unifBloomBlend: WebGLUniformLocation;
	unifNumPointLights: WebGLUniformLocation;
	unifNumSpotLights: WebGLUniformLocation;
	unifGodRay: WebGLUniformLocation;

	dof_unifBlend: WebGLUniformLocation;
	dof_params: WebGLUniformLocation;
	unifGodRayDS: WebGLUniformLocation;
	unifBloomDS: WebGLUniformLocation;

	gr_unifBlend: WebGLUniformLocation;
	gr_unifOptions: WebGLUniformLocation;

	gb_target0: WebGLUniformLocation;
	gb_target1: WebGLUniformLocation;
	gb_target2: WebGLUniformLocation;
	gb_target3: WebGLUniformLocation;

	unifPointLights: Array<any>;
	unifSpotLights: Array<any>;

	constructor(fragProg: Shader, tag: string = "default") {
		super([new Shader(gl.VERTEX_SHADER, require('../../shaders/screenspace-vert.glsl')),
			fragProg]);

		this.unifLightPos = gl.getUniformLocation(this.prog, "u_LightPos");
		this.unifLightColor = gl.getUniformLocation(this.prog, "u_LightColor");
		this.unifDimensions = gl.getUniformLocation(this.prog, "u_Dimensions");
		this.unifTonemapEnabled = gl.getUniformLocation(this.prog, "u_UseTonemap");
		this.unifBloomBlur = gl.getUniformLocation(this.prog, "u_BloomBlur");
		this.unifGodRay = gl.getUniformLocation(this.prog, "u_GodRay");
		this.unifBloomBlend = gl.getUniformLocation(this.prog, "u_BloomBlend");
		this.unifFrame = gl.getUniformLocation(this.prog, "u_frame");
		this.gb_target0 = gl.getUniformLocation(this.prog, "u_gb0");
		this.gb_target1 = gl.getUniformLocation(this.prog, "u_gb1");
		this.gb_target2 = gl.getUniformLocation(this.prog, "u_gb2");
		this.gb_target3 = gl.getUniformLocation(this.prog, "u_gb3");

		this.dof_unifBlend = gl.getUniformLocation(this.prog, "u_DOF_Blend");
		this.dof_params = gl.getUniformLocation(this.prog, "u_DOF_Options");
		this.unifGodRayDS = gl.getUniformLocation(this.prog, "u_GodRay_DS");
		this.unifBloomDS = gl.getUniformLocation(this.prog, "u_Bloom_DS");

		this.gr_unifBlend = gl.getUniformLocation(this.prog, "u_GodRay_Blend");
		this.gr_unifOptions = gl.getUniformLocation(this.prog, "u_GodRay_Options");

		this.use();
		this.name = tag;

		this.unifNumPointLights = gl.getUniformLocation(this.prog, "u_NumPointLights");
		this.unifNumSpotLights = gl.getUniformLocation(this.prog, "u_NumSpotLights");
    this.unifPointLights = new Array<any>();
    this.unifSpotLights = new Array<any>();
    PointLight.markLocations(this.prog, this.unifPointLights, MAX_POINT_LIGHTS, "u_PointLights");
    SpotLight.markLocations(this.prog, this.unifSpotLights, MAX_SPOT_LIGHTS, "u_SpotLights");

		// bind texture unit 0 to this location
		gl.uniform1i(this.unifFrame, 0); // gl.TEXTURE0
		if (PostProcess.screenQuad === undefined) {
			PostProcess.screenQuad = new Square(vec3.fromValues(0, 0, 0));
			PostProcess.screenQuad.create();
		}
	}

	setGodRayDownsample(num: number) {
		this.use();
    if (this.unifGodRayDS !== -1) {
      gl.uniform1f(this.unifGodRayDS, num);
    }
	}

	setGodRaySampleOptions(params: any) {
		this.use();

		let grOpts = vec4.fromValues(params.density, params.weight, params.decay, params.exposure);

		if (this.gr_unifOptions !== -1) {
      gl.uniform4fv(this.gr_unifOptions, grOpts);
    }
	}

	setBloomDownsample(num: number) {
		this.use();
    if (this.unifBloomDS !== -1) {
      gl.uniform1f(this.unifBloomDS, num);
    }
	}

	setGodRayBlend(num: number) {
		this.use();
    if (this.gr_unifBlend !== -1) {
      gl.uniform1f(this.gr_unifBlend, num);
    }
	}

	setDOFBlend(num: number) {
		this.use();
    if (this.dof_unifBlend !== -1) {
      gl.uniform1f(this.dof_unifBlend, num);
    }
	}

	setPointLights(lights: Array<PointLight>) {
    this.use();

    if (this.unifNumPointLights !== -1) {
      gl.uniform1ui(this.unifNumPointLights, lights.length);

      for (var itr = 0; itr < lights.length; ++itr) {
        let light = lights[itr];
        light.setPointLightData(this.unifPointLights[itr]);
      }
    }
  }

  setSpotLights(lights: Array<SpotLight>) {
    this.use();

    if (this.unifNumSpotLights !== -1) {
      gl.uniform1ui(this.unifNumSpotLights, lights.length);

      for (var itr = 0; itr < lights.length; ++itr) {
        let light = lights[itr];
        light.setSpotLightData(this.unifSpotLights[itr]);
      }
    }
  }

	setLightPosition(light: vec3) {
    this.use();
    if (this.unifLightPos !== -1) {
      gl.uniform3fv(this.unifLightPos, light);
    }
  }

  setLightColor(color: vec3) {
    this.use();
    if (this.unifLightColor !== -1) {
      gl.uniform3fv(this.unifLightColor, color);
    }
  }

  setToneMapping(enable: number) {
    this.use();
    if (this.unifTonemapEnabled !== -1) {
      gl.uniform1i(this.unifTonemapEnabled, enable);
    }
  }

  setGBufferTarget0(buffer: number) {
    this.use();
    if (this.gb_target0 !== -1) {
      gl.uniform1i(this.gb_target0, buffer);
    }
  }

  setGBufferTarget1(buffer: number) {
    this.use();
    if (this.gb_target1 !== -1) {
      gl.uniform1i(this.gb_target1, buffer);
    }
  }

  setBloomBlur(buffer: number) {
    this.use();
    if (this.unifBloomBlur !== -1) {
      gl.uniform1i(this.unifBloomBlur, buffer);
    }
  }

  setGodRay(buffer: number) {
    this.use();
    if (this.unifGodRay !== -1) {
      gl.uniform1i(this.unifGodRay, buffer);
    }
  }

  setBloomBlend(blendAmount: number) {
    this.use();
    if (this.unifBloomBlend !== -1) {
      gl.uniform1f(this.unifBloomBlend, blendAmount);
    }
  }

  setGBufferTarget2(buffer: number) {
    this.use();
    if (this.gb_target2 !== -1) {
      gl.uniform1i(this.gb_target2, buffer);
    }
  }

  setGBufferTarget3(buffer: number) {
    this.use();
    if (this.gb_target3 !== -1) {
      gl.uniform1i(this.gb_target3, buffer);
    }
  }

  setScreenSize(x:number, y:number) {
  	this.use();
    if (this.unifDimensions !== -1) {
      gl.uniform2i(this.unifDimensions, x, y);
    }
  }

  setPassParams_DOF(params: any) {
  	this.use();

    if (this.dof_params !== -1) {
      gl.uniform2f(this.dof_params, params.focalLength, params.inFocusPlaneSize);
    }
  }

	draw() {
		super.draw(PostProcess.screenQuad);
	}

	getName() : string { return this.name; }

}

export default PostProcess;
