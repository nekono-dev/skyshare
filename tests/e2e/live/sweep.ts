/**
 * ライブテストの取りこぼし（`[e2e `形式の投稿とそのentry）を手動で掃除するコマンド。
 *
 * 使い方:
 * - `npm run e2e:live:sweep -- --dry-run`            削除せず対象の件数だけ表示する
 * - `npm run e2e:live:sweep -- --older-than-ms 0`    古さを問わず全て削除する
 * - 既定は1時間より古いものを削除する（実行中の別プロセスの投稿を消さないため）。
 * 認証情報は`SKYSHARE_E2E_IDENTIFIER`・`SKYSHARE_E2E_APP_PASSWORD`（`.env.e2e`可）。
 */
import { loadLiveAccount } from "./env"
import { createPdsAgent, DEFAULT_STALE_MS, sweepStale } from "./pds"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const i = args.indexOf("--older-than-ms")
const olderThanMs = i >= 0 ? Number(args[i + 1]) : DEFAULT_STALE_MS
if (!Number.isFinite(olderThanMs) || olderThanMs < 0) {
    console.error("--older-than-ms には0以上の数値を指定してください")
    process.exit(1)
}

const account = loadLiveAccount()
if (!account) {
    console.error("検証用アカウントの認証情報が未設定です")
    process.exit(1)
}

const agent = await createPdsAgent(account)
const result = await sweepStale(agent, { olderThanMs, dryRun })
console.log(
    `${dryRun ? "削除予定" : "削除"}: 投稿${result.posts}件・entry${result.entries}件`,
)
