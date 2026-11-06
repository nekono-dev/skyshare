#!/usr/bin/env node
/**
 * `src/lib/api/schema/**` のZodスキーマからOpenAPI 3.1ドキュメントを組み立てる。
 *
 * 責務と処理概要:
 * - `buildOpenApiDocument()` は `config/orval.config.ts` からそのままimportされ、
 *   ファイル書き出しを経由せずインメモリのOpenAPIドキュメントオブジェクトとして
 *   orvalに渡される(フロントエンド用クライアント生成はここに依存する)。
 * - CLIとしても実行可能(`npm run apigen:doc`)。ドキュメントを組み立てられるかを検証するだけで、
 *   ファイルへは書き出さない(スキーマが不正なら `createDocument` が失敗する)。
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
