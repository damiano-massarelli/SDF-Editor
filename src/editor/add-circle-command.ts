import { mat3, vec2, vec3 } from "gl-matrix";
import { SceneManager } from "../scene/scene";
import { Command } from "./base-command";
import { CommandManager } from "./command-manager";
import { ImmediateDraw } from "../renderer/immediate-draw";
import { UndoRedoManager } from "./undo-redo-manager";

export class AddCircleCommand extends Command {
    private centerFound = false;
    private center = vec2.fromValues(0, 0);
    private lastMousePos = vec2.fromValues(0, 0);

    constructor(manager: CommandManager, button?: HTMLButtonElement) {
        super(manager, button);
    }

    override onMouseUp(event: MouseEvent): void {
        const scene = SceneManager.getInstance().getScene();
        if (this.centerFound === false) {
            this.centerFound = true;
            this.center = vec2.fromValues(event.clientX, event.clientY);
        } else {
            const radiusPos = vec2.fromValues(event.clientX, event.clientY);
            const radius = Math.max(1, vec2.dist(this.center, radiusPos));
            if (scene) {
                UndoRedoManager.getInstance().preModifyScene();

                // prettier-ignore
                scene.addObject({ 
                    type: "circle",
                    position: this.center,
                    radius: radius,
                    rotation: 0,
                    scale: vec2.fromValues(1, 1)
                });

                this.reset();
            }
        }
    }

    override onMouseMove(event: MouseEvent): void {
        this.lastMousePos = vec2.fromValues(event.clientX, event.clientY);
    }

    override tick(deltaSeconds: number): void {
        if (this.centerFound) {
            const color = vec3.fromValues(0.7, 0.7, 0.7);
            const radius = Math.max(1, vec2.dist(this.center, this.lastMousePos));
            const circleTransf = mat3.create();
            mat3.fromTranslation(circleTransf, this.center);
            ImmediateDraw.getInstance().drawCircle(radius, color, true, circleTransf);

            ImmediateDraw.getInstance().drawLine(this.center, this.lastMousePos, vec3.fromValues(0.9, 0.9, 0.9), true);
        }
    }

    override reset(): void {
        this.centerFound = false;
        this.center = vec2.fromValues(0, 0);
    }
}
