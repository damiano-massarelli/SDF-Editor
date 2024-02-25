@group(0)
@binding(0)
var<storage> sdfBuffer: array<f32>;

@group(0)
@binding(1)
var<storage, read_write> colorBuffer: array<vec4f>;

@group(0)
@binding(2)
var<uniform> uniforms: UniformData;

struct Light {
    color: vec4f,
    position: vec2f,
};

@group(0)
@binding(3)
var<uniform> lights: array<Light, 128>;

@group(0)
@binding(4)
var<uniform> numLights: u32;

const MAX_DISTANCE = 10000.0;

fn sampleSceneSDF(p: vec2f) -> f32 {
    let pixel = vec2<u32>(u32(p.x), u32(p.y));
    if (pixel.x < 0u || pixel.y < 0u || pixel.x >= uniforms.width || pixel.y >= uniforms.height) {
        return MAX_DISTANCE;
    }

    let index = pixel.x + pixel.y * uniforms.width;
    return sdfBuffer[index];
}

// ported from https://iquilezles.org/articles/rmshadows/
fn softshadow(ro: vec2f, rd: vec2f, mint: f32, maxt: f32, k:f32) -> f32 {
    var res = 1.0;
    var t = mint;
    for (var i = 0; i < 128 && t < maxt; i = i + 1) {
        let h = sampleSceneSDF(ro + rd*t);
        if (h < 0.001) {
            return 0.0;
        }
        res = min( res, k*h/t );
        t += h * mix(0.65, 0.95, hash(ro + rd * t));
    }
    return res;
}

const Kc = 1.0;
const Kl = 	0.009;
const Kq = 	0.0004;
const ambientLight = 0.005;

fn getShadowAttenuation(pixel: vec2f, light: vec2f, color: vec4f) -> f32 {
    // return 0 if the pixel is inside a shape or very close to a shape
    let distToLight = distance(pixel, light);
    let attenuation = 1.0 / (Kc + Kl * distToLight + Kq * distToLight * distToLight);
    // let maxChannel = max(color.r, max(color.g, color.b));
    // if (maxChannel * attenuation < 0.005) {
    //     return ambientLight;
    // }

    let shadow = softshadow(pixel, normalize(light - pixel), 1, distance(pixel, light), 12.0);
    let shadowAndAttenuation = mix(ambientLight, 1.0, shadow * attenuation);

    return saturate(shadowAndAttenuation + hash(pixel) * 0.0005);
}

const exposure = 1.0;

@compute
@workgroup_size(16, 16, 1)
fn lighting(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= uniforms.width || id.y >= uniforms.height) {
        return;
    }

    let index = id.x + id.y * u32(uniforms.width);
    var pixelCoord = vec2f(f32(id.x), f32(id.y));
    var finalColor = vec3f(0.0);
    var shadow = 0.0;
    for (var i = 0u; i < numLights; i = i + 1u) {
        // for (var x = -1; x <= 1; x = x + 1) {
        //     for (var y = -1; y <= 1; y = y + 1) {
        //         shadow += getShadowAttenuation(pixelCoord + vec2f(f32(x), f32(y)) * 0.5, lights[i].position);
        //     }
        // }
        shadow = getShadowAttenuation(pixelCoord, lights[i].position, lights[i].color);

        finalColor = finalColor + lights[i].color.rgb * (shadow);
    }
    
    let pixelSDF = sampleSceneSDF(pixelCoord);
    var toneMappedAA = vec3f(1.0) - exp(-finalColor * exposure);
    toneMappedAA = mix(vec3f(0.0), toneMappedAA, saturate(pixelSDF / 1.1));

    //debug
    // let d = fract(pixelSDF / 10.0);
    // var debugColor = select(vec4f(0.5, 0.1, 0.1, 1.0), vec4f(0.1, 0.1, 0.5, 1.0), pixelSDF < 0.0);
    // if (d >= 0.8) {
    //     debugColor = select(vec4f(1, 0.1, 0.1, 1.0), vec4f(0.1, 0.1, 1.0, 1.0), pixelSDF < 0.0);
    // }
    //~~~

    colorBuffer[index] = vec4f(toneMappedAA, 1.0);
}


#include "./common.wgsl";
#include "./math.wgsl";