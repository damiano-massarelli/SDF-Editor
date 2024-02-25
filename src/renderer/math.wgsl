//////////////////////////////
////////// COMMON ////////////
//////////////////////////////

fn saturate(v: f32) -> f32 {
    return clamp(v, 0.0, 1.0);
}

fn cross2d(v1: vec2f, v2: vec2f) -> f32 {
    return v1.x * v2.y - v2.x * v1.y;
}

fn dist2(p: vec2f, p1: vec2f) -> f32 {
    let a = (p1 - p);
    return dot(a, a);
}

fn hash(p: vec2f) -> f32 {
    var p3 = fract(vec3f(p.xyx) * 0.13);
    p3 += dot(p3, p3.yzx + vec3f(3.333));
    return fract((p3.x + p3.y) * p3.z); 
}


//////////////////////////////
//////////// SDF /////////////
//////////////////////////////

fn signedDistnce_p2l(p: vec2f, s: vec2f, e: vec2f) -> f32 {
    return cross2d(p - s, e - s) / distance(s, e); // area / base = height
}

fn projNormalized(p: vec2f, s: vec2f, e: vec2f) -> f32 {
    let dir = e - s;
    let dist2 = dot(dir, dir); // distance ^ 2
    return dot(p - s, e - s) / dist2;
}

fn distance_p2e(p: vec2f, s: vec2f, e: vec2f) -> f32 {
    let a = projNormalized(p, s, e);
    if (a > 1.0) {
        return distance(p, e);
    }
    else if (a < 0.0) {
        return distance(p, s);
    }

    return abs( signedDistnce_p2l(p, s, e) );
}

fn rect(p: vec2f, s: vec2f) -> f32 {
    let minP = -abs(s) / 2.0;
    let maxP = abs(s) / 2.0;
    let inside = p.x > minP.x && p.x < maxP.x && p.y > minP.y && p.y < maxP.y;
    let d1 = distance_p2e(p, vec2f(minP.x, minP.y), vec2f(minP.x, maxP.y)); // left
    let d2 = distance_p2e(p, vec2f(maxP.x, minP.y), vec2f(maxP.x, maxP.y)); // right
    let d3 = distance_p2e(p, vec2f(minP.x, minP.y), vec2f(maxP.x, minP.y)); // top
    let d4 = distance_p2e(p, vec2f(minP.x, maxP.y), vec2f(maxP.x, maxP.y)); // bottom
    let minV = min(d1, min(d2, min(d3, d4)));
    if (inside) {
        return -minV;
    }

    return minV;
}

fn circle(p: vec2f, r: f32) -> f32 {
    return sqrt(dot(p, p)) - r;
}

// from https://www.shadertoy.com/view/tt3yz7
fn ellipse( inp: vec2f, ine: vec2f ) -> f32
{
    var e = ine;
    var pAbs = abs(inp);
    var ei = 1.0 / e;
    var e2 = e*e;
    var ve = ei * vec2(e2.x - e2.y, e2.y - e2.x);
    
    var t = vec2f(0.70710678118654752, 0.70710678118654752);
    for (var i = 0; i < 3; i++) {
        var v = ve*t*t*t;
        var u = normalize(pAbs - v) * length(t * e - v);
        var w = ei * (v + u);
        t = normalize(clamp(w, vec2f(0.0), vec2f(1.0)));
    }
    
    var nearestAbs = t * e;
    let dist = length(pAbs - nearestAbs);
    return select(dist, -dist, dot(pAbs, pAbs) < dot(nearestAbs, nearestAbs));
}