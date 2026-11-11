#!/usr/bin/env node
/**
 * Zod API スキーマから OpenAPI 3.1 文書を組み立て、Orval のクライアント生成へ渡す。
 * CLI は文書を組み立てて検証し、ファイルには書き出さない。
 * 使い方: `npm run apigen:doc`
 */
import { fileURLToPath } from "url"
import { createDocument } from "zod-openapi"

import { paths } from "../../src/lib/api/schema/index"

export const buildOpenApiDocument = () =>
    createDocument({
        openapi: "3.1.0",
        info: {
            title: "skyshare lexicon wrapper",
            version: "2.0.0",
            description: "ATProto ClientをAstro SSGで利用するためのAPIラッパー",
        },
        paths,
    })

const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) {
    buildOpenApiDocument()
    console.log("OpenAPI ドキュメントを組み立てました（書き出しはしません）")
}
