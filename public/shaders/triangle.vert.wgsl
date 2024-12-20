struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn main(@location(0) position: vec2<f32>) -> VertexOutput {
  var uv = (position + vec2<f32>(1.0, 1.0)) * 0.5;
  var pos = vec4<f32>(position, 0.0, 1.0);
  return VertexOutput(pos, uv);
}
