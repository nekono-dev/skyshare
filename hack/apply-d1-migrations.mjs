// D1 のマイグレーション（migrations/）を、指定したデータベースへ適用する。
//
// 責務:
// - 一時的な wrangler 設定を作り、`wrangler d1 migrations apply --remote` を実行する
//   （プレビュー用のデータベースは wrangler.jsonc のトップレベルのバインディングに無いため）。
//
// 使い方: node hack/apply-d1-migrations.mjs <database_name> <database_id>
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const [name, id] = process.argv.slice(2)
if (!name || !id || !/^[0-9a-f-]{36}$/.test(id)) {
  console.error(
    "使い方: node hack/apply-d1-migrations.mjs <database_name> <database_id>",
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
