import { vec2, vec3 } from "gl-matrix";
import { ISceneObject } from "../scene/scene";
import { ImmediateDraw } from "../renderer/immediate-draw";
import { EditAxis, XYAxisGizmo } from "./xy-axis-gizmo";

export class TranslateGizmo extends XYAxisGizmo {
    constructor(sceneObj: ISceneObject, segmentLength: number = 100) {
        super(sceneObj, segmentLength);
    }

    override apply(editAxis: EditAxis, delta: vec2): void {
        if (editAxis === "xy") {
            vec2.add(this.getSceneObject().position, delta, this.getInitialPosition());
        }
        if (editAxis === "x" || editAxis === "y") {
            vec2.add(this.getSceneObject().position, delta, this.getInitialPosition());
        }
    }

    override drawControls(xColor: vec3, yColor: vec3, t: (p: vec2) => vec2): void {
        const imDraw = ImmediateDraw.getInstance();
        imDraw.drawLine(t(vec2.fromValues(this.segmentLength, 0)), t(vec2.fromValues(this.segmentLength - 6, 5)), xColor, true);
        imDraw.drawLine(t(vec2.fromValues(this.segmentLength, 0)), t(vec2.fromValues(this.segmentLength - 6, -5)), xColor, true);

        imDraw.drawLine(t(vec2.fromValues(0, this.segmentLength)), t(vec2.fromValues(-5, this.segmentLength - 6)), yColor, true);
        imDraw.drawLine(t(vec2.fromValues(0, this.segmentLength)), t(vec2.fromValues(5, this.segmentLength - 6)), yColor, true);
    }
}
