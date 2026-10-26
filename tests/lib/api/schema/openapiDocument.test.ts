/**
 * OpenAPIドキュメントの組み立て（`hack/build-openapi-document.ts`、`src/lib/api/schema/index.ts`）のテスト。
 */
import { describe, expect, it } from "vitest"

import { buildOpenApiDocument } from "../../../../hack/build-openapi-document"
import { paths } from "@/lib/api/schema"

describe("buildOpenApiDocument", () => {
    it("[api-codegen/1.1] OpenAPI 3.1 のドキュメントに、登録したすべてのパスが含まれる", () => {
        const doc = buildOpenApiDocument()
        expect(doc.openapi).toBe("3.1.0")
        expect(Object.keys(doc.paths ?? {}).sort()).toEqual(
            Object.keys(paths).sort(),
        )
    })

    it("[api-codegen/1.2] 登録したパスは、すべて末尾がスラッシュで、各操作に識別子がある", () => {
        for (const [path, item] of Object.entries(paths)) {
            expect(path.endsWith("/")).toBe(true)
            for (const operation of Object.values(item ?? {})) {
                expect(
                    (operation as { operationId?: string }).operationId,
                ).toBeTruthy()
            }
        }
    })
})
