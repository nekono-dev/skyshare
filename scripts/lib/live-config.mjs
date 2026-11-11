/**
 * `tests/live/` と `tests/unit/scripts/liveConfig.test.ts` が使う Bluesky live テスト設定を読む。
 * 秘密値をエラーに含めず、設定不足はテストをスキップする理由として返す。
 */
import { existsSync, readFileSync } from "node:fs"
import { parseDotenv } from "./dotenv.mjs"

/** PDS の既定の接続先（config/live.json で省略したときに使う） */
export const DEFAULT_SERVICE = "https://bsky.social"

/**
 * 公開の AppView（認証なしで app.bsky.* を読める）。PDS は app.bsky を認証付きで中継するため、プロフィールの取得はこちらに送る。
 */
export const PUBLIC_APPVIEW = "https://public.api.bsky.app"

/**
 * live テストの設定を読む。
 *
 * Input: `configPath`（config/live.json）、`devVarsPath`（.dev.vars）
 * Output: 揃っているとき `{ identifier, service, appPassword }`。揃っていないとき `{ skip: "理由" }`
 * 失敗: 形式が不正なとき Error（項目名だけを示す）
 */
export const readLiveConfig = ({ configPath, devVarsPath }) => {
  if (!existsSync(configPath)) {
    return {
      skip: "config/live.json がありません（config/live.example.json をコピーして作成する）",
    }
  }
  let config
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"))
  } catch {
    throw new Error("config/live.json を JSON として読めません")
  }
  if (
    typeof config.identifier !== "string" ||
    config.identifier.trim() === ""
  ) {
    throw new Error(
      "config/live.json に identifier（検証用アカウントのハンドル）がありません",
    )
  }
  if (config.service !== undefined && typeof config.service !== "string") {
    throw new Error("config/live.json の service は文字列で指定してください")
  }
  const devVars = existsSync(devVarsPath)
    ? parseDotenv(readFileSync(devVarsPath, "utf8"))
    : {}
  const appPassword = (devVars.SKYSHARE_E2E_APP_PASSWORD ?? "").trim()
  if (appPassword === "") {
    return { skip: ".dev.vars に SKYSHARE_E2E_APP_PASSWORD がありません" }
  }
  return {
    identifier: config.identifier.trim(),
    service: (config.service ?? DEFAULT_SERVICE).replace(/\/+$/, ""),
    appPassword,
  }
}

/**
 * セッション作成の応答（com.atproto.server.createSession）が、設定のハンドルと一致するかを確かめる。
 *
 * Input: `session`（応答の本文）、`identifier`（設定のハンドル）
 * Output: 食い違った項目名の配列（一致なら空）
 */
export const sessionMismatches = (session, identifier) => {
  const problems = []
  if (typeof session?.did !== "string" || !session.did.startsWith("did:"))
    problems.push("did")
  if (session?.handle !== identifier) problems.push("handle")
  return problems
}
