export interface IFieldInfo {
    offset: number;
    size: number;
}

export interface IStructInfo {
    entries: Map<string, IFieldInfo>;
    structAlignment: number;
    structSize: number;
}

export function structInfo(elements: [number, number, string?][]): IStructInfo {
    const result = {
        entries: new Map<string, IFieldInfo>(),
        structSize: 0,
        structAlignment: 0,
    };
    let maxAlignment = 0;
    let offset = 0;
    for (let element of elements) {
        const size = element[0];
        const alignment = element[1];
        const elemName = element[2];

        maxAlignment = Math.max(maxAlignment, alignment);

        if (offset % alignment != 0) {
            // Does not match required alignment
            offset = Math.ceil(offset / alignment) * alignment; // next multiple of alignment
        }

        // add entry in result map
        if (elemName != null) {
            result.entries.set(elemName, { offset, size });
        }

        offset += size;
    }

    result.structSize = Math.ceil(offset / maxAlignment) * maxAlignment;
    result.structAlignment = maxAlignment;
    return result;
}

export interface ITypeInfo {
    size: number;
    align: number;
}

interface IRegexTypeInfoSolverMapping {
    regex: RegExp;
    typeInfoSolver: (typeDef: string, varName: string, otherStructs: IStruct[]) => ITypeInfo;
}

function extractTemplateParams(typeDef: string) {
    typeDef = typeDef.trim();
    const regex = /([^<]+)<(.+)>$/;
    const result = regex.exec(typeDef);
    if (result == null) {
        throw new Error(`Invalid type ${typeDef}`);
    }
    const templateParams = result[2].split(",").map((s) => s.trim());
    return {
        type: result[1],
        templateParams,
    };
}

function scalar(typeDef: string) {
    return typeDef === "f16"
        ? {
              size: 2,
              align: 2,
          }
        : {
              size: 4,
              align: 4,
          };
}

function atomic() {
    return {
        size: 4,
        align: 4,
    };
}

function vec(typeDef: string) {
    const { type, templateParams } = extractTemplateParams(typeDef);
    let size = 0;
    let align = 0;

    if (type === "vec2") {
        size = align = 8;
    } else if (type === "vec3") {
        size = 12;
        align = 16;
    } else if (type === "vec4") {
        size = 16;
        align = 16;
    }

    if (templateParams[0] === "f16") {
        size /= 2;
        align /= 2;
    }

    return {
        size,
        align,
    };
}

function mat(typeDef: string, varName: string) {
    const { type, templateParams } = extractTemplateParams(typeDef);
    const regex = /mat(\d)x(\d).*/;
    const result = regex.exec(type);
    if (result == null || result.length < 3) {
        throw new Error(`invalid type '${typeDef}' for '${varName}'`);
    }
    const C = result[1];
    const R = result[2];

    const innerVecType = `vec${R}<${templateParams[0]}>`;
    const align = vec(innerVecType).align;

    const arrayType = `array<${innerVecType}, ${C}>`;

    // no need to pass valid otherStruct, matrices can only have primitive values
    const size = array(arrayType, `__${varName}_inner_array__`, []).size;

    return {
        size,
        align,
    };
}

function array(typeDef: string, varName: string, otherStructs: IStruct[]) {
    const { type, templateParams } = extractTemplateParams(typeDef);

    if (templateParams.length < 2) {
        throw new Error(`invalid type '${typeDef}' for v${varName}'`);
    }
    const elemType = templateParams[0];
    const elemNum = parseInt(templateParams[1]);

    const elemTypeInfo = typeInfo(elemType, varName, otherStructs);
    const size = elemNum * Math.ceil(elemTypeInfo.size / elemTypeInfo.align) * elemTypeInfo.align;
    return {
        size,
        align: elemTypeInfo.align,
    };
}

const typeRegexToInfoSolver: IRegexTypeInfoSolverMapping[] = [
    {
        regex: /^(i32|u32|f32|f16)$/,
        typeInfoSolver: scalar,
    },
    {
        regex: /^atomic<.+>$/,
        typeInfoSolver: atomic,
    },
    {
        regex: /^vec\d<.+>$/,
        typeInfoSolver: vec,
    },
    {
        regex: /^mat\dx\d<.+>$/,
        typeInfoSolver: mat,
    },
    {
        regex: /^array<.+>$/,
        typeInfoSolver: array,
    },
];

export function typeInfo(typeDef: string, varName: string, otherStructs: IStruct[]) {
    // primitive types
    typeDef = typeDef.trim();
    for (let { regex, typeInfoSolver } of typeRegexToInfoSolver) {
        if (regex.test(typeDef)) {
            return typeInfoSolver(typeDef, varName, otherStructs);
        }
    }

    // other structs
    for (let struct of otherStructs) {
        if (struct.name.trim() === typeDef) {
            const structInfo = typedStructInfo(struct, otherStructs);
            return {
                size: structInfo.structSize,
                align: structInfo.structAlignment,
            };
        }
    }

    // TODO aliases (e.g. vec4f => vec4<f32>)

    throw new Error(`invalid type '${typeDef}' for '${varName}'`);
}

export interface IStructField {
    type: string;
    size?: number;
    align?: number;
}

export interface IStruct {
    name: string;
    fields: Record<string, IStructField>;
}

export function typedStructInfo(struct: IStruct, otherStructs: IStruct[] = []) {
    const parsedFields: [number, number, string][] = Object.keys(struct.fields).map((fieldName) => {
        const fieldCompleteName = struct.name + "::" + fieldName;
        const field = struct.fields[fieldName];
        const info = typeInfo(field.type, fieldCompleteName, otherStructs);
        return [field.size ?? info.size, field.align ?? info.align, fieldCompleteName];
    });

    return structInfo(parsedFields);
}
