
struct FragmentInput {
  @location(0) uv: vec2<f32>
};

struct FragmentOutput {
  @location(0) color: vec4<f32>
};

@group(0) @binding(0) var lightingTex: texture_2d<f32>;
@group(0) @binding(1) var mainSampler: sampler;

@fragment
fn main(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  var lighting = textureSample(lightingTex, mainSampler, input.uv);

  output.color = lighting;
  return output;
}