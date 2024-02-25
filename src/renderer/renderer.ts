import drawSdfShader from "./draw_sdf.wgsl";
import presentShader from "./present.wgsl";
import lightingShader from "./lighting.wgsl";
import { ICircle, ILight, IRect, Scene, SceneManager, getInvTransform } from "../scene/scene";
import { typedStructInfo } from "./shader-utils";
import { setupUI } from "../editor/ui-setup";
import { mat3, vec2, vec4 } from "gl-matrix";
import { ImmediateDraw } from "./immediate-draw";
import { CommandManager } from "../editor/command-manager";
import { preprocess } from "../preprocessor/preprocessor";

const USE_DEVICE_PIXEL_RATIO = false;

function mat3ToBuffer(m: mat3) {
    return [m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0];
}

export interface IRenderingContext {
    device: GPUDevice;
    canvas: HTMLCanvasElement;
    context: GPUCanvasContext;
    presentationSize: readonly [number, number];
    presentationFormat: GPUTextureFormat;
}

function getPresentationSize(canvas: HTMLCanvasElement, useDevicePixelRatio: boolean) {
    const devicePixelRatio = useDevicePixelRatio ? window.devicePixelRatio ?? 1 : 1;
    const presentationSize = [canvas.clientWidth * devicePixelRatio, canvas.clientHeight * devicePixelRatio] as const;
    return presentationSize;
}

async function init(canvasId: string, useDevicePixelRatio: boolean): Promise<IRenderingContext> {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;

    const context = canvas.getContext("webgpu");

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter!.requestDevice();

    const presentationSize = getPresentationSize(canvas, USE_DEVICE_PIXEL_RATIO);

    canvas.width = presentationSize[0];
    canvas.height = presentationSize[1];

    const presentationFormat: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
    console.log(presentationFormat);
    context?.configure({
        device,
        format: presentationFormat,
        alphaMode: "opaque",
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    return {
        device,
        canvas,
        context: context!,
        presentationSize,
        presentationFormat,
    };
}

function createPresentPass(context: IRenderingContext, colorBuffer: GPUBuffer, uniforms: GPUBuffer) {
    const fullscreenBindGroupLayout = context.device.createBindGroupLayout({
        label: "full screen bind group layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT, // color buffer
                buffer: {
                    type: "read-only-storage",
                },
            },
        ],
    });

    const shaderModule = context.device.createShaderModule({
        code: presentShader,
    });

    const fullScreenPipeline = context.device.createRenderPipeline({
        label: "full screen pipeline",
        layout: context.device.createPipelineLayout({
            bindGroupLayouts: [fullscreenBindGroupLayout],
        }),

        vertex: {
            module: shaderModule,
            entryPoint: "fullScreenVert",
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fullScreenFrag",
            targets: [
                {
                    format: context.presentationFormat,
                },
            ],
        },
        primitive: {
            topology: "triangle-list",
        },
    });

    const fullscreenBindGroup = context.device.createBindGroup({
        layout: fullscreenBindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniforms,
                },
            },
            {
                binding: 1,
                resource: {
                    buffer: colorBuffer,
                },
            },
        ],
    });

    const addPresentPass = (context: IRenderingContext, commandEncoder: GPUCommandEncoder) => {
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.context.getCurrentTexture().createView(),
                    clearValue: [1, 1, 1, 1],
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });

        passEncoder.setPipeline(fullScreenPipeline);
        passEncoder.setBindGroup(0, fullscreenBindGroup);
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();
    };

    return { addPresentPass };
}

function createDrawSDFPass(context: IRenderingContext) {
    const WIDTH = context.presentationSize[0];
    const HEIGHT = context.presentationSize[1];

    ////// SDF //////

    const sdfBufferSize = Float32Array.BYTES_PER_ELEMENT * (WIDTH * HEIGHT);

    const sdfBuffer = context.device.createBuffer({
        label: "sdf buffer",
        size: sdfBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const UBOBufferSize = (1 + 1) * Uint32Array.BYTES_PER_ELEMENT; // width, height
    const UBOBuffer = context.device.createBuffer({
        label: "uniform buffer",
        size: UBOBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });

    // prettier-ignore
    new Uint32Array(UBOBuffer.getMappedRange()).set([
        WIDTH, HEIGHT
    ]);
    UBOBuffer.unmap();

    ////// RECTS //////

    const rectDataStruct = typedStructInfo({
        name: "Rect",
        fields: {
            invTransform: {
                type: "mat3x3<f32>",
            },
            size: {
                type: "vec2<f32>",
            },
        },
    });
    const maxRects = 128;
    const rectsBufferSize = rectDataStruct.structSize * maxRects * Float32Array.BYTES_PER_ELEMENT;
    const rectsBuffer = context.device.createBuffer({
        label: "rects buffer",
        size: rectsBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const numRectsBuffer = context.device.createBuffer({
        label: "num rects buffer",
        size: Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    ////// CIRCLES //////

    const circleDataStruct = typedStructInfo({
        name: "Rect",
        fields: {
            invTransform: {
                type: "mat3x3<f32>",
            },
            radius: {
                type: "f32",
            },
        },
    });
    const maxCircles = 128;
    const circlesBufferSize = circleDataStruct.structSize * maxCircles * Float32Array.BYTES_PER_ELEMENT;
    const circlesBuffer = context.device.createBuffer({
        label: "circles buffer",
        size: rectsBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const numCirclesBuffer = context.device.createBuffer({
        label: "num circles buffer",
        size: Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const sdfDrawPipeline = context.device.createComputePipeline({
        label: "sdf draw pipeline",
        compute: {
            module: context.device.createShaderModule({
                code: preprocess(drawSdfShader, {}, { SCALE_SHAPES: true }),
            }),
            entryPoint: "clear", // TODOOO change name
        },
        layout: "auto",
    });

    const bindGroup = context.device.createBindGroup({
        layout: sdfDrawPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: sdfBuffer,
                },
            },
            {
                binding: 1,
                resource: {
                    buffer: UBOBuffer,
                },
            },
            {
                binding: 2,
                resource: {
                    buffer: rectsBuffer,
                },
            },
            {
                binding: 3,
                resource: {
                    buffer: numRectsBuffer,
                },
            },
            {
                binding: 4,
                resource: {
                    buffer: circlesBuffer,
                },
            },
            {
                binding: 5,
                resource: {
                    buffer: numCirclesBuffer,
                },
            },
        ],
    });

    const addDrawSDFPass = (commandEncoder: GPUCommandEncoder, scene: Scene) => {
        {
            const rectsData = new Float32Array(rectsBufferSize / Float32Array.BYTES_PER_ELEMENT);
            let numRects = 0;

            scene.forEachByType("rect", (rect, idx) => {
                rect = rect as IRect;
                rectsData.set([...mat3ToBuffer(getInvTransform(rect)), ...rect.size], (idx * rectDataStruct.structSize) / 4);
                numRects += 1;
            });

            context.device.queue.writeBuffer(rectsBuffer, 0, rectsData);
            context.device.queue.writeBuffer(numRectsBuffer, 0, new Uint32Array([numRects]));
        }

        {
            const circlesData = new Float32Array(circlesBufferSize / Float32Array.BYTES_PER_ELEMENT);
            let numCircles = 0;
            scene.forEachByType("circle", (circle, idx) => {
                circle = circle as ICircle;
                circlesData.set([...mat3ToBuffer(getInvTransform(circle)), circle.radius], (idx * circleDataStruct.structSize) / 4);
                numCircles += 1;
            });

            context.device.queue.writeBuffer(circlesBuffer, 0, circlesData);
            context.device.queue.writeBuffer(numCirclesBuffer, 0, new Uint32Array([numCircles]));
        }

        const clearPassEncorder = commandEncoder.beginComputePass();
        clearPassEncorder.setPipeline(sdfDrawPipeline);
        clearPassEncorder.setBindGroup(0, bindGroup);
        clearPassEncorder.dispatchWorkgroups(Math.ceil(context.presentationSize[0] / 8), Math.ceil(context.presentationSize[1] / 8));
        clearPassEncorder.end();
    };

    return {
        addDrawSDFPass,
        sdfBuffer,
        UBOBuffer,
    };
}

function createLightingPass(context: IRenderingContext, sdfBuffer: GPUBuffer, uniforms: GPUBuffer) {
    const WIDTH = context.presentationSize[0];
    const HEIGHT = context.presentationSize[1];

    const outputColorBufferSize = Float32Array.BYTES_PER_ELEMENT * 4 * (WIDTH * HEIGHT);
    const colorBuffer = context.device.createBuffer({
        label: "color buffer",
        size: outputColorBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const lightDataStruct = typedStructInfo({
        name: "Light",
        fields: {
            color: {
                type: "vec4<f32>",
            },
            position: {
                type: "vec2<f32>",
            },
        },
    });
    const maxLights = 128;
    const lightsBufferSize = lightDataStruct.structSize * maxLights * Float32Array.BYTES_PER_ELEMENT;
    const lightsBuffer = context.device.createBuffer({
        label: "lights buffer",
        size: lightsBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const numLightsBuffer = context.device.createBuffer({
        label: "num lights buffer",
        size: Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = context.device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE, // sdf buffer
                buffer: {
                    type: "read-only-storage",
                },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE, // color buffer
                buffer: {
                    type: "storage",
                },
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE, // uniform
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE, // lights
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE, // num lights
                buffer: {
                    type: "uniform",
                },
            },
        ],
    });

    const bindGroup = context.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: sdfBuffer,
                },
            },
            {
                binding: 1,
                resource: {
                    buffer: colorBuffer,
                },
            },
            {
                binding: 2,
                resource: {
                    buffer: uniforms,
                },
            },
            {
                binding: 3,
                resource: {
                    buffer: lightsBuffer,
                },
            },
            {
                binding: 4,
                resource: {
                    buffer: numLightsBuffer,
                },
            },
        ],
    });

    const lightingPipeline = context.device.createComputePipeline({
        label: "lighting",
        compute: {
            module: context.device.createShaderModule({
                code: lightingShader,
            }),
            entryPoint: "lighting",
        },
        layout: context.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        }),
    });

    const addLightingPass = (commandEncoder: GPUCommandEncoder, scene: Scene) => {
        const data = new Float32Array(lightsBufferSize / Float32Array.BYTES_PER_ELEMENT);
        let numLights = 0;
        scene.forEachByType("light", (light, idx) => {
            light = light as ILight;
            const color = vec4.clone(light.color);
            const maxScale = Math.max(light.scale[0], light.scale[1]);
            vec4.mul(color, color, vec4.fromValues(maxScale, maxScale, maxScale, 1.0));
            data.set([...color, ...light.position], (idx * lightDataStruct.structSize) / 4);
            numLights += 1;
        });

        context.device.queue.writeBuffer(lightsBuffer, 0, data);
        context.device.queue.writeBuffer(numLightsBuffer, 0, new Uint32Array([numLights]));

        const lightingPassEncoder = commandEncoder.beginComputePass();
        lightingPassEncoder.setPipeline(lightingPipeline);
        lightingPassEncoder.setBindGroup(0, bindGroup);
        lightingPassEncoder.dispatchWorkgroups(Math.ceil(context.presentationSize[0] / 16), Math.ceil(context.presentationSize[1] / 16));
        lightingPassEncoder.end();
    };

    return {
        addLightingPass,
        colorBuffer,
    };
}

export async function run(): Promise<boolean> {
    if (!("gpu" in navigator)) {
        return false;
    }

    let newContext: IRenderingContext | null = null;
    try {
        newContext = await init("canvas-wegbpu", USE_DEVICE_PIXEL_RATIO);
    } catch {
        return false;
    }
    const context = newContext!;

    const scene = new Scene([]);
    SceneManager.getInstance().setScene(scene);
    setupUI(context.canvas);

    // add some intial lights
    scene.addObject({
        type: "light",
        color: vec4.fromValues(2 * Math.random() + 1, 2 * Math.random() + 1, 2 * Math.random() + 1, 1),
        position: vec2.fromValues(90, 90),
        rotation: 0,
        scale: vec2.fromValues(1, 1),
    });
    scene.addObject({
        type: "light",
        color: vec4.fromValues(5 * Math.random() + 1, 5 * Math.random() + 1, 5 * Math.random() + 1, 1),
        position: vec2.fromValues(context.presentationSize[0] - 90, 90),
        rotation: 0,
        scale: vec2.fromValues(1, 1),
    });
    scene.addObject({
        type: "light",
        color: vec4.fromValues(5 * Math.random() + 1, 5 * Math.random() + 1, 5 * Math.random() + 1, 1),
        position: vec2.fromValues(context.presentationSize[0] - 90, context.presentationSize[1] - 90),
        rotation: 0,
        scale: vec2.fromValues(1, 1),
    });
    scene.addObject({
        type: "light",
        color: vec4.fromValues(5 * Math.random() + 1, 5 * Math.random() + 1, 5 * Math.random() + 1, 1),
        position: vec2.fromValues(90, context.presentationSize[1] - 90),
        rotation: 0,
        scale: vec2.fromValues(1, 1),
    });
    // ~~~

    let { addDrawSDFPass, sdfBuffer, UBOBuffer } = createDrawSDFPass(context);
    let { addLightingPass, colorBuffer } = createLightingPass(context, sdfBuffer, UBOBuffer);
    let { addPresentPass } = createPresentPass(context, colorBuffer, UBOBuffer);

    function frame() {
        CommandManager.getInstance().tick(0);

        const commandEncoder = context.device.createCommandEncoder();

        const currentPresentationSize = getPresentationSize(context.canvas, USE_DEVICE_PIXEL_RATIO);
        let resized = false;
        if (context.presentationSize[0] != currentPresentationSize[0] || context.presentationSize[1] != currentPresentationSize[1]) {
            console.log(`${context.presentationSize} ${currentPresentationSize}`);
            context.presentationSize = currentPresentationSize;
            context.canvas.width = context.presentationSize[0];
            context.canvas.height = context.presentationSize[1];
            ({ addDrawSDFPass, sdfBuffer, UBOBuffer } = createDrawSDFPass(context));
            ({ addLightingPass, colorBuffer } = createLightingPass(context, sdfBuffer, UBOBuffer));
            ({ addPresentPass } = createPresentPass(context, colorBuffer, UBOBuffer));
            resized = true;
        }

        if (scene.isDirty() || resized) {
            addDrawSDFPass(commandEncoder, scene);
            addLightingPass(commandEncoder, scene);
            scene.setDirty(false);
        }
        addPresentPass(context, commandEncoder);

        const immediateEncoder = ImmediateDraw.getInstance().draw(
            context.device,
            context.context.getCurrentTexture().createView(),
            context.presentationFormat,
            context.presentationSize[0],
            context.presentationSize[1]
        );

        context.device.queue.submit([commandEncoder.finish(), immediateEncoder.finish()]);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    return true;
}
