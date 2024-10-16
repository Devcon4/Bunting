
struct VertexInput {
  @builtin(vertex_index) vertexIndex: u32
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var positions = array<vec4<f32>, 6>(
    vec4<f32>(-1.0, -1.0, 0.0, 1.0),
    vec4<f32>( 1.0, -1.0, 0.0, 1.0),
    vec4<f32>(-1.0,  1.0, 0.0, 1.0),
    vec4<f32>( 1.0, -1.0, 0.0, 1.0),
    vec4<f32>( 1.0,  1.0, 0.0, 1.0),
    vec4<f32>(-1.0,  1.0, 0.0, 1.0)
  );

  var uvs = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0)
  );

  var output: VertexOutput;
  output.position = positions[input.vertexIndex];
  output.uv = uvs[input.vertexIndex];

  return output;
}