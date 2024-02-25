@group(0)
@binding(0)
var<uniform> uniformsFS: UniformData;

@group(0)
@binding(1)
var<storage> finalColorBufferFS: array<vec4f>;

@vertex
fn fullScreenVert(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 6>(
      vec2<f32>( 1.0,  1.0),
      vec2<f32>( 1.0, -1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>( 1.0,  1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>(-1.0,  1.0));
    
    return vec4<f32>(pos[index], 0.0, 1.0);
}

@fragment
fn fullScreenFrag(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    let X = u32(coord.x);
    let Y = u32(coord.y);
    let index = u32(X + Y * uniformsFS.width);

    let color = finalColorBufferFS[index].rgb;

    return vec4f(color, 1.0);
}

#include "./common.wgsl";