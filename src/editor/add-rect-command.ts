import { mat3, vec2, vec3, vec4 } from "gl-matrix";
import { SceneManager } from "../scene/scene";
import { Command } from "./base-command";
import { CommandManager } from "./command-manager";
import { ImmediateDraw } from "../renderer/immediate-draw";
import { UndoRedoManager } from "./undo-redo-manager";

export class AddRectCommand extends Command {
    private firstPointFound = false;
    private firstPoint = vec2.fromValues(0, 0);
    private lastMousePos = vec2.fromValues(0, 0);

    constructor(manager: CommandManager, button?: HTMLButtonElement) {
        super(manager, button);
    }

    override onMouseUp(event: MouseEvent): void {
        const scene = SceneManager.getInstance().getScene();
        if (this.firstPointFound === false) {
            this.firstPointFound = true;
            this.firstPoint = vec2.fromValues(event.clientX, event.clientY);
        } else {
            const secondPoint = vec2.fromValues(event.clientX, event.clientY);
            const center = vec2.create();
            vec2.add(center, this.firstPoint, secondPoint);
            vec2.divide(center, center, vec2.fromValues(2, 2));

            let size = vec2.create();
            vec2.sub(size, this.firstPoint, secondPoint);
            size = vec2.fromValues(Math.abs(size[0]), Math.abs(size[1]));
            if (scene && size[0] > 1 && size[1] > 1) {
                UndoRedoManager.getInstance().preModifyScene();

                // prettier-ignore
                scene.addObject({ 
                    type: "rect",
                    position: center,
                    size: size,
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
        if (!this.firstPointFound) {
            return;
        }

        const color = vec3.fromValues(0.7, 0.7, 0.7);

        ImmediateDraw.getInstance().drawRect(this.firstPoint, this.lastMousePos, color, true, mat3.create());
    }

    override reset(): void {
        this.firstPointFound = false;
        this.firstPoint = vec2.fromValues(0, 0);
    }
}
