import { CommandManager } from "./command-manager";
import { UndoRedoManager } from "./undo-redo-manager";

export function setupUI(canvas: HTMLCanvasElement) {
    const commandManager = CommandManager.getInstance();

    // creation buttons
    document.getElementById("btn-light")?.addEventListener("click", (event) => {
        commandManager.newLight(event.currentTarget as HTMLButtonElement | undefined);
    });

    document.getElementById("btn-circle")?.addEventListener("click", (event) => {
        commandManager.newCircle(event.currentTarget as HTMLButtonElement | undefined);
    });

    document.getElementById("btn-rect")?.addEventListener("click", (event) => {
        commandManager.newRect(event.currentTarget as HTMLButtonElement | undefined);
    });

    document.getElementById("btn-select")?.addEventListener("click", (event) => {
        commandManager.select(event.currentTarget as HTMLButtonElement | undefined);
    });

    // events
    canvas.addEventListener("mousedown", (event) => {
        commandManager.onMouseDown(event);
    });

    canvas.addEventListener("mouseup", (event) => {
        commandManager.onMouseUp(event);
    });

    canvas.addEventListener("mousemove", (event) => {
        commandManager.onMouseMove(event);
    });

    window.addEventListener("keydown", (event) => {
        commandManager.onKeyDown(event);
        if (event.key === "z" && event.ctrlKey) {
            UndoRedoManager.getInstance().undo();
        } else if (event.key === "y" && event.ctrlKey) {
            UndoRedoManager.getInstance().redo();
        }
    });
}
