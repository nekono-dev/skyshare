#!/usr/bin/env node
import fs from "fs"
import path from "path"
import YAML from "yaml"
import { fileURLToPath } from "url"

type OpenAPI = any

function parseArgs() {
    const args = process.argv.slice(2)
    const out: { input?: string; output?: string } = {}
    for (let i = 0; i < args.length; i++) {
        const a = args[i]
        if (a === "--input" || a === "-i") out.input = args[++i]
        else if (a === "--output" || a === "-o") out.output = args[++i]
        else if (a === "--help" || a === "-h") {
            console.log(
                "Usage: generate-zod-from-openapi --input <openapi.yaml> --output <out.ts>",
            )
            process.exit(0)
        }
    }
    if (!out.input) throw new Error("Missing --input")
    if (!out.output) throw new Error("Missing --output")
    return out as { input: string; output: string }
}

function readOpenApi(file: string): OpenAPI {
    const txt = fs.readFileSync(file, "utf8")
    try {
        if (/\.ya?ml$/i.test(file)) return YAML.parse(txt)
        return JSON.parse(txt)
    } catch (e) {
        throw new Error(`Failed to parse OpenAPI file: ${e}`)
    }
}

function renderLiteral(val: any) {
    return JSON.stringify(val)
}

function isStringEnum(arr: any[]) {
    return arr.every(v => typeof v === "string")
}

function pascalCase(s: string) {
    return s
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(w => w[0].toUpperCase() + w.slice(1))
        .join("")
}

function camelCase(s: string) {
    const p = pascalCase(s)
    return p[0] ? p[0].toLowerCase() + p.slice(1) : p
}

function generate(openapi: OpenAPI, outputPath: string, rootFilePath: string) {
    const comps = openapi.components || {}
    const schemas = (comps.schemas as Record<string, any>) || {}

    const loadedFiles: Record<string, any> = {}
    loadedFiles[path.resolve(rootFilePath)] = openapi

    const header = ["/**", " * GENERATED CODE - DO NOT MODIFY.", " */", ""]

    const idMap: Record<string, string> = {}
    const schemaSourceFile: Record<string, string> = {}

    let outDir = outputPath
    try {
        if (
            fs.existsSync(outputPath) &&
            fs.statSync(outputPath).isDirectory()
        ) {
            outDir = outputPath
        } else if (!path.extname(outputPath)) {
            outDir = outputPath
        } else {
            outDir = path.dirname(outputPath)
        }
    } catch (e) {
        outDir = path.dirname(outputPath)
    }
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

    function registerSchema(name: string) {
        if (!idMap[name]) {
            const base = pascalCase(name)
            const pretty = base.endsWith("Schema") ? base : base + "Schema"
            idMap[name] = pretty
        }
        return idMap[name]
    }

    function loadAndParse(filePath: string) {
        const abs = path.resolve(filePath)
        if (loadedFiles[abs]) return loadedFiles[abs]
        const txt = fs.readFileSync(abs, "utf8")
        const doc = /\.ya?ml$/i.test(abs) ? YAML.parse(txt) : JSON.parse(txt)
        loadedFiles[abs] = doc
        return doc
    }

    function resolveExternalRef($ref: string, baseFile?: string) {
        const [filePart, fragPart] = $ref.split("#")
        const baseDir = baseFile
            ? path.dirname(baseFile)
            : path.dirname(rootFilePath)
        const refFile = filePart
            ? path.resolve(baseDir, filePart)
            : path.resolve(baseFile || rootFilePath)
        const doc = loadAndParse(refFile)
        if (!fragPart || !fragPart.startsWith("/"))
            throw new Error("Unsupported external $ref fragment: " + $ref)
        const parts = fragPart.replace(/^\//, "").split("/")
        let cur: any = doc
        for (const p of parts) {
            if (cur === undefined) break
            cur = cur[p]
        }
        if (cur === undefined)
            throw new Error(
                "Could not resolve fragment " + fragPart + " in " + refFile,
            )
        const baseName = path.basename(refFile).replace(/\.[^.]+$/, "")
        const last = parts[parts.length - 1] || baseName
        if (
            cur &&
            typeof cur === "object" &&
            cur.schema &&
            (cur.schema.type || cur.schema.properties || cur.schema.enum)
        ) {
            cur = cur.schema
        }
        const fileBasePascal = pascalCase(baseName)
        const lastPascal = pascalCase(String(last))
        const candidate = `${fileBasePascal}${lastPascal}`
        if (schemas[candidate]) {
            try {
                const a = JSON.stringify(schemas[candidate])
                const b = JSON.stringify(cur)
                if (a === b) {
                    if (!schemaSourceFile[candidate]) {
                        schemaSourceFile[candidate] = refFile
                    }
                    registerSchema(candidate)
                    return { name: candidate, refFile }
                }
            } catch (_) {}
            const disamb = `${fileBasePascal}_${lastPascal}`
            if (!schemas[disamb]) {
                schemas[disamb] = cur
                schemaSourceFile[disamb] = refFile
                registerSchema(disamb)
            }
            return { name: disamb, refFile }
        }
        schemas[candidate] = cur
        schemaSourceFile[candidate] = refFile
        registerSchema(candidate)
        return { name: candidate, refFile }
    }

    function refToIdent($ref: string, baseFile?: string) {
        if ($ref.startsWith("#/components/schemas/")) {
            const m = $ref.match(/^#\/components\/schemas\/(.+)$/)
            if (!m) throw new Error("Unsupported $ref: " + $ref)
            const tail = m[1]
            const tailParts = tail.split("/")
            const lastPart = tailParts[tailParts.length - 1]
            if (
                baseFile &&
                path.resolve(baseFile) !== path.resolve(rootFilePath)
            ) {
                const doc = loadAndParse(baseFile)
                const parts = ["components", "schemas", ...tailParts]
                let cur: any = doc
                for (const p of parts) {
                    if (cur === undefined) break
                    cur = cur[p]
                }
                if (cur !== undefined) {
                    const baseName = path
                        .basename(baseFile)
                        .replace(/\.[^.]+$/, "")
                    // use underscore-joined tail for stable key
                    const key = `${baseName}_${tailParts.join("_")}`
                    if (!schemas[key]) {
                        schemas[key] = cur
                        schemaSourceFile[key] = baseFile
                        registerSchema(key)
                    }
                    return registerSchema(key)
                }
            }
            return registerSchema(lastPart)
        }
        if ($ref.startsWith("#/")) {
            const doc = baseFile
                ? loadAndParse(baseFile)
                : loadedFiles[path.resolve(rootFilePath)]
            const parts = $ref.replace(/^#\//, "").split("/")
            let cur: any = doc
            for (const p of parts) {
                if (cur === undefined) break
                cur = cur[p]
            }
            if (cur === undefined) {
                throw new Error("Could not resolve local $ref: " + $ref)
            }
            if (
                cur &&
                typeof cur === "object" &&
                cur.schema &&
                (cur.schema.type || cur.schema.properties || cur.schema.enum)
            ) {
                cur = cur.schema
            }
            const baseName = path
                .basename(baseFile || rootFilePath)
                .replace(/\.[^.]+$/, "")
            const key = `${baseName}_${parts.join("_")}`
            if (!schemas[key]) {
                schemas[key] = cur
                schemaSourceFile[key] = baseFile || rootFilePath
            }
            return registerSchema(key)
        }
        const res = resolveExternalRef($ref, baseFile)
        return registerSchema(res.name)
    }

    function renderSchema(
        s: any,
        baseFile?: string,
        forEndpoint = false,
    ): string {
        if (!s) return "z.any()"
        if (s.$ref) {
            const id = refToIdent(s.$ref, baseFile)
            if (forEndpoint) {
                return `Components.${id}`
            }
            // components.ts では前方参照や循環参照が発生しうるため lazy で評価順序依存を回避する。
            return `z.lazy(() => ${id})`
        }
        if (s.oneOf)
            return `z.union([${s.oneOf.map((x: any) => renderSchema(x, baseFile, forEndpoint)).join(", ")}])`
        if (s.anyOf)
            return `z.union([${s.anyOf.map((x: any) => renderSchema(x, baseFile, forEndpoint)).join(", ")}])`
        if (s.allOf)
            return `z.intersection(${renderSchema(s.allOf[0], baseFile, forEndpoint)}, ${renderSchema(s.allOf[1], baseFile, forEndpoint)})`
        if (s.enum) {
            if (isStringEnum(s.enum))
                return `z.enum([${s.enum.map((v: string) => JSON.stringify(v)).join(", ")}])`
            return `z.union([${s.enum.map((v: any) => `z.literal(${renderLiteral(v)})`).join(", ")}])`
        }
        const t = s.type
        if (t === "object" || (t === undefined && s.properties)) {
            const props = s.properties || {}
            const req = new Set(s.required || [])
            const parts: string[] = []
            for (const [k, v] of Object.entries(props)) {
                const expr = renderSchema(v as any, baseFile, forEndpoint)
                const propExpr = req.has(k) ? expr : `${expr}.optional()`
                parts.push(`${JSON.stringify(k)}: ${propExpr}`)
            }
            const additional = s.additionalProperties
            const obj =
                `z.object({ ${parts.join(", ")} })` +
                (s.additionalProperties ? "" : ".strict()")
            return obj
        }
        if (t === "array")
            return `z.array(${renderSchema(s.items || {}, baseFile, forEndpoint)})`
        if (t === "string") {
            if (s.format === "binary") return "z.instanceof(Blob)"
            return "z.string()"
        }
        if (t === "integer" || t === "number") return "z.number()"
        if (t === "boolean") return "z.boolean()"
        return "z.any()"
    }

    function resolveRefSchema($ref: string, baseFile?: string): any {
        if ($ref.startsWith("#/")) {
            const doc = baseFile
                ? loadAndParse(baseFile)
                : loadedFiles[path.resolve(rootFilePath)]
            const parts = $ref.replace(/^#\//, "").split("/")
            let cur: any = doc
            for (const p of parts) {
                if (cur === undefined) break
                cur = cur[p]
            }
            return cur
        }

        const [filePart, fragPart] = $ref.split("#")
        const baseDir = baseFile
            ? path.dirname(baseFile)
            : path.dirname(rootFilePath)
        const refFile = path.resolve(baseDir, filePart)
        const doc = loadAndParse(refFile)
        if (!fragPart || !fragPart.startsWith("/")) return undefined
        const parts = fragPart.replace(/^\//, "").split("/")
        let cur: any = doc
        for (const p of parts) {
            if (cur === undefined) break
            cur = cur[p]
        }
        return cur
    }

    function derefSchema(s: any, baseFile?: string, depth = 0): any {
        if (!s || depth > 8) return s
        if (s.$ref && typeof s.$ref === "string") {
            const resolved = resolveRefSchema(s.$ref, baseFile)
            return derefSchema(resolved, baseFile, depth + 1)
        }
        return s
    }

    function detectSchemaKind(
        s: any,
        baseFile?: string,
    ):
        | "binary"
        | "binary-array"
        | "array"
        | "object"
        | "string"
        | "number"
        | "boolean"
        | "other" {
        const schema = derefSchema(s, baseFile)
        if (!schema) return "other"

        if (schema.type === "string" && schema.format === "binary") {
            return "binary"
        }
        if (schema.type === "array") {
            const item = derefSchema(schema.items || {}, baseFile)
            if (item?.type === "string" && item?.format === "binary") {
                return "binary-array"
            }
            return "array"
        }
        if (schema.type === "object" || schema.properties) return "object"
        if (schema.type === "string" || schema.enum) return "string"
        if (schema.type === "integer" || schema.type === "number") {
            return "number"
        }
        if (schema.type === "boolean") return "boolean"
        return "other"
    }

    function renderMultipartFieldSchema(
        s: any,
        required: boolean,
        baseFile?: string,
    ): string {
        const kind = detectSchemaKind(s, baseFile)
        const expr = renderSchema(s, baseFile, true)

        let fieldExpr = ""
        if (kind === "binary") {
            fieldExpr = `zfd.file()`
        } else if (kind === "binary-array") {
            fieldExpr = `zfd.repeatableOfType(zfd.file())`
        } else if (kind === "string") {
            fieldExpr =
                expr === "z.string()" ? `zfd.text()` : `zfd.text(${expr})`
        } else if (kind === "number") {
            fieldExpr =
                expr === "z.number()" ? `zfd.numeric()` : `zfd.numeric(${expr})`
        } else if (kind === "array") {
            const arraySchema = derefSchema(s, baseFile)
            const itemSchema = arraySchema?.items || {}
            const itemKind = detectSchemaKind(itemSchema, baseFile)
            const itemExpr = renderSchema(itemSchema, baseFile, true)
            if (itemKind === "string") {
                fieldExpr =
                    itemExpr === "z.string()"
                        ? `zfd.repeatableOfType(zfd.text())`
                        : `zfd.repeatableOfType(zfd.text(${itemExpr}))`
            } else if (itemKind === "number") {
                fieldExpr =
                    itemExpr === "z.number()"
                        ? `zfd.repeatableOfType(zfd.numeric())`
                        : `zfd.repeatableOfType(zfd.numeric(${itemExpr}))`
            } else {
                fieldExpr = `zfd.json(${expr})`
            }
        } else {
            // multipart で object/array/その他の複雑型は JSON 文字列として受け取り、zod で復号後に検証する。
            fieldExpr = `zfd.json(${expr})`
        }

        return required ? fieldExpr : `${fieldExpr}.optional()`
    }

    function renderMultipartRequestBodySchema(
        s: any,
        baseFile?: string,
    ): string {
        const schema = derefSchema(s, baseFile)
        if (!schema || !(schema.type === "object" || schema.properties)) {
            return renderSchema(s, baseFile, true)
        }

        const props = schema.properties || {}
        const req = new Set(schema.required || [])
        const parts: string[] = []
        for (const [k, v] of Object.entries(props)) {
            const fieldExpr = renderMultipartFieldSchema(
                v,
                req.has(k),
                baseFile,
            )
            parts.push(`${JSON.stringify(k)}: ${fieldExpr}`)
        }

        return `zfd.formData({ ${parts.join(", ")} })`
    }

    function pickContentSchemaWithType(content: any, preferredTypes: string[]) {
        if (!content || typeof content !== "object") return undefined
        for (const mediaType of preferredTypes) {
            const media = content[mediaType]
            if (media && typeof media === "object" && media.schema)
                return { schema: media.schema, mediaType }
        }
        // Fallback to any declared media type that includes a schema.
        for (const [mediaType, media] of Object.entries(
            content as Record<string, any>,
        )) {
            if (media && typeof media === "object" && media.schema)
                return { schema: media.schema, mediaType }
        }
        return undefined
    }

    // Pre-scan paths to register external refs
    const pathsForScan = openapi.paths || {}
    for (const [p, specRaw] of Object.entries(pathsForScan)) {
        let spec: any = specRaw
        let specSourceFile: string | undefined = path.resolve(rootFilePath)
        if (spec && spec.$ref && typeof spec.$ref === "string") {
            const [filePart, fragPart] = spec.$ref.split("#")
            const refFile = path.resolve(path.dirname(rootFilePath), filePart)
            const doc = loadAndParse(refFile)
            if (!fragPart) {
                spec = doc
                specSourceFile = refFile
            } else {
                const parts = fragPart.replace(/^\//, "").split("/")
                let cur: any = doc
                for (const part of parts) {
                    if (cur === undefined) break
                    cur = cur[part]
                }
                spec = cur || {}
                specSourceFile = refFile
            }
        }
        if (!spec || typeof spec !== "object") continue
        for (const method of Object.keys(spec as any)) {
            let op = (spec as any)[method]
            if (!op || typeof op !== "object") continue
            // resolve operation-level $ref (e.g., post: { $ref: './post.yaml' })
            if (op.$ref && typeof op.$ref === "string") {
                const [filePart, fragPart] = op.$ref.split("#")
                const refFile = path.resolve(
                    path.dirname(specSourceFile || rootFilePath),
                    filePart,
                )
                const doc = loadAndParse(refFile)
                if (!fragPart) {
                    op = doc
                } else {
                    const parts = fragPart.replace(/^\//, "").split("/")
                    let cur: any = doc
                    for (const part of parts) {
                        if (cur === undefined) break
                        cur = cur[part]
                    }
                    op = cur || {}
                }
            }
            if (!op || typeof op !== "object") continue
            if (op.requestBody) {
                const content = op.requestBody.content || {}
                const reqSchema = pickContentSchemaWithType(content, [
                    "application/json",
                    "multipart/form-data",
                    "application/x-www-form-urlencoded",
                    "*/*",
                ])
                if (reqSchema) renderSchema(reqSchema.schema, specSourceFile)
            }
            if (Array.isArray(op.parameters) && op.parameters.length > 0) {
                for (const p of op.parameters) {
                    const s =
                        p.schema ||
                        (p.content &&
                            p.content["application/json"] &&
                            p.content["application/json"].schema) ||
                        {}
                    renderSchema(s, specSourceFile)
                }
            }
            const responses = op.responses || {}
            for (const resp of Object.values(responses)) {
                if (!resp || typeof resp !== "object") continue
                const content = (resp as any).content || {}
                const json = content["application/json"] || content["*/*"]
                if (json && json.schema)
                    renderSchema(json.schema, specSourceFile)
                if ((resp as any).headers) {
                    for (const hobj of Object.values((resp as any).headers)) {
                        const hs = (hobj as any).schema || {}
                        renderSchema(hs, specSourceFile)
                    }
                }
            }
        }
    }

    // Emit components
    const emitted = new Set<string>()
    const compLines: string[] = []
    compLines.push(...header)
    compLines.push("import { z } from 'zod/v4';", "")
    while (true) {
        const names = Object.keys(schemas).filter(n => !emitted.has(n))
        if (names.length === 0) break
        for (const name of names) {
            registerSchema(name)
            const id = idMap[name]
            const sourceForSchema = schemaSourceFile[name]
                ? path.resolve(schemaSourceFile[name])
                : path.resolve(rootFilePath)
            const body = renderSchema(schemas[name], sourceForSchema, false)
            const typeBase = id.replace(/Schema$/, "")
            compLines.push(
                `export const ${id} = ${body};`,
                `export type ${typeBase}Type = z.infer<typeof ${id}>;`,
                "",
            )
            emitted.add(name)
        }
    }

    // Emit endpoints
    const paths = openapi.paths || {}
    for (const [p, specRaw] of Object.entries(paths)) {
        let spec: any = specRaw
        let specSourceFile: string | undefined = path.resolve(rootFilePath)
        if (spec && spec.$ref && typeof spec.$ref === "string") {
            const [filePart, fragPart] = spec.$ref.split("#")
            const refFile = path.resolve(path.dirname(rootFilePath), filePart)
            const doc = loadAndParse(refFile)
            if (!fragPart) {
                spec = doc
                specSourceFile = refFile
            } else {
                const parts = fragPart.replace(/^\//, "").split("/")
                let cur: any = doc
                for (const part of parts) {
                    if (cur === undefined) break
                    cur = cur[part]
                }
                spec = cur || {}
                specSourceFile = refFile
            }
        }
        if (!spec || typeof spec !== "object") continue
        for (const method of Object.keys(spec as any)) {
            let op = (spec as any)[method]
            if (!op || typeof op !== "object") continue
            // track operation source file (may differ from path-level spec)
            let opSourceFile: string | undefined = undefined
            // resolve operation-level $ref at emit-time as well
            if (op.$ref && typeof op.$ref === "string") {
                const [filePart, fragPart] = op.$ref.split("#")
                const refFile = path.resolve(
                    path.dirname(specSourceFile || rootFilePath),
                    filePart,
                )
                const doc = loadAndParse(refFile)
                if (!fragPart) {
                    op = doc
                } else {
                    const parts = fragPart.replace(/^\//, "").split("/")
                    let cur: any = doc
                    for (const part of parts) {
                        if (cur === undefined) break
                        cur = cur[part]
                    }
                    op = cur || {}
                }
                opSourceFile = refFile
            }
            if (!op || typeof op !== "object") continue
            const methodCap =
                method[0].toUpperCase() + method.slice(1).toLowerCase()
            // determine which source file should be used as base when rendering $ref -> Components
            const baseForRender =
                opSourceFile || specSourceFile || path.resolve(rootFilePath)

            const endpointLines: string[] = []
            endpointLines.push(...header)
            endpointLines.push("import { z } from 'zod/v4';")

            const requestContent = op.requestBody?.content || {}
            const pickedRequestBody = op.requestBody
                ? pickContentSchemaWithType(requestContent, [
                      "application/json",
                      "multipart/form-data",
                      "application/x-www-form-urlencoded",
                      "*/*",
                  ])
                : undefined
            const hasMultipartRequestBody =
                pickedRequestBody?.mediaType === "multipart/form-data"
            if (hasMultipartRequestBody) {
                endpointLines.push("import { zfd } from 'zod-form-data';")
            }

            // determine output file path based on URL path: create a directory for the path
            // and emit a file per HTTP method (e.g. api/entry/post.ts)
            const outFile = path.join(
                outDir,
                convertPathToDir(p),
                `${method.toLowerCase()}.ts`,
            )
            const compFilePath = path.join(outDir, "components.ts")
            const relToComp =
                path.relative(path.dirname(outFile), compFilePath) || ""
            let importPath = relToComp.replace(/\\/g, "/")
            if (!importPath.startsWith(".")) importPath = "./" + importPath
            importPath = importPath.replace(/\.ts$/i, "")
            endpointLines.push(
                `import * as Components from '${importPath}';`,
                "",
            )

            // request body
            if (op.requestBody) {
                if (pickedRequestBody) {
                    const reqLine = hasMultipartRequestBody
                        ? renderMultipartRequestBodySchema(
                              pickedRequestBody.schema,
                              baseForRender,
                          )
                        : renderSchema(
                              pickedRequestBody.schema,
                              baseForRender,
                              true,
                          )
                    const constName = `RequestBodySchema`
                    endpointLines.push(
                        `export const ${constName} = ${reqLine};`,
                    )
                    const m = reqLine.match(/^Components\.(\w+)$/)
                    if (m) {
                        const compType = m[1].replace(/Schema$/, "") + "Type"
                        endpointLines.push(
                            `export type RequestBodyType = Components.${compType};`,
                        )
                    } else {
                        endpointLines.push(
                            `export type RequestBodyType = z.infer<typeof ${constName}>;`,
                        )
                    }
                }
            }

            // parameters
            if (Array.isArray(op.parameters) && op.parameters.length > 0) {
                const byIn: Record<string, any[]> = {}
                for (const p of op.parameters) {
                    const loc = p.in || "query"
                    byIn[loc] = byIn[loc] || []
                    byIn[loc].push(p)
                }
                for (const loc of Object.keys(byIn)) {
                    const params = byIn[loc]
                    const parts: string[] = []
                    for (const p of params) {
                        const s =
                            p.schema ||
                            (p.content &&
                                p.content["application/json"] &&
                                p.content["application/json"].schema) ||
                            {}
                        const expr = renderSchema(s, baseForRender, true)
                        const propExpr = p.required
                            ? expr
                            : `${expr}.optional()`
                        parts.push(`${JSON.stringify(p.name)}: ${propExpr}`)
                    }
                    // For headers, do not append .strict(), accept extra header keys
                    const schemaExpr =
                        `z.object({ ${parts.join(", ")} })` +
                        (loc === "header" ? "" : ".strict()")
                    const suffix =
                        loc === "path"
                            ? "PathParams"
                            : loc === "header"
                              ? "RequestHeader"
                              : loc.charAt(0).toUpperCase() +
                                loc.slice(1) +
                                "Params"
                    const constName = `${suffix}Schema`
                    endpointLines.push(
                        `export const ${constName} = ${schemaExpr};`,
                    )
                    endpointLines.push(
                        `export type ${suffix}Type = z.infer<typeof ${constName}>;`,
                    )
                }
            }

            // responses
            const responses = op.responses || {}
            for (const [status, resp] of Object.entries(responses)) {
                if (!resp || typeof resp !== "object") continue
                const content = (resp as any).content || {}
                const json = content["application/json"] || content["*/*"]
                if (json && json.schema) {
                    const respSchema = json.schema
                    const statusIdent = String(status)
                    const respLine = renderSchema(
                        respSchema,
                        baseForRender,
                        true,
                    )
                    const constName = `ResponseBody${statusIdent}Schema`
                    endpointLines.push(
                        `export const ${constName} = ${respLine};`,
                    )
                    const m = respLine.match(/^Components\.(\w+)$/)
                    if (m) {
                        const compType = m[1].replace(/Schema$/, "") + "Type"
                        endpointLines.push(
                            `export type ResponseBody${statusIdent}Type = Components.${compType};`,
                        )
                    } else {
                        endpointLines.push(
                            `export type ResponseBody${statusIdent}Type = z.infer<typeof ${constName}>;`,
                        )
                    }
                }
                if ((resp as any).headers) {
                    const parts: string[] = []
                    for (const [hname, hobj] of Object.entries(
                        (resp as any).headers,
                    )) {
                        const hs = (hobj as any).schema || {}
                        const expr = renderSchema(hs, baseForRender, true)
                        parts.push(
                            `${JSON.stringify(hname)}: ${expr}.optional()`,
                        )
                    }
                    if (parts.length > 0) {
                        const statusIdent = String(status)
                        const constName = `ResponseHeaders${statusIdent}Schema`
                        // Do not use .strict() for response headers
                        endpointLines.push(
                            `export const ${constName} = z.object({ ${parts.join(", ")} });`,
                        )
                        endpointLines.push(
                            `export type ResponseHeaders${statusIdent}Type = z.infer<typeof ${constName}>;`,
                        )
                    }
                }
            }

            const outDirForFile = path.dirname(outFile)
            if (!fs.existsSync(outDirForFile))
                fs.mkdirSync(outDirForFile, { recursive: true })
            // Write atomically: write to a temp file then rename to avoid partial files
            const tmpOut = outFile + ".tmp"
            fs.writeFileSync(tmpOut, endpointLines.join("\n") + "\n", "utf8")
            fs.renameSync(tmpOut, outFile)
            console.log("Wrote", outFile)
        }
    }

    const componentsPath = path.join(outDir, "components.ts")
    if (!fs.existsSync(path.dirname(componentsPath)))
        fs.mkdirSync(path.dirname(componentsPath), { recursive: true })
    // Write components atomically as well
    const tmpComp = componentsPath + ".tmp"
    fs.writeFileSync(tmpComp, compLines.join("\n") + "\n", "utf8")
    fs.renameSync(tmpComp, componentsPath)
    console.log("Wrote", componentsPath)
}

function convertPathToDir(p: string) {
    const segs = p
        .split("/")
        .filter(Boolean)
        .map(s => {
            if (s.startsWith("{") && s.endsWith("}"))
                return "_" + s.slice(1, -1)
            return s
        })
    if (segs.length === 0) return "."
    return path.join(...segs)
}

function convertPathToFile(p: string) {
    const segs = p
        .split("/")
        .filter(Boolean)
        .map(s => {
            if (s.startsWith("{") && s.endsWith("}"))
                return "_" + s.slice(1, -1)
            return s
        })
    if (segs.length === 0) return "index.ts"
    return path.join(...segs) + ".ts"
}

function main() {
    try {
        const { input, output } = parseArgs()
        const api = readOpenApi(input)
        generate(api, output, input)
    } catch (e: any) {
        console.error("Error:", e)
        process.exit(1)
    }
}

const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) main()
