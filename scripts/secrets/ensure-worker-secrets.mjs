/** Worker と Preview に必要なシークレットを確認し、不足分を生成して登録する。
 * 値は読み出せないため登録済みの値を上書きせず、生成値はログやファイルに出さない。
 * 使い方: node scripts/secrets/ensure-worker-secrets.mjs [--develop [--preview <名前>]]（render-deploy-config.mjs の後に実行）
 */
// develop と Preview は D1 を共有し、Preview で許可した予約も develop の Cron が更新するため同じ値を使う。
// 既存 Preview は作成時の秘密情報を保持し、後から追加した値は届かない。欠落時は削除後に同じ名前で作り直す。
// 暗号鍵や回答照合鍵の再生成は保存済みデータを使えなくするため、自動修復せず失敗させる。
// OAuth 鍵の再生成では、古い鍵で得た利用者の許可を再取得する必要がある。
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { workerNameFrom } from "../lib/wrangler.mjs"
import { GENERATORS } from "./generators.mjs"

/** 片方にだけ登録済みのとき、作り直して両方へ登録してよいシークレット */
export const REGENERATABLE = new Set(["OAUTH_CLIENT_KEY"])

/**
 * 登録の計画を立てる。
 *
 * Input:
 * - `names`: 必要なシークレットの名前の配列
 * - `present`: 配信先ごとの登録済みの名前の集合の配列（同じ値にそろえる配信先の並び）
 * - `regeneratable`: 片方にだけあるとき作り直してよい名前の集合
 *
 * Output:
 * - `writes`: `{ name, targets }`（targets は登録する配信先の添字）の配列
 * - `errors`: 自動では直せない名前の配列
 *
 * 例:
 * - 入力: names=["A"], present=[Set(), Set()] → 出力: writes=[{ name: "A", targets: [0, 1] }]
 * - 入力: names=["A"], present=[Set(["A"]), Set()]、A が作り直し不可 → 出力: errors=["A"]
 */
export const planSecretWrites = (names, present, regeneratable) => {
  const writes = []
  const errors = []
  for (const name of names) {
    const missing = present.flatMap((set, i) => (set.has(name) ? [] : [i]))
    if (missing.length === 0) continue
    if (missing.length === present.length) {
      writes.push({ name, targets: missing })
    } else if (regeneratable.has(name)) {
      writes.push({ name, targets: present.map((_, i) => i) })
    } else {
      errors.push(name)
    }
  }
  return { writes, errors }
}

/**
 * Preview に欠けている、必要なシークレットの名前を返す。
 *
 * Input:
 * - `names`: 必要なシークレットの名前の配列
 * - `preview`: Preview の登録済みの名前の集合。Preview がまだ無ければ null
 *
 * Output: 欠けている名前の配列（Preview が無ければ空。作るときに基本設定から全部入るため）
 *
 * 例: `missingInPreview(["A", "B"], new Set(["A"]))` → `["B"]`
 */
export const missingInPreview = (names, preview) =>
  preview ? names.filter(name => !preview.has(name)) : []

/** wrangler を実行する。失敗したら標準エラーを添えて例外にする（標準出力は秘密を含まないものだけ返す） */
const wrangler = (args, input) => {
  const res = spawnSync("npx", ["wrangler", ...args], {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  })
  if (res.status !== 0) {
    throw new Error(
      `wrangler ${args.slice(0, 3).join(" ")} が失敗しました: ${res.stderr}`,
    )
  }
  return res.stdout
}

/** wrangler を実行し、終了コードと出力をそのまま返す（失敗を呼び出し側で判断するとき） */
const tryWrangler = args =>
  spawnSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

/**
 * Preview に必要なシークレットが欠けていれば、Preview を削除する。
 *
 * 失敗時の方針: Preview が無い（"not found"）なら何もしない。それ以外の一覧の失敗は例外にする。
 */
const recreatePreviewIfStale = (worker, previewName, names) => {
  const res = tryWrangler([
    "preview",
    "secret",
    "list",
    "--name",
    previewName,
    "--worker-name",
    worker,
    "--json",
  ])
  if (res.status !== 0 && /not found/i.test(res.stderr)) return
  if (res.status !== 0) {
    throw new Error(
      `Preview ${previewName} のシークレットを読めません: ${res.stderr}`,
    )
  }
  const missing = missingInPreview(
    names,
    new Set(JSON.parse(res.stdout).map(s => s.name)),
  )
  if (missing.length === 0) return
  wrangler([
    "preview",
    "delete",
    "--name",
    previewName,
    "--worker-name",
    worker,
    "-y",
  ])
  console.log(
    `Preview ${previewName} に ${missing.join(", ")} が無いため削除しました（この後の配備で基本設定から作り直します）`,
  )
}

/** 配信先ごとの、一覧と登録の wrangler の引数 */
const TARGET_KINDS = {
  worker: {
    list: worker => ["secret", "list", "--name", worker, "--format", "json"],
    put: (worker, name) => ["secret", "put", name, "--name", worker],
    label: worker => `Worker ${worker}`,
  },
  previewBase: {
    list: worker => [
      "preview",
      "base-config",
      "secret",
      "list",
      "--worker-name",
      worker,
      "--json",
    ],
    put: (worker, name) => [
      "preview",
      "base-config",
      "secret",
      "put",
      name,
      "--worker-name",
      worker,
    ],
    label: worker => `${worker} のプレビューの基本設定`,
  },
}

const main = async () => {
  const worker = workerNameFrom(readFileSync("wrangler.jsonc", "utf8"))
  const kinds = process.argv.includes("--develop")
    ? ["worker", "previewBase"]
    : ["worker"]
  const targets = kinds.map(kind => TARGET_KINDS[kind])
  const present = targets.map(
    t => new Set(JSON.parse(wrangler(t.list(worker))).map(s => s.name)),
  )
  const { writes, errors } = planSecretWrites(
    Object.keys(GENERATORS),
    present,
    REGENERATABLE,
  )

  for (const { name, targets: indexes } of writes) {
    const value = await GENERATORS[name]()
    for (const i of indexes) {
      wrangler(targets[i].put(worker, name), value)
      console.log(
        `${name} を生成して ${targets[i].label(worker)} に登録しました`,
      )
    }
  }
  if (writes.length === 0 && errors.length === 0) {
    console.log("シークレットはすべて登録済みです")
  }
  const previewIndex = process.argv.indexOf("--preview")
  if (
    previewIndex >= 0 &&
    kinds.includes("previewBase") &&
    errors.length === 0
  ) {
    const previewName = process.argv[previewIndex + 1]
    if (!previewName) throw new Error("--preview に Preview の名前が必要です")
    recreatePreviewIfStale(worker, previewName, Object.keys(GENERATORS))
  }
  if (errors.length > 0) {
    console.error(
      `::error::${errors.join(", ")} が ${targets.map(t => t.label(worker)).join(" と ")} の片方にだけ登録されています。` +
        "作り直すと保管済みのデータを復号できなくなる、または回答済みの記録と一致しなくなるため自動では登録しません（docs/DEVELOP.md の「予約投稿の初期設定」を参照）",
    )
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main()
}
