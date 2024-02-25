import { glMatrix, mat3, vec2, vec4 } from "gl-matrix";

export type TCircleType = "circle";
export type TRectType = "rect";
export type TPolygonType = "polygon";
export type TLightType = "light";
export type TObjectType = TCircleType | TRectType | TPolygonType | TLightType;

export interface IBaseSceneObject {
    id?: number;
    position: vec2;
    rotation: number;
    scale: vec2;
}

export function getTransform(sceneObject: IBaseSceneObject, includeScale: boolean = true, includeTranslation: boolean = true) {
    const res = mat3.create();
    if (includeTranslation) {
        mat3.translate(res, res, sceneObject.position);
    }
    mat3.rotate(res, res, glMatrix.toRadian(sceneObject.rotation));
    if (includeScale) {
        mat3.scale(res, res, sceneObject.scale);
    }

    return res;
}

export function getInvTransform(sceneObject: IBaseSceneObject, includeScale: boolean = true) {
    const res = getTransform(sceneObject, includeScale);

    mat3.invert(res, res);
    return res;
}

export interface ICircle extends IBaseSceneObject {
    type: TCircleType;
    radius: number;
}

export interface IRect extends IBaseSceneObject {
    type: TRectType;
    size: vec2;
}

export interface IPolygon extends IBaseSceneObject {
    type: TPolygonType;
    segments: [[vec2, vec2]];
}

export interface ILight extends IBaseSceneObject {
    type: TLightType;
    color: vec4;
}

export type ISceneObject = ICircle | IRect | IPolygon | ILight;

export class Scene {
    private objects: ISceneObject[];
    private dirty = false;
    private nextId = 0;
    constructor(objects: ISceneObject[]) {
        this.objects = objects;
        this.dirty = true;
    }

    forEachByType(type: TObjectType, callback: (object: ISceneObject, i: number) => unknown) {
        let i = 0;
        for (let obj of this.objects) {
            if (obj.type === type) {
                callback(obj, i);
                i = i + 1;
            }
        }
    }

    setDirty(dirty: boolean) {
        this.dirty = dirty;
    }

    isDirty() {
        return this.dirty;
    }

    addObject(object: ISceneObject) {
        if (object.id == null) {
            object.id = this.nextId;
            this.nextId++;
        }
        this.objects.push(object);
        this.setDirty(true);
    }

    hasObject(object: ISceneObject) {
        if (object.id == null) {
            return false;
        }
        return this.objects.find((val) => val.id === object.id) != undefined;
    }

    getObjectById(id: number) {
        return this.objects.find((val) => val.id === id);
    }

    removeObject(object: ISceneObject) {
        this.objects.splice(this.objects.indexOf(object), 1);
        this.setDirty(true);
    }

    serialize() {
        return JSON.stringify({ nextId: this.nextId, objects: this.objects });
    }

    deserialize(data: string) {
        const parsed = JSON.parse(data, (key, value) => {
            if (key === "position" || key === "scale" || key === "size") {
                return vec2.fromValues(parseFloat(value["0"]), parseFloat(value["1"]));
            } else if (key === "color") {
                return vec4.fromValues(parseFloat(value["0"]), parseFloat(value["1"]), parseFloat(value["2"]), parseFloat(value["3"]));
            }
            return value;
        });
        this.nextId = parsed.nextId;
        this.objects = parsed.objects;
        this.setDirty(true);
    }
}

export class SceneManager {
    private static instance?: SceneManager;
    private scene?: Scene;

    static getInstance() {
        if (SceneManager.instance == null) {
            SceneManager.instance = new SceneManager();
        }

        return SceneManager.instance!;
    }

    setScene(scene: Scene) {
        this.scene = scene;
    }

    getScene() {
        return this.scene;
    }
}
