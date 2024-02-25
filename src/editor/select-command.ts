import { vec2, vec3, vec4 } from "gl-matrix";
import { ICircle, ILight, IRect, ISceneObject, SceneManager, getInvTransform, getTransform } from "../scene/scene";
import { Command } from "./base-command";
import { CommandManager } from "./command-manager";
import { ImmediateDraw } from "../renderer/immediate-draw";
import { XYAxisGizmo } from "./xy-axis-gizmo";
import { TranslateGizmo } from "./translate-gizmo";
import { ScaleGizmo } from "./scale-gizmo";
import { RotateGizmo } from "./rotate-gizmo";
import { UndoRedoManager } from "./undo-redo-manager";

type GizmoType = "translate" | "rotate" | "scale";

export class SelectCommand extends Command {
    private lastMousePos = vec2.fromValues(0, 0);
    private selected: ISceneObject | null = null;
    private gizmo: XYAxisGizmo | RotateGizmo | null = null;
    private btnsIds = ["btn-translate", "btn-rotate", "btn-scale"];
    private selectedGizmoBtnId: string = "none";
    private selectGizmoCallback: (event: MouseEvent) => unknown;

    constructor(manager: CommandManager, button?: HTMLButtonElement) {
        super(manager, button);
        this.selectGizmoCallback = (event) => {
            this.onGizmoSelected(event.currentTarget as HTMLButtonElement | undefined);
        };
        document.getElementById("transform-tools")?.classList.remove("invisible");
        for (let id of this.btnsIds) {
            const transformButton = document.getElementById(id);
            transformButton?.addEventListener("click", this.selectGizmoCallback);

            if (transformButton?.classList.contains("selected")) {
                this.selectedGizmoBtnId = id;
            }
        }

        UndoRedoManager.getInstance().addListener(this);
    }

    override teardown(): void {
        UndoRedoManager.getInstance().removeListener(this);

        super.teardown();
        for (let id of this.btnsIds) {
            const transformButton = document.getElementById(id);
            transformButton?.removeEventListener("click", this.selectGizmoCallback);
        }
        document.getElementById("transform-tools")?.classList.add("invisible");
    }

    onUndoRedo() {
        if (this.selected == null) {
            return;
        }
        const id = this.selected.id;
        this.reset();
        const newSelected = SceneManager.getInstance().getScene()?.getObjectById(id!);
        if (newSelected != null) {
            this.selected = newSelected;
            this.createGizmo();
        }
    }

    onGizmoSelected(sender?: HTMLButtonElement) {
        if (sender == null) {
            console.warn("null sender");
            return;
        }
        document.getElementById(this.selectedGizmoBtnId)?.classList.remove("selected");
        this.selectedGizmoBtnId = sender.id;
        document.getElementById(this.selectedGizmoBtnId)?.classList.add("selected");
        this.createGizmo();
    }

    createGizmo() {
        if (this.selected) {
            if (this.selectedGizmoBtnId === "btn-translate") {
                this.gizmo = new TranslateGizmo(this.selected);
            } else if (this.selectedGizmoBtnId === "btn-scale") {
                this.gizmo = new ScaleGizmo(this.selected);
            } else if (this.selectedGizmoBtnId === "btn-rotate") {
                this.gizmo = new RotateGizmo(this.selected);
            }
        }
    }

    getObjectUnderCursor(mousePos: vec2) {
        const scene = SceneManager.getInstance().getScene();

        let underCursor: { obj: ISceneObject | null } = {
            obj: null,
        };

        const getLocalMouse = (sceneObject: ISceneObject, includeScale = true) => {
            const localMouse = vec2.create();
            vec2.transformMat3(localMouse, mousePos, getInvTransform(sceneObject, includeScale));
            return localMouse;
        };

        scene?.forEachByType("rect", (sceneObject) => {
            const rect = sceneObject as IRect;
            const localMouse = getLocalMouse(sceneObject);
            const halfX = rect.size[0] / 2;
            const halfY = rect.size[1] / 2;
            if (localMouse[0] > -halfX && localMouse[0] < halfX && localMouse[1] > -halfY && localMouse[1] < halfY) {
                underCursor.obj = rect;
            }
        });

        scene?.forEachByType("circle", (sceneObject) => {
            const circle = sceneObject as ICircle;
            const localMouse = getLocalMouse(sceneObject);
            const dist = Math.sqrt(vec2.dot(localMouse, localMouse));
            if (dist < circle.radius) {
                underCursor.obj = circle;
            }
        });

        scene?.forEachByType("light", (sceneObject) => {
            const light = sceneObject as ILight;
            const localMouse = getLocalMouse(sceneObject, false);
            const dist = Math.sqrt(vec2.dot(localMouse, localMouse));
            if (dist < 20) {
                underCursor.obj = light;
            }
        });

        return underCursor.obj;
    }

    override onMouseDown(event: MouseEvent): void {
        this.gizmo?.onMouseDown(event);
    }

    override onMouseUp(event: MouseEvent): void {
        const scene = SceneManager.getInstance().getScene();

        const consumed = this.gizmo?.onMouseUp(event);

        if (!consumed) {
            this.selected = this.getObjectUnderCursor(vec2.fromValues(event.clientX, event.clientY));
            this.gizmo = null;
            this.createGizmo();
        }
    }

    override onMouseMove(event: MouseEvent): void {
        this.lastMousePos = vec2.fromValues(event.clientX, event.clientY);
    }

    override tick(deltaSeconds: number): void {
        const scene = SceneManager.getInstance().getScene();
        const imDraw = ImmediateDraw.getInstance();

        const objUnderCursor = this.getObjectUnderCursor(this.lastMousePos);

        const getDrawColor = (sceneObj: ISceneObject) => {
            let color = vec3.fromValues(0.7, 0.7, 0.7);
            if (sceneObj === this.selected) {
                color = vec3.fromValues(1, 0.85, 0);
            } else if (sceneObj === objUnderCursor) {
                color = vec3.fromValues(1, 0.5, 0.2);
            }

            return color;
        };

        scene?.forEachByType("rect", (sceneObject) => {
            const rect = sceneObject as IRect;
            const halfSize = vec2.create();
            vec2.div(halfSize, rect.size, vec2.fromValues(2, 2));
            const v1 = vec2.create();
            const v2 = vec2.create();
            vec2.sub(v1, vec2.create(), halfSize);
            vec2.add(v2, vec2.create(), halfSize);
            imDraw.drawRect(v1, v2, getDrawColor(rect), false, getTransform(rect, true));
        });

        scene?.forEachByType("circle", (sceneObject) => {
            const circle = sceneObject as ICircle;
            imDraw.drawCircle(circle.radius, getDrawColor(circle), false, getTransform(circle, true));
        });

        scene?.forEachByType("light", (sceneObject) => {
            const light = sceneObject as ILight;
            imDraw.drawLight(light.position, getDrawColor(light), true);
        });

        if (this.gizmo) {
            this.gizmo.tick(deltaSeconds, this.lastMousePos);
        }
    }

    override reset(): void {
        this.selected = null;
        this.gizmo = null;
    }

    override onKeyDown(event: KeyboardEvent): void {
        if ((event.key === "Delete" || event.key === "Backspace") && this.selected != null) {
            UndoRedoManager.getInstance().preModifyScene();
            const scene = SceneManager.getInstance().getScene();
            scene?.removeObject(this.selected);
            this.gizmo = null;
        }
        let btnId: string | undefined = undefined;
        if (event.key === "w") {
            btnId = this.btnsIds[0];
        } else if (event.key === "e") {
            btnId = this.btnsIds[1];
        } else if (event.key === "r") {
            btnId = this.btnsIds[2];
        }

        if (btnId) {
            this.onGizmoSelected(document.getElementById(btnId) as HTMLButtonElement);
        }
    }
}
