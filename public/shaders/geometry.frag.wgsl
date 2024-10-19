struct FragmentInput {
  @location(0) normal: vec3<f32>,
  @location(1) uv: vec2<f32>
};

struct GBufferOutput {
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
fn main(input: FragmentInput) -> GBufferOutput {
  var output: GBufferOutput;
  output.albedo = textureSample(albedoTexture, mainSampler, input.uv);
  output.normal = vec4<f32>(normalize(input.normal), 0.0);
  output.emissive = textureSample(emissiveTexture, mainSampler, input.uv);
  output.metalicRoughnessAO = textureSample(metalicRoughnessAOTexture, mainSampler, input.uv);

  output.albedo = vec4<f32>(input.uv, 0, 1.0);
  return output;
}
