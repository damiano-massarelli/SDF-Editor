import { vec2, vec4 } from "gl-matrix";
import { CommandManager } from "./command-manager";
import { SceneManager } from "../scene/scene";
import { Command } from "./base-command";
import { UndoRedoManager } from "./undo-redo-manager";

export class AddLightCommand extends Command {
    constructor(manager: CommandManager, button?: HTMLButtonElement) {
        super(manager, button);
    }

    override onMouseUp(event: MouseEvent): void {
        const scene = SceneManager.getInstance().getScene();
        if (scene) {
            UndoRedoManager.getInstance().preModifyScene();

            // prettier-ignore
            scene.addObject({
                type: "light",
                color: vec4.fromValues(5 * Math.random() + 1, 5 * Math.random() + 1, 5 * Math.random() + 1, 1),
                position: vec2.fromValues(event.clientX, event.clientY),
                rotation: 0,
                scale: vec2.fromValues(1, 1),
            });
        }
    }
}
