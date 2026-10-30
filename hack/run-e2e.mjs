// E2E（Playwright）を、dev サーバーの起動から後始末まで含めて実行する。
//
// 責務: コード生成と .dev.vars の準備をして `astro dev --background` で dev サーバーを常駐させ、
//       `playwright test` を実行し、自分が起動した場合に限り終了後に停止する。
//       自分で起動する場合は、起動の前に検証用の開催中のアンケート設定を生成し、終了後に元の環境変数での生成へ戻す
//       （検証用の設定の供給は hack/surveyE2eHarness.mjs）。
// 中断: SIGINT / SIGTERM / SIGHUP を受けたら、実行中の子のプロセスグループへ転送し、後始末をしてから
//       128 + シグナル番号で終了する（例: SIGINT は 130、SIGTERM は 143、SIGHUP は 129）。
//       後始末の途中で受けた中断は記録するだけで、後始末は最後まで行う（停止・復元の子は転送を受けない）。
//       後始末は終了の経路ごとに明示的に呼ぶ（exit イベントは SIGINT / SIGTERM では走らないため使わない）。
// 使い方: npm run test:e2e [-- playwright の引数]
// 背景: astro dev は AI エージェント環境でのみ自動でバックグラウンド化し、通常の端末ではフォアグラウンドで
//       居座るため、`npm run dev && playwright test` では playwright に進めない。--background を明示して揃える。
//       既に dev サーバーが起動している場合はそれを使い、停止もしない。設定の生成もしない。
import { spawn, spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import {
  envWithE2eSurveyConfig,
  exitCodeFor,
  readE2eSurveyConfig,
  shouldProvideSurveyConfig,
} from "./surveyE2eHarness.mjs"

const version = JSON.parse(readFileSync("package.json", "utf8")).version
const env = { ...process.env, PUBLIC_VERSION: version }

// 中断のシグナル。受けたら実行中の子のプロセスグループ全体へ転送し、後始末の後に終了する
const FORWARDED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"]
// 転送の後もこの時間内に終わらなければ、強制終了（SIGKILL）へ移る
const KILL_GRACE_MS = 10_000
let interruptedBy // 受けたシグナル名（後始末の途中で受けたものも含めて、最初の 1 件を残す）
let runningGroup // 実行中の子のプロセスグループ（後始末の子は含めない。子の先の子まで届けるため）
let killTimer

/** 実行中のプロセスグループへシグナルを送る。既に終わっていれば何もしない。 */
const signalRunningGroup = sig => {
  if (runningGroup === undefined) return
  try {
    process.kill(-runningGroup, sig)
  } catch {
    // 既に終了している
  }
}

for (const sig of FORWARDED_SIGNALS) {
  process.on(sig, () => {
    interruptedBy ??= sig
    // 後始末の最中は runningGroup が無いため転送しない（記録だけして後始末を続ける）
    signalRunningGroup(sig)
    if (runningGroup !== undefined && killTimer === undefined) {
      killTimer = setTimeout(() => signalRunningGroup("SIGKILL"), KILL_GRACE_MS)
    }
  })
}

/**
 * 子を非同期に実行し、終了を待つ。子は別のプロセスグループで動かし、シグナルはグループ全体へ転送する
 * （`npx` が Playwright を起動するため、子だけに送ると Playwright が残ってしまう）。
 *
 * Output: `{ status, signal }`。起動に失敗したときは status 1
 */
const runForwarding = (cmd, args, options = {}) =>
  new Promise(resolve => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: process.env,
      detached: true,
      ...options,
    })
    runningGroup = child.pid
    let settled = false
    const settle = result => {
      if (settled) return
      settled = true
      runningGroup = undefined
      clearTimeout(killTimer)
      killTimer = undefined
      resolve(result)
    }
    child.on("error", () => settle({ status: 1, signal: null }))
    // 直接の子が終わった時点で、中断を受けていれば残りのプロセスグループを強制終了する
    // （シグナルを無視する孫が残ると、stdio が閉じず待ち続けるため）。既に無ければ ESRCH は無視される
    child.on("exit", (status, signal) => {
      if (interruptedBy) signalRunningGroup("SIGKILL")
      settle({ status, signal })
    })
  })

/**
 * 後始末の子を非同期に実行し、終了を待つ。子は別のプロセスグループで動かすため、端末の Ctrl-C は届かない。
 * 転送もしない（後始末を最後まで行うため）。
 *
 * Output: `{ status }`。起動に失敗したときは status 1
 */
const runCleanupChild = (cmd, args) =>
  new Promise(resolve => {
    const child = spawn(cmd, args, { stdio: "inherit", env, detached: true })
    let settled = false
    const settle = result => {
      if (settled) return
      settled = true
      resolve(result)
    }
    child.on("error", () => settle({ status: 1 }))
    child.on("exit", status => settle({ status }))
  })

let serverStarted = false // 自分で dev サーバーを起動した（停止が要る）
let surveyConfigGenerated = false // 検証用の設定を生成した（元の環境変数で生成し直す）

/**
 * 後始末: 自分で起動した dev サーバーを止め、元の環境変数で生成し直す。
 * 中断を受けていても、両方とも最後まで行う。
 *
 * Output: 後始末が成功したか（復元に失敗したら false）
 */
const cleanup = async () => {
  let ok = true
  if (serverStarted) {
    serverStarted = false
    const stopped = await runCleanupChild("npx", ["astro", "dev", "stop"])
    if (stopped.status !== 0) {
      console.error(
        "dev サーバーの停止に失敗しました（npx astro dev stop を実行してください）",
      )
      ok = false
    }
  }
  if (surveyConfigGenerated) {
    surveyConfigGenerated = false
    const restored = await runCleanupChild("npm", ["run", "survey:render"])
    if (restored.status !== 0) {
      console.error(
        "survey config: 通常の状態への復元に失敗しました（npm run survey:render を実行してください）",
      )
      ok = false
    }
  }
  return ok
}

/** 後始末をしてから、記録された中断と後始末の結果に応じた終了コードで終了する。 */
const finish = async status => {
  const cleanupOk = await cleanup()
  process.exit(
    exitCodeFor({ status, interruptedBy, cleanupFailed: !cleanupOk }),
  )
}

/**
 * 準備の手順を実行する。失敗したとき、または中断を受けたときは後始末をして終了する。
 */
const runStep = async (cmd, args, options) => {
  if (interruptedBy) await finish(null)
  const result = await runForwarding(cmd, args, options)
  if (interruptedBy || result.status !== 0) await finish(result.status)
  return result
}

const main = async () => {
  await runStep("npm", ["run", "build:pripare"])
  await runStep("npm", ["run", "setup:local"])

  // 起動済みかどうかは status の出力で判定する（未起動でも終了コードは 0 のため）
  const status = spawnSync("npx", ["astro", "dev", "status"], {
    encoding: "utf8",
    env,
  })
  const alreadyRunning = `${status.stdout}`.includes("Dev server running")

  if (shouldProvideSurveyConfig(alreadyRunning)) {
    // 起動の前に生成する（astro.config.mjs は起動時に配信用の設定の有無を読むため）
    surveyConfigGenerated = true
    await runStep("npm", ["run", "survey:render"], {
      env: envWithE2eSurveyConfig(env, readE2eSurveyConfig()),
    })
  }
  if (!alreadyRunning) {
    serverStarted = true
    await runStep("npx", ["astro", "dev", "--background"], { env })
  }
  if (interruptedBy) await finish(null)

  const result = await runForwarding(
    "npx",
    ["playwright", "test", ...process.argv.slice(2)],
    { env },
  )
  await finish(result.status)
}

main().catch(async error => {
  console.error(error)
  await finish(1)
})
