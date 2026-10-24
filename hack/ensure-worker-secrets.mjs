// 配備の前後に、Worker が使うシークレット（SCHEDULE_ENC_KEY・OAUTH_CLIENT_KEY）が未登録なら生成して登録するスクリプト。
//
// 責務:
// - 配備先（`wrangler.jsonc` の name の Worker。`--develop` ではそのプレビューの基本設定も）に登録済みのシークレットの名前を調べ、
//   足りないものだけを生成して `wrangler secret put` で登録する
// - 登録済みの値は上書きしない（値は読み出せないため、確かめられるのは名前の有無だけ）
// - develop とプレビューの基本設定は同じ値にそろえる（D1 を共用し、プレビューで許可した予約も develop の Cron が更新するため）
//
// 片方にだけ登録済みのとき（値を写せないため、そろえ直すしかない）:
// - OAUTH_CLIENT_KEY: 作り直して両方へ登録する。古い鍵で得た予約の許可は、利用者が許可し直す
// - SCHEDULE_ENC_KEY: 作り直すと保管済みの認証情報が復号できなくなるため、登録せずに失敗で終える（手で対処する）
//
// 使い方: node hack/ensure-worker-secrets.mjs [--develop]（render-deploy-config.mjs の後に実行する）
// 生成した値は wrangler の標準入力にだけ渡し、標準出力・ログ・ファイルには出さない。
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { GENERATORS } from "./prepare-local-env.mjs"

/** 片方にだけ登録済みのとき、作り直して両方へ登録してよいシークレット */
const REGENERATABLE = new Set(["OAUTH_CLIENT_KEY"])

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
 * wrangler.jsonc（render-deploy-config.mjs の出力）から Worker 名を読む。最初の `"name"` が Worker 名である。
 */
export const readWorkerName = content => {
  const match = /"name"\s*:\s*"([^"]+)"/.exec(content)
  if (!match) throw new Error("wrangler.jsonc に name が見つかりません")
  return match[1]
}

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
  const worker = readWorkerName(readFileSync("wrangler.jsonc", "utf8"))
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
  if (errors.length > 0) {
    console.error(
      `::error::${errors.join(", ")} が ${targets.map(t => t.label(worker)).join(" と ")} の片方にだけ登録されています。` +
        "作り直すと保管済みのデータを復号できなくなるため自動では登録しません（DEVELOP.md の「予約投稿の初期設定」を参照）",
    )
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main()
}
