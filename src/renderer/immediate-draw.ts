import { mat3, vec2, vec3, vec4 } from "gl-matrix";
import lineShader from "./line.wgsl";

export class ImmediateDraw {
    private static instance?: ImmediateDraw;
    private static floatsPerLine = 8;

    private linesPipeline?: GPURenderPipeline;
    private linesBufferGPU?: GPUBuffer;

    private canvasSizeBindGroup?: GPUBindGroup;
    private canvasSizeBuffer?: GPUBuffer;

    private linesBufferCapacity: number = -1; // in number of lines

    private linesBufferCPU: Float32Array;
    private addedLines: number;

    static getInstance() {
        if (ImmediateDraw.instance == null) {
            ImmediateDraw.instance = new ImmediateDraw();
        }

        return ImmediateDraw.instance!;
    }

    constructor() {
        this.linesBufferCapacity = -1;
        this.linesBufferCPU = new Float32Array(0);
        this.addedLines = 0;
    }

    private createDrawLinesPipeline(device: GPUDevice, presentationFormat: GPUTextureFormat) {
        const shaderModule = device.createShaderModule({
            code: lineShader,
        });
        this.linesPipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shaderModule,
                entryPoint: "lineVert",
                buffers: [
                    {
                        arrayStride: 8 * Float32Array.BYTES_PER_ELEMENT, // 8 floats, xy-start, xy-end, color
                        stepMode: "instance",
                        attributes: [
                            {
                                // xy-start, xy-end
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x4",
                            },
                            {
                                // color
                                shaderLocation: 1,
                                offset: 4 * Float32Array.BYTES_PER_ELEMENT,
                                format: "float32x4",
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: "lineFrag",
                targets: [
                    {
                        format: presentationFormat,
                        blend: {
                            color: {
                                operation: "add",
                                srcFactor: "src-alpha",
                                dstFactor: "one-minus-src-alpha",
                            },
                            alpha: {
                                // WebGPU blends the final alpha value
                                // with the page color. We need to make sure the final alpha
                                // value is 1.0 otherwise the final color will be blended with
                                // whatever color the page (behind the canvas) is.
                                operation: "add",
                                srcFactor: "one-minus-dst-alpha",
                                dstFactor: "dst-alpha",
                            },
                        },
                    },
                ],
            },
            primitive: {
                topology: "triangle-list",
            },
        });

        this.canvasSizeBuffer = device.createBuffer({
            size: 2 * Float32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            label: "canvas size buffer",
        });

        this.canvasSizeBindGroup = device.createBindGroup({
            layout: this.linesPipeline!.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.canvasSizeBuffer!,
                    },
                },
            ],
        });
    }

    private createOrUpdateLinesBuffer(device: GPUDevice, numLines: number) {
        if (numLines > 0 && numLines > this.linesBufferCapacity) {
            if (this.linesBufferGPU != null) {
                this.linesBufferGPU.destroy();
            }

            this.linesBufferCapacity = numLines;
            this.linesBufferGPU = device.createBuffer({
                size: numLines * 8 * Float32Array.BYTES_PER_ELEMENT,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                label: "lines buffer",
            });
        }
    }

    private drawLines(commandEncoder: GPUCommandEncoder, device: GPUDevice, view: GPUTextureView, presentationFormat: GPUTextureFormat) {
        if (this.addedLines === 0) {
            return;
        }
        if (this.linesPipeline == null) {
            this.createDrawLinesPipeline(device, presentationFormat);
        }
        this.createOrUpdateLinesBuffer(device, this.addedLines);

        device.queue.writeBuffer(this.linesBufferGPU!, 0, this.linesBufferCPU);

        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: view,
                    clearValue: [1, 1, 1, 1],
                    loadOp: "load",
                    storeOp: "store",
                },
            ],
        });

        passEncoder.setPipeline(this.linesPipeline!);
        passEncoder.setBindGroup(0, this.canvasSizeBindGroup!);
        passEncoder.setVertexBuffer(0, this.linesBufferGPU!);
        passEncoder.draw(6, this.addedLines, 0, 0);
        passEncoder.end();
    }

    drawLine(start: vec2, end: vec2, color: vec3, embossed: boolean) {
        if (embossed) {
            // prettier-ignore
            this.drawLine(
                vec2.fromValues(start[0] + 1, start[1] + 1),
                vec2.fromValues(end[0] + 1, end[1] + 1),
                vec3.fromValues(0.05, 0.05, 0.05),
                false
            );
        }
        if (this.addedLines >= this.linesBufferCPU.length / ImmediateDraw.floatsPerLine) {
            this.linesBufferCPU = new Float32Array((this.addedLines + 1) * ImmediateDraw.floatsPerLine);
        }
        this.linesBufferCPU.set([...start, ...end, ...color], this.addedLines * ImmediateDraw.floatsPerLine);
        this.addedLines += 1;
    }

    drawCircle(radius: number, color: vec3, embossed: boolean, transform: mat3, resolution: number = 100) {
        const delta = (Math.PI * 2) / resolution;
        const center = vec2.fromValues(transform[6], transform[7]);
        const scaleX = vec2.len(vec2.fromValues(transform[0], transform[1]));
        const scaleY = vec2.len(vec2.fromValues(transform[3], transform[4]));
        const t = (v: vec2) => {
            const out = vec2.create();
            vec2.transformMat3(out, v, transform);
            return out;
        };
        for (let i = 1; i <= resolution && embossed; i++) {
            let prev = vec2.create();
            let current = vec2.create();
            current = t(vec2.fromValues(Math.cos(i * delta) * radius, Math.sin(i * delta) * radius));
            prev = t(vec2.fromValues(Math.cos((i - 1) * delta) * radius, Math.sin((i - 1) * delta) * radius));
            vec2.add(current, current, vec2.fromValues(1, 1));
            vec2.add(prev, prev, vec2.fromValues(1, 1));

            this.drawLine(prev, current, vec3.fromValues(0.05, 0.05, 0.05), false);
        }
        for (let i = 1; i <= resolution; i++) {
            let prev = vec2.create();
            let current = vec2.create();
            current = t(vec2.fromValues(Math.cos(i * delta) * radius, Math.sin(i * delta) * radius));
            prev = t(vec2.fromValues(Math.cos((i - 1) * delta) * radius, Math.sin((i - 1) * delta) * radius));

            this.drawLine(prev, current, color, false);
        }
    }

    drawRect(start: vec2, end: vec2, color: vec3, embossed: boolean, transform: mat3) {
        const t = (p: vec2) => {
            const temp = vec2.create();
            vec2.transformMat3(temp, p, transform);
            return temp;
        };

        const drawRectInternal = (s: vec2, e: vec2, col: vec3) => {
            // prettier-ignore
            this.drawLine(
                t(s),
                t(vec2.fromValues(e[0], s[1])),
                col,
                false);

            // prettier-ignore
            this.drawLine(
                t(s),
                t(vec2.fromValues(s[0], e[1])),
                col,
                false);

            // prettier-ignore
            this.drawLine(
                t(vec2.fromValues(e[0], s[1])),
                t(e),
                col,
                false);

            // prettier-ignore
            this.drawLine(
                t(vec2.fromValues(s[0], e[1])),
                t(e),
                col,
                false);
        };

        if (embossed) {
            drawRectInternal(vec2.fromValues(start[0] + 1, start[1] + 1), vec2.fromValues(end[0] + 1, end[1] + 1), vec3.fromValues(0.1, 0.1, 0.1));
        }
        drawRectInternal(start, end, color);
    }

    drawLight(position: vec2, color: vec3, embossed: boolean) {
        const circleCenter = vec2.create();
        vec2.add(circleCenter, position, vec2.fromValues(0, -10));
        const circleTransf = mat3.create();
        mat3.fromTranslation(circleTransf, circleCenter);
        this.drawCircle(10, color, embossed, circleTransf);
        // prettier-ignore
        this.drawLine(vec2.fromValues(position[0] - 3, position[1]), 
            vec2.fromValues(position[0] - 3, position[1] + 7),
            color, embossed);

        // prettier-ignore
        this.drawLine(vec2.fromValues(position[0] + 3, position[1]), 
            vec2.fromValues(position[0] + 3, position[1] + 7),
            color, embossed);

        // prettier-ignore
        this.drawLine(vec2.fromValues(position[0] - 3, position[1] + 7), 
            vec2.fromValues(position[0] + 3, position[1] + 7),
            color, embossed);
    }

    draw(device: GPUDevice, view: GPUTextureView, presentationFormat: GPUTextureFormat, width: number, height: number) {
        const commandEncoder = device.createCommandEncoder({
            label: "draw immediate command encoder",
        });

        if (this.canvasSizeBuffer != null) {
            device.queue.writeBuffer(this.canvasSizeBuffer, 0, new Float32Array([width, height]));
        }

        this.drawLines(commandEncoder, device, view, presentationFormat);
        this.addedLines = 0;

        return commandEncoder;
    }
}
