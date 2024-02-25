import { vec2 } from "gl-matrix";
import { CommandManager } from "./command-manager";

export abstract class Command {
    protected manager: CommandManager;
    protected button?: HTMLButtonElement;

    constructor(manager: CommandManager, button?: HTMLButtonElement) {
        this.manager = manager;
        this.button = button;
    }

    init() {
        if (this.button) {
            this.button.classList.add("selected");
        }
    }

    teardown(): void {
        if (this.button) {
            this.button.classList.remove("selected");
        }
    }

    reset(): void {}

    onMouseDown(event: MouseEvent): void {}

    onMouseUp(event: MouseEvent): void {}

    getIcon(): { texture: GPUTexture; size: vec2 } | null {
        return null;
    }

    tick(deltaSeconds: number): void {}

    onMouseMove(event: MouseEvent): void {}

    onKeyDown(event: KeyboardEvent) {}
}
