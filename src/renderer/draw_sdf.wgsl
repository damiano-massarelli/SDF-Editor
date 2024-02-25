struct Rect {
    invTransform: mat3x3f,
    size: vec2f,
}

struct Circle {
    invTransform: mat3x3f,
    radius: f32,
}

@group(0)
@binding(0)
var<storage, read_write> sdfBuffer: array<f32>;

@group(0)
@binding(1)
var<uniform> uniforms: UniformData;

@group(0)
@binding(2)
var<uniform> rects: array<Rect, 128>;

@group(0)
@binding(3)
var<uniform> numRects: u32;

@group(0)
@binding(4)
var<uniform> circles: array<Circle, 128>;

@group(0)
@binding(5)
var<uniform> numCircles: u32;

fn getMinScale(inv: mat3x3f) -> f32 {
    let sx = length(inv[0].xy);
    let sy = length(inv[1].xy);
    return 1.0 / min(sx, sy);
}

fn removeScale(inv: mat3x3f, outInvScale: ptr<function, vec2f>) -> mat3x3f {
    let invScale = vec2f(length(vec2f(inv[0][0], inv[1][0])), length(vec2f(inv[0][1], inv[1][1])));
    *outInvScale = invScale;
    var res = inv;
    res[0][0] = inv[0][0] / invScale.x;
    res[1][0] = inv[1][0] / invScale.x;
    res[2][0] = inv[2][0] / invScale.x;

    res[0][1] = inv[0][1] / invScale.y;
    res[1][1] = inv[1][1] / invScale.y;
    res[2][1] = inv[2][1] / invScale.y;    

    return res;
}

@compute
@workgroup_size(8, 8, 1)
fn clear(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= uniforms.width || id.y >= uniforms.height) {
        return;
    }

    let pixelCoord = vec2f(f32(id.x), f32(id.y));

    var sdf = 10000.0;
    for (var i = 0u; i < numRects; i = i + 1u) {
#if SCALE_SHAPES 
        var invScale = vec2f();
        let inv = removeScale(rects[i].invTransform, &invScale);
        let local = inv * vec3f(pixelCoord, 1.0);
        let rectSDF = rect(local.xy, rects[i].size / invScale);
#else
        let local = rects[i].invTransform * vec3f(pixelCoord, 1.0);
        let rectSDF = rect(local.xy, rects[i].size) * getMinScale(rects[i].invTransform);
#endif
        sdf = min(sdf, rectSDF);
    }

    for (var i = 0u; i < numCircles; i = i + 1u) {
#if SCALE_SHAPES
        var invScale = vec2f();
        let inv = removeScale(circles[i].invTransform, &invScale);
        var ellipseSDF = 0.0;
        if (abs(invScale.x - invScale.y) > 0.05) {
            // ellipses are slower and less accurate, use only when scale is not uniform
            let local = inv * vec3f(pixelCoord, 1.0);
            ellipseSDF = ellipse(local.xy, vec2f(circles[i].radius) / invScale);
        }
        else {
            let local = circles[i].invTransform * vec3f(pixelCoord, 1.0);
            ellipseSDF = circle(local.xy, circles[i].radius) * getMinScale(circles[i].invTransform);
        }
#else
        let local = circles[i].invTransform * vec3f(pixelCoord, 1.0);
        let ellipseSDF = circle(local.xy, circles[i].radius) * getMinScale(circles[i].invTransform);
#endif
        sdf = min(sdf, ellipseSDF);
    }

    var index = id.x + id.y * u32(uniforms.width);

    sdfBuffer[index] = sdf;
}

#include "./math.wgsl";
#include "./common.wgsl";