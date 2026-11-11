/** Playwright E2E と開発サーバーの起動・後始末を実行する。
 * 自分でサーバーを起動する場合だけ検証設定を先に用意し、終了後に開発設定へ戻す。
 * 既に稼働中の開発サーバーは再利用し、停止や設定変更をしない。
 * 使い方: npm run test:e2e [-- playwright の引数]
 * astro dev の常駐動作を揃えるため、起動には `--background` を指定する。
 */
import { spawn, spawnSync } from "node:child_process"
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import {
  envWithE2eSurveyConfig,
  exitCodeFor,
  readE2eSurveyConfig,
  shouldProvideSurveyConfig,
} from "./survey-e2e-harness.mjs"
import { renderWranglerFile } from "../config/render-wrangler.mjs"

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

// 偽の Bluesky は dev サーバーより先に起動し、接続先の環境変数で向ける
const FAKE_PORT = Number(process.env.E2E_FAKE_BLUESKY_PORT ?? "9311")
const FAKE_ORIGIN = `http://127.0.0.1:${FAKE_PORT}`
const endpointEnv = {
  ...env,
  E2E_FAKE_BLUESKY_ORIGIN: FAKE_ORIGIN,
}
let fakeChild // 自分で起動した偽の Bluesky（停止が要る）

/** 偽の Bluesky を別のプロセスグループで起動し、応答するまで待つ。 */
const startFakeBluesky = async () => {
  fakeChild = spawn("npx", ["tsx", "tests/support/fakeBluesky/serve.ts"], {
    stdio: "inherit",
    env: endpointEnv,
    detached: true,
  })
  fakeChild.on("exit", () => {
    fakeChild = undefined
  })
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(
        `${FAKE_ORIGIN}/.well-known/oauth-authorization-server`,
      )
      if (res.ok) return
    } catch {
      // まだ起動していない
    }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error("偽の Bluesky が起動しませんでした")
}

/** 偽の Bluesky を止める（起動していなければ何もしない）。 */
const stopFakeBluesky = async () => {
  if (fakeChild === undefined) return true
  const pid = fakeChild.pid
  try {
    process.kill(-pid, "SIGTERM")
  } catch {
    // 既に終了している
  }
  for (let i = 0; i < 20 && fakeChild !== undefined; i++) {
    await new Promise(r => setTimeout(r, 200))
  }
  return fakeChild === undefined
}

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
  if (!(await stopFakeBluesky())) {
    console.error(
      "偽の Bluesky の停止に失敗しました（残っているプロセスを確認してください）",
    )
    ok = false
  }
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
  restoreDevelopWrangler()
  return ok
}

/**
 * E2E の設定（config/e2e.json）を、偽の Bluesky の接続先で作り、wrangler.jsonc を生成する。
 * 運用者の値などは config/develop.example.json のものを使い、接続先だけを偽の Bluesky に向ける（config/e2e.json は実行のたびに作り直す）。
 */
const writeE2eWrangler = () => {
  if (!existsSync("config/develop.example.json")) {
    console.error("config/develop.example.json がありません")
    process.exit(1)
  }
  const config = JSON.parse(readFileSync("config/develop.example.json", "utf8"))
  for (const key of [
    "PUBLIC_DEFAULT_ATP_SERVICE",
    "PUBLIC_PLC_DIRECTORY_BASE_URL",
    "PUBLIC_BSKY_AUTH_SERVER_URL",
  ]) {
    config.vars[key] = FAKE_ORIGIN
  }
  writeFileSync("config/e2e.json", `${JSON.stringify(config, null, 2)}\n`)
  try {
    renderWranglerFile({ name: "e2e" })
  } catch (err) {
    console.error(
      `wrangler.jsonc（E2E 用）の生成に失敗しました: ${err.message}`,
    )
    process.exit(1)
  }
}

/**
 * E2E 用の接続先を残さないよう、開発設定から wrangler.jsonc を復元する。
 * E2E 設定を先に適用するため、復元は検証終了後に行う。
 * 開発の設定が無ければ例から作る。
 */
const restoreDevelopWrangler = () => {
  if (!existsSync("config/develop.json"))
    copyFileSync("config/develop.example.json", "config/develop.json")
  try {
    renderWranglerFile({ name: "develop" })
  } catch (err) {
    // 後始末の一部のため、失敗しても終了はしない（接続先の残留は確認できるよう表示する）
    console.error(
      `wrangler.jsonc（開発用）の生成に失敗しました: ${err.message}`,
    )
  }
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
  await runStep("npm", ["run", "build:prepare"])
  await runStep("npm", ["run", "setup:local"])

  // 起動済みかどうかは status の出力で判定する（未起動でも終了コードは 0 のため）
  const status = spawnSync("npx", ["astro", "dev", "status"], {
    encoding: "utf8",
    env,
  })
  const alreadyRunning = `${status.stdout}`.includes("Dev server running")
  if (alreadyRunning) {
    // 起動済みの dev サーバーは偽の Bluesky の接続先を反映できない（10.3）
    console.error(
      "dev サーバーが起動済みのため、偽の Bluesky へ接続できません。npx astro dev stop で止めてから実行してください。",
    )
    await finish(1)
  }
  await startFakeBluesky()
  if (interruptedBy) await finish(null)

  if (shouldProvideSurveyConfig(alreadyRunning)) {
    // 起動の前に生成する（astro.config.mjs は起動時に配信用の設定の有無を読むため）
    surveyConfigGenerated = true
    await runStep("npm", ["run", "survey:render"], {
      env: envWithE2eSurveyConfig(endpointEnv, readE2eSurveyConfig()),
    })
  }
  if (!alreadyRunning) {
    serverStarted = true
    // 接続先は wrangler.jsonc の vars（config/e2e.json から生成）で偽の Bluesky へ向ける
    writeE2eWrangler()
    // ローカルの D1 にスキーマを適用する。CI は毎回空の D1 から始まり、未適用だと予約・アンケートの API が 500 になる
    await runStep("npx", [
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
    ])
    await runStep("npx", ["astro", "dev", "--background"], { env: endpointEnv })
  }
  if (interruptedBy) await finish(null)

  const result = await runForwarding(
    "npx",
    [
      "playwright",
      "test",
      "-c",
      "config/test/playwright.config.ts",
      ...process.argv.slice(2),
    ],
    { env: endpointEnv },
  )
  await finish(result.status)
}

main().catch(async error => {
  console.error(error)
  await finish(1)
})
