
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) uv: vec2<f32>
};

struct UBO {
  view: mat4x4<f32>,
  projection: mat4x4<f32>,
  model: mat4x4<f32>
};

@group(1) @binding(0) var<uniform> ubo: UBO;

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = ubo.model * vec4<f32>(input.position, 1.0);
  output.position = ubo.projection * ubo.view * worldPosition;
  // output.normal = (ubo.model * vec4<f32>(input.normal, 0.0)).xyz;
  output.uv = input.uv;

  output.normal = vec3<f32>(ubo.projection[0][0], ubo.projection[0][0], ubo.projection[0][0]);
  output.position = vec4<f32>(input.position, 1.0);
  return output;
}
