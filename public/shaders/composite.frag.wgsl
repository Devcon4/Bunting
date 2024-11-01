
struct FragmentInput {
  @location(0) uv: vec2<f32>
};

struct FragmentOutput {
  @location(0) color: vec4<f32>
};

@group(0) @binding(0) var albedoTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var emissiveTexture: texture_2d<f32>;
@group(0) @binding(3) var metalicRoughnessAOTexture: texture_2d<f32>;
@group(0) @binding(4) var depthTexture: texture_depth_2d;
@group(0) @binding(5) var mainSampler: sampler;

@fragment
fn main(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  var albedo = textureSample(albedoTexture, mainSampler, input.uv);
  var normal = textureSample(normalTexture, mainSampler, input.uv);
  var emissive = textureSample(emissiveTexture, mainSampler, input.uv);
  var metalicRoughnessAO = textureSample(metalicRoughnessAOTexture, mainSampler, input.uv);
  var depth = textureSample(depthTexture, mainSampler, input.uv);

  output.color = albedo;

  // output.color = vec4<f32>(depth/2, depth/2, depth/2, 1.0);

  // output.color = vec4<f32>(depth/2, depth/2, depth/2, 1.0);
  // output.color = vec4<f32>(input.uv, 1, 1.0);
  // output.color = vec4<f32>(1.0, 0.0, 0.0, 1.0);
  return output;
}