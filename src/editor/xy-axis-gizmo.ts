import { mat3, vec2, vec3 } from "gl-matrix";
import { ISceneObject, SceneManager, getInvTransform, getTransform } from "../scene/scene";
import { ImmediateDraw } from "../renderer/immediate-draw";
import { UndoRedoManager } from "./undo-redo-manager";

export type EditAxis = "none" | "x" | "y" | "xy";

export class XYAxisGizmo {
    private sceneObj: ISceneObject;
    public segmentLength: number;
    public activateDistance = 20;
    private editingAxis: EditAxis = "none";
    private offset: vec2 = vec2.fromValues(0, 0);
    private initialPos = vec2.fromValues(0, 0);
    private initialInvTransform = mat3.create();

    constructor(sceneObj: ISceneObject, segmentLength: number = 100) {
        this.sceneObj = sceneObj;
        this.segmentLength = segmentLength;
    }

    getInitialPosition() {
        return vec2.clone(this.initialPos);
    }

    getOffsetToObject() {
        return vec2.clone(this.offset);
    }

    getSceneObject() {
        return this.sceneObj;
    }

    getInitialClickPosition() {
        const clickPos = vec2.create();
        vec2.sub(clickPos, this.initialPos, this.offset);
        return clickPos;
    }

    getEditAxis(mousePos: vec2): EditAxis {
        const invTransf = getInvTransform(this.sceneObj, false);
        const localMousePos = vec2.create();
        vec2.transformMat3(localMousePos, mousePos, invTransf);
        let x = false;
        let y = false;
        if (localMousePos[0] > 0 && localMousePos[0] < this.segmentLength && Math.abs(localMousePos[1]) < this.activateDistance) {
            x = true;
        }
        if (localMousePos[1] > 0 && localMousePos[1] < this.segmentLength && Math.abs(localMousePos[0]) < this.activateDistance) {
            y = true;
        }

        if (x && y) {
            return "xy";
        } else if (x) {
            return "x";
        } else if (y) {
            return "y";
        }

        return "none";
    }

    tick(deltaSec: number, mousePos: vec2) {
        const imDraw = ImmediateDraw.getInstance();

        const transf = getTransform(this.sceneObj, false);
        const t = (p: vec2) => {
            const oriented = vec2.create();
            vec2.transformMat3(oriented, p, transf);
            return oriented;
        };

        const hoverAxis = this.getEditAxis(mousePos);

        const highlight = (axis: EditAxis) => {
            return (axis === hoverAxis && this.editingAxis === "none") || this.editingAxis === axis;
        };

        let xColor = vec3.fromValues(0.3, 0, 0);
        if (highlight("x")) {
            xColor = vec3.fromValues(1, 0, 0);
        }
        imDraw.drawLine(t(vec2.fromValues(0, 0)), t(vec2.fromValues(this.segmentLength, 0)), xColor, true);

        let yColor = vec3.fromValues(0.0, 0.3, 0);
        if (highlight("y")) {
            yColor = vec3.fromValues(0, 1, 0);
        }
        imDraw.drawLine(t(vec2.fromValues(0, 0)), t(vec2.fromValues(0, this.segmentLength)), yColor, true);

        let xyColor = vec3.fromValues(0.3, 0.3, 0);
        if (highlight("xy")) {
            xyColor = vec3.fromValues(1, 1, 0);
        }

        imDraw.drawLine(t(vec2.fromValues(0, this.activateDistance)), t(vec2.fromValues(this.activateDistance, this.activateDistance)), xyColor, true);
        imDraw.drawLine(t(vec2.fromValues(this.activateDistance, 0)), t(vec2.fromValues(this.activateDistance, this.activateDistance)), xyColor, true);

        this.drawControls(xColor, yColor, t);

        if (this.editingAxis === "xy") {
            const clickPos = vec2.create();
            vec2.sub(clickPos, this.initialPos, this.offset);
            const delta = vec2.create();

            vec2.sub(delta, mousePos, clickPos);
            this.apply(this.editingAxis, delta);
        }
        if (this.editingAxis === "x" || this.editingAxis === "y") {
            const localCurrent = vec2.create();
            vec2.transformMat3(localCurrent, mousePos, this.initialInvTransform);

            const localInitial = vec2.create();
            vec2.sub(localInitial, this.initialPos, this.offset);
            vec2.transformMat3(localInitial, localInitial, this.initialInvTransform);

            const diff = vec2.create();
            vec2.sub(diff, localCurrent, localInitial);

            let movement = vec3.create();
            if (this.editingAxis === "x") {
                movement = vec3.fromValues(diff[0], 0, 0);
            }
            if (this.editingAxis === "y") {
                movement = vec3.fromValues(0, diff[1], 0);
            }

            vec3.transformMat3(movement, movement, transf);
            this.apply(this.editingAxis, vec2.fromValues(movement[0], movement[1]));
        }
    }

    apply(editAxis: EditAxis, delta: vec2) {}

    drawControls(xColor: vec3, yColor: vec3, t: (p: vec2) => vec2) {}

    onMouseDown(event: MouseEvent) {
        const editAxis = this.getEditAxis(vec2.fromValues(event.clientX, event.clientY));
        this.editingAxis = editAxis;
        this.initialPos = vec2.clone(this.sceneObj.position);
        this.initialInvTransform = getInvTransform(this.sceneObj, false);
        this.offset = vec2.fromValues(this.sceneObj.position[0] - event.clientX, this.sceneObj.position[1] - event.clientY);
        if (editAxis !== "none") {
            UndoRedoManager.getInstance().preModifyScene();
        }

        return editAxis != "none";
    }

    onMouseUp(event: MouseEvent) {
        const consumed = this.editingAxis !== "none";

        this.editingAxis = "none";
        SceneManager.getInstance().getScene()?.setDirty(true);

        return consumed;
    }
}
