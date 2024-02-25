import { SceneManager } from "../scene/scene";

export interface IUndoRedoListener {
    onUndoRedo: () => unknown;
}

export class UndoRedoManager {
    private static instance?: UndoRedoManager;
    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private listeners: IUndoRedoListener[] = [];

    private constructor() {}

    static getInstance() {
        if (UndoRedoManager.instance == null) {
            this.instance = new UndoRedoManager();
        }

        return this.instance!;
    }

    addListener(listener: IUndoRedoListener) {
        this.listeners.push(listener);
    }

    removeListener(listener: IUndoRedoListener) {
        this.listeners.splice(this.listeners.indexOf(listener), 1);
    }

    preModifyScene() {
        this.redoStack = [];
        this.undoStack.push(SceneManager.getInstance().getScene()!.serialize());
    }

    undo() {
        const last = this.undoStack.pop();
        if (last) {
            this.redoStack.push(SceneManager.getInstance().getScene()!.serialize());
            SceneManager.getInstance().getScene()?.deserialize(last);
        }

        for (let listener of this.listeners) {
            listener.onUndoRedo();
        }
    }

    redo() {
        const last = this.redoStack.pop();
        if (last) {
            this.undoStack.push(SceneManager.getInstance().getScene()!.serialize());
            SceneManager.getInstance().getScene()?.deserialize(last);
        }

        for (let listener of this.listeners) {
            listener.onUndoRedo();
        }
    }
}
