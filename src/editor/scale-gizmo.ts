import { mat3, vec2, vec3 } from "gl-matrix";
import { ISceneObject, getTransform } from "../scene/scene";
import { ImmediateDraw } from "../renderer/immediate-draw";
import { EditAxis, XYAxisGizmo } from "./xy-axis-gizmo";

export class ScaleGizmo extends XYAxisGizmo {
    private initialScale: vec2;

    constructor(sceneObj: ISceneObject, segmentLength: number = 100) {
        super(sceneObj, segmentLength);
        this.initialScale = vec2.clone(this.getSceneObject().scale);
    }

    override apply(editAxis: EditAxis, delta: vec2): void {
        let additiveScale = vec2.create();
        if (editAxis === "xy") {
            let sign = Math.sign(vec2.dot(this.getOffsetToObject(), delta));
            additiveScale = vec2.fromValues(-sign * vec2.len(delta), -sign * vec2.len(delta));
        }
        if (editAxis === "x" || editAxis === "y") {
            const temp = mat3.create();
            mat3.invert(temp, getTransform(this.getSceneObject(), false, false));
            additiveScale = vec2.transformMat3(delta, delta, temp);
        }
        vec2.div(additiveScale, additiveScale, vec2.fromValues(100, 100));

        vec2.add(this.getSceneObject().scale, this.initialScale, additiveScale);
    }

    override onMouseDown(event: MouseEvent): boolean {
        const consumed = super.onMouseDown(event);
        this.initialScale = vec2.clone(this.getSceneObject().scale);
        return consumed;
    }

    override drawControls(xColor: vec3, yColor: vec3, t: (p: vec2) => vec2): void {
        const imDraw = ImmediateDraw.getInstance();

        const sx = vec2.fromValues(0, 6);
        const ex = vec2.fromValues(12, -6);
        const sy = vec2.fromValues(6, 0);
        const ey = vec2.fromValues(-6, 12);
        const transfX = mat3.create();
        mat3.fromTranslation(transfX, vec2.fromValues(this.segmentLength, 0));
        mat3.mul(transfX, getTransform(this.getSceneObject(), false), transfX);

        const transfY = mat3.create();
        mat3.fromTranslation(transfY, vec2.fromValues(0, this.segmentLength));
        mat3.mul(transfY, getTransform(this.getSceneObject(), false), transfY);

        imDraw.drawRect(sx, ex, xColor, true, transfX);
        imDraw.drawRect(sy, ey, yColor, true, transfY);
    }
}
