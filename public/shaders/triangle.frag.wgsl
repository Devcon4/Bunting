@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = vec3<f32>(
    uv.x,
    uv.y,
    1.0 - uv.x - uv.y
  );

  return vec4<f32>(color, 1.0);
}
