#!/usr/bin/env node
/**
 * `src/lib/api/schema/**` のZodスキーマからOpenAPI 3.1ドキュメントを組み立てる。
 *
 * 責務と処理概要:
 * - `buildOpenApiDocument()` は `orval.config.ts` からそのままimportされ、
 *   ファイル書き出しを経由せずインメモリのOpenAPIドキュメントオブジェクトとして
 *   orvalに渡される(フロントエンド用クライアント生成はここに依存する)。
 * - CLIとしても実行可能(`npm run apigen:doc`)。`openapi/generated.json` に
 *   スナップショットを書き出す(レビュー・デバッグ用、gitignore対象でコミットはしない)。
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createDocument } from "zod-openapi"

import { paths } from "../src/lib/api/schema/index"

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
    const document = buildOpenApiDocument()
    const outputPath = path.resolve(
        path.dirname(__filename),
        "../openapi/generated.json",
    )
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(
        outputPath,
        JSON.stringify(document, null, 2) + "\n",
        "utf8",
    )
    console.log("Wrote", outputPath)
}
