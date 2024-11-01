struct FragmentInput {
  @location(0) uv: vec2f
};

struct FragmentOutput {
  @location(0) color: vec4f
};

struct LightUBO {
  view: mat4x4f,
  projection: mat4x4f,
  cameraPosition: vec4f
};

struct Light {
  color: vec4f,
  position: vec4f,
  rotation: vec4f,
  options: vec4f,
}

@group(0) @binding(0) var albedoTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var emissiveTexture: texture_2d<f32>;
@group(0) @binding(3) var metalicRoughnessAOTexture: texture_2d<f32>;
@group(0) @binding(4) var depthTexture: texture_depth_2d;
@group(0) @binding(5) var mainSampler: sampler;

@group(1) @binding(0) var<uniform> ubo: LightUBO;

@group(2) @binding(0) var<uniform> light: Light;

@fragment
fn main(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  
  var albedo = textureSample(albedoTexture, mainSampler, input.uv);

  output.color = albedo * vec4f(1.0, 0.0, 0.0, .5);

  return output;
}
