/**
 * ライブテスト（実アカウントE2E）用の検証アカウント認証情報の読み込み。
 *
 * 責務と処理概要:
 * - 環境変数（またはリポジトリ直下の`.env.e2e`）から検証用アカウントの認証情報を読む。
 * - 必須の2値が揃わない場合は`null`を返し、呼び出し側（`playwright.config.ts`）が
 *   ライブテストのprojectごと無効化する（`specs/e2elive/design.md §2・§3`）。
 * - 認証情報の値は、ログ・エラーメッセージのいずれにも出力しない。
 */
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

export type LiveAccount = {
    /** ハンドルまたはメールアドレス */
    identifier: string
    /** アプリパスワード */
    password: string
    /** PDSのURL */
    service: string
}

/** ログイン済みブラウザ状態（storageState）の保存先 */
export const LIVE_STORAGE_STATE = path.resolve(
    here,
    "../../../playwright/.auth/live.json",
)

const ENV_FILE = path.resolve(here, "../../../.env.e2e")

/**
 * 検証用アカウントの認証情報を読み込む。
 *
 * Input:
 * - 環境変数`SKYSHARE_E2E_IDENTIFIER`・`SKYSHARE_E2E_APP_PASSWORD`（必須）、
 *   `SKYSHARE_E2E_SERVICE`（任意、既定`https://bsky.social`）。
 *   `.env.e2e`があれば読み込む（プロセス環境の値が優先される）。
 *
 * Output:
 * - 認証情報。必須値が空・未設定なら`null`。
 *
 * Example:
 * - `SKYSHARE_E2E_IDENTIFIER=a.bsky.social SKYSHARE_E2E_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx`
 *   → `{ identifier: "a.bsky.social", password: "xxxx-...", service: "https://bsky.social" }`
 */
export const loadLiveAccount = (
    env: NodeJS.ProcessEnv = process.env,
): LiveAccount | null => {
    if (env === process.env && existsSync(ENV_FILE)) {
        process.loadEnvFile(ENV_FILE)
    }
    const identifier = env.SKYSHARE_E2E_IDENTIFIER?.trim()
    const password = env.SKYSHARE_E2E_APP_PASSWORD?.trim()
    if (!identifier || !password) return null
    return {
        identifier,
        password,
        service: env.SKYSHARE_E2E_SERVICE?.trim() || "https://bsky.social",
    }
}

/**
 * 第三者アカウント（第三者の返信のテスト用、任意）の認証情報を読み込む。
 *
 * Input: 環境変数`SKYSHARE_E2E_PEER_IDENTIFIER`・`SKYSHARE_E2E_PEER_APP_PASSWORD`（必須）、
 *   `SKYSHARE_E2E_SERVICE`（任意）
 * Output: 認証情報。どちらかが無ければ`null`（このアカウントを要するテストはスキップする）
 */
export const loadPeerAccount = (
    env: NodeJS.ProcessEnv = process.env,
): LiveAccount | null => {
    loadLiveAccount(env)
    const identifier = env.SKYSHARE_E2E_PEER_IDENTIFIER?.trim()
    const password = env.SKYSHARE_E2E_PEER_APP_PASSWORD?.trim()
    if (!identifier || !password) return null
    return {
        identifier,
        password,
        service: env.SKYSHARE_E2E_SERVICE?.trim() || "https://bsky.social",
    }
}
