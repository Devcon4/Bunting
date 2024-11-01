struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) uv: vec2f
};

struct UBO {
  view: mat4x4f,
  projection: mat4x4f,
  model: mat4x4f
};

@group(1) @binding(0) var<uniform> ubo: UBO;

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  output.position = ubo.projection * ubo.view * ubo.model * vec4f(input.position, 1.0);
  output.normal = (ubo.projection * ubo.view * vec4f(input.normal, 1.0)).xyz;
  output.uv = input.uv;

  return output;
}