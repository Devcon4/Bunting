
struct VertexInput {
  @builtin(vertex_index) vertexIndex: u32
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var positions = array<vec4f, 6>(
    vec4f(-1.0, -1.0, 0.0, 1.0),
    vec4f( 1.0, -1.0, 0.0, 1.0),
    vec4f(-1.0,  1.0, 0.0, 1.0),
    vec4f( 1.0, -1.0, 0.0, 1.0),
    vec4f( 1.0,  1.0, 0.0, 1.0),
    vec4f(-1.0,  1.0, 0.0, 1.0)
  );

  var uvs = array<vec2f, 6>(
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 1.0)
  );

  var output: VertexOutput;
  output.position = positions[input.vertexIndex];
  output.uv = uvs[input.vertexIndex];

  return output;
}