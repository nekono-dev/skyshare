/** Zod から組み立てた OpenAPI 文書を入力に、フロントエンド用クライアントの生成設定を定義する。 */
import { defineConfig } from "orval"

import { buildOpenApiDocument } from "../scripts/build/build-openapi-document"

export default defineConfig({
    api: {
        input: {
            // zod-openapiの戻り値型は`openapi`フィールドが広いstring型のため、
            // orvalが期待するOpenAPIObject型とは構造的に非互換(値自体は正しい3.1文書)。
            target: buildOpenApiDocument() as unknown as Record<
                string,
                unknown
            >,
        },
        output: {
            target: "../src/client/openapi/client.ts",
            schemas: "../src/client/openapi/model",
            client: "fetch",
            mode: "single",
            clean: true,
            override: {
                formData: {
                    mutator: {
                        path: "../src/lib/codegen/openapiFormData.ts",
                        name: "customFormData",
                    },
                },
                mutator: {
                    path: "../src/lib/codegen/fetcher.ts",
                    name: "customFetcher",
                },
            },
        },
    },
})
