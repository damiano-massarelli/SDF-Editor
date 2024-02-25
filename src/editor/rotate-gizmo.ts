import { glMatrix, vec2, vec3 } from "gl-matrix";
import { ISceneObject, SceneManager, getTransform } from "../scene/scene";
import { ImmediateDraw } from "../renderer/immediate-draw";
import { UndoRedoManager } from "./undo-redo-manager";

export class RotateGizmo {
    private sceneObj: ISceneObject;
    public radius: number;
    private isEditing: boolean;
    private isHover: boolean;
    private initialObjectRot: number;
    private initialClickRot: number;

    constructor(sceneObject: ISceneObject, radius: number = 60) {
        this.sceneObj = sceneObject;
        this.radius = radius;
        this.isEditing = false;
        this.isHover = false;
        this.initialObjectRot = 0;
        this.initialClickRot = 0;
    }

    tick(deltaSec: number, mousePos: vec2) {
        const distance = vec2.distance(mousePos, this.sceneObj.position);
        this.isHover = distance < this.radius + 10 && distance > this.radius - 10;
        const highlight = this.isEditing || this.isHover;
        const imDraw = ImmediateDraw.getInstance();

        const transform = getTransform(this.sceneObj, false);
        imDraw.drawCircle(this.radius, highlight ? vec3.fromValues(0, 1, 1) : vec3.fromValues(0.0, 0.3, 0.3), true, transform);

        const t = (v: vec2) => {
            const out = vec2.create();
            vec2.transformMat3(out, v, transform);
            return out;
        };

        imDraw.drawLine(t(vec2.fromValues(0, 0)), t(vec2.fromValues(this.radius, 0)), highlight ? vec3.fromValues(1, 0, 0) : vec3.fromValues(0.3, 0, 0), true);
        imDraw.drawLine(t(vec2.fromValues(0, 0)), t(vec2.fromValues(0, this.radius)), highlight ? vec3.fromValues(0, 1, 0) : vec3.fromValues(0, 0.3, 0), true);

        if (this.isEditing) {
            const rot = Math.atan2(mousePos[1] - this.sceneObj.position[1], mousePos[0] - this.sceneObj.position[0]);
            this.sceneObj.rotation = this.initialObjectRot + (180 * (rot - this.initialClickRot)) / Math.PI;
        }
    }

    onMouseDown(event: MouseEvent) {
        if (!this.isHover) {
            return;
        }

        UndoRedoManager.getInstance().preModifyScene();
        this.isEditing = true;
        this.initialObjectRot = this.sceneObj.rotation;
        this.initialClickRot = Math.atan2(event.clientY - this.sceneObj.position[1], event.clientX - this.sceneObj.position[0]);
    }

    onMouseUp(event: MouseEvent) {
        const wasEditing = this.isEditing;
        this.isEditing = false;
        if (wasEditing) {
            SceneManager.getInstance().getScene()?.setDirty(true);
        }

        return wasEditing;
    }
}
