// E2E（Playwright）を、dev サーバーの起動から後始末まで含めて実行する。
//
// 責務: コード生成と .dev.vars の準備をして `astro dev --background` で dev サーバーを常駐させ、
//       `playwright test` を実行し、自分が起動した場合に限り終了後に停止する。
// 使い方: npm run test:e2e [-- playwright の引数]
// 背景: astro dev は AI エージェント環境でのみ自動でバックグラウンド化し、通常の端末ではフォアグラウンドで
//       居座るため、`npm run dev && playwright test` では playwright に進めない。--background を明示して揃える。
//       既に dev サーバーが起動している場合はそれを使い、停止もしない。
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

const run = (cmd, args, options = {}) =>
  spawnSync(cmd, args, { stdio: "inherit", env: process.env, ...options })

const version = JSON.parse(readFileSync("package.json", "utf8")).version
const env = { ...process.env, PUBLIC_VERSION: version }

const mustSucceed = result => {
  if (result.status !== 0) process.exit(result.status ?? 1)
}

mustSucceed(run("npm", ["run", "build:pripare"]))
mustSucceed(run("npm", ["run", "setup:local"]))

// 起動済みかどうかは status の出力で判定する（未起動でも終了コードは 0 のため）
const status = spawnSync("npx", ["astro", "dev", "status"], {
  encoding: "utf8",
  env,
})
const alreadyRunning = `${status.stdout}`.includes("Dev server running")
if (!alreadyRunning) {
  mustSucceed(run("npx", ["astro", "dev", "--background"], { env }))
}

const result = run("npx", ["playwright", "test", ...process.argv.slice(2)])

if (!alreadyRunning) {
  run("npx", ["astro", "dev", "stop"], { env })
}
process.exit(result.status ?? 1)
