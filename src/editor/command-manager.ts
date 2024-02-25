import { AddCircleCommand } from "./add-circle-command";
import { AddLightCommand } from "./add-light-command";
import { AddRectCommand } from "./add-rect-command";
import { Command } from "./base-command";
import { SelectCommand } from "./select-command";

export class CommandManager {
    private static instance?: CommandManager;

    private currentCommand?: Command;

    static getInstance() {
        if (CommandManager.instance == null) {
            CommandManager.instance = new CommandManager();
        }

        return this.instance!;
    }

    public setCommand(cmd: Command) {
        if (this.currentCommand != null) {
            this.currentCommand.teardown();
        }

        this.currentCommand = cmd;
        this.currentCommand.init();
    }

    newLight(sender?: HTMLButtonElement) {
        const cmd = new AddLightCommand(this, sender);
        this.setCommand(cmd);
    }

    newCircle(sender?: HTMLButtonElement) {
        const cmd = new AddCircleCommand(this, sender);
        this.setCommand(cmd);
    }

    newRect(sender?: HTMLButtonElement) {
        const cmd = new AddRectCommand(this, sender);
        this.setCommand(cmd);
    }

    select(sender?: HTMLButtonElement) {
        const cmd = new SelectCommand(this, sender);
        this.setCommand(cmd);
    }

    onMouseDown(event: MouseEvent) {
        this.currentCommand?.onMouseDown(event);
    }

    onMouseUp(event: MouseEvent) {
        this.currentCommand?.onMouseUp(event);
    }

    onMouseMove(event: MouseEvent) {
        this.currentCommand?.onMouseMove(event);
    }

    tick(deltaSeconds: number) {
        this.currentCommand?.tick(deltaSeconds);
    }

    onKeyDown(event: KeyboardEvent) {
        this.currentCommand?.onKeyDown(event);
        if (event.key === "Escape") {
            this.currentCommand?.reset();
        }
    }
}
