struct CanvasSize {
    width: f32,
    height: f32,
};

struct VertexOut {
    @builtin(position) pos: vec4f,
    @location(0) color: vec4f,
    @location(1) val: f32,
};

@group(0)
@binding(0)
var<uniform> canvasSize: CanvasSize;

@vertex
fn lineVert(@builtin(vertex_index) index: u32, @location(0) startEnd: vec4f, @location(1) color: vec4f) -> VertexOut {
    var pos = array<vec2<f32>, 6>(
      vec2<f32>( 1.0,  1.0),
      vec2<f32>( 1.0, -1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>( 1.0,  1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>(-1.0,  1.0));
    
    let vPosition = pos[index];

    // read the start position of the edge
    let start = startEnd.xy;

    // read the start position of the edge
    let end = startEnd.zw;

    // compute the angle between start and end
    let delta = end - start;
    let angle = atan2(delta.y, delta.x);

    // create the rotation matrix
    let rotation = mat2x2f(cos(angle), sin(angle),
                        -sin(angle), cos(angle));

    // create the scale matrix so that the length of the line
    // matches the distance between start and end point and its width
    // is equal to lineWidth
    let scale = mat2x2f(length(delta) / 2.0, 0.0,
                     0.0, 1.5);

    // transform the rect (perform as many operations as possible with 2d matrix)
    let transformedPosition2D = (start + end) / 2.0 + rotation * scale * vPosition;

    var t = transformedPosition2D / vec2f(canvasSize.width, canvasSize.height);
    t = vec2f(t.x, 1.0 - t.y);
    t = t * 2.0 - vec2f(1.0);

    var out: VertexOut;
    out.pos = vec4f(t, 0.0, 1.0);
    out.color = color;
    out.val = vPosition.y;
    return out;
}

@fragment
fn lineFrag(data: VertexOut) -> @location(0) vec4<f32> {
    let color = data.color.rgb;
    let alpha = min(smoothstep(-1.0, -0.1, data.val),
         1.0 - smoothstep(0.1, 1.0, data.val));
    return vec4f(color, alpha);
}