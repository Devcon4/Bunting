struct FragmentInput {
  @location(0) normal: vec3f,
  @location(1) uv: vec2f
};

struct FragmentOutput {
  @location(0) albedo: vec4<f32>,
  @location(1) normal: vec4<f32>,
  @location(2) emissive: vec4<f32>,
  @location(3) metalicRoughnessAO: vec4<f32>
};

@group(0) @binding(0) var albedoTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var emissiveTexture: texture_2d<f32>;
@group(0) @binding(3) var metalicRoughnessAOTexture: texture_2d<f32>;
@group(0) @binding(4) var mainSampler: sampler;

@fragment
fn main(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  output.albedo = textureSample(albedoTexture, mainSampler, input.uv);
  output.normal = vec4<f32>(normalize(input.normal), 0.0);
  output.emissive = textureSample(emissiveTexture, mainSampler, input.uv);
  output.metalicRoughnessAO = textureSample(metalicRoughnessAOTexture, mainSampler, input.uv);

  // output.color = vec4f(input.normal, 1.0);
  // output.color = vec4f(input.uv, 1.0, 1.0);
  // output.color = vec4f(1.0, 0.0, 0.0, 1.0);
  return output;
}