// D1 のマイグレーション（migrations/）を、プレビュー用のデータベースへ適用する。
//
// 責務:
// - 一時的な wrangler 設定を作り、`wrangler d1 migrations apply --remote` を実行する
//   （プレビュー用のデータベースは wrangler.jsonc のトップレベルのバインディングに無いため）。
// - 対象のデータベースは、ビルド結果の設定（dist/server/wrangler.json）の previews から読む
//   （運用者ごとの値をワークフローに書かないため。値は hack/render-deploy-config.mjs が環境変数から入れる）。
//
// 使い方: node hack/apply-d1-migrations.mjs（npm run build の後に実行する）
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const built = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"))
const target = built.previews?.d1_databases?.find(d => d.binding === "DB")
const name = target?.database_name
const id = target?.database_id
if (!name || !id || !/^[0-9a-f-]{36}$/.test(id)) {
  console.error(
    "dist/server/wrangler.json の previews に D1（DB）が見つかりません。先に npm run build を実行してください",
  )
  process.exit(1)
}
const dir = mkdtempSync(join(tmpdir(), "d1-migrate-"))
const config = join(dir, "wrangler.jsonc")
writeFileSync(
  config,
  JSON.stringify({
    name: "skyshare-migrate",
    compatibility_date: "2026-10-08",
    d1_databases: [
      {
        binding: "DB",
        database_name: name,
        database_id: id,
        migrations_dir: resolve("migrations"),
      },
    ],
  }),
)
execFileSync(
  "npx",
  ["wrangler", "d1", "migrations", "apply", "DB", "--remote", "-c", config],
  { stdio: "inherit" },
)
