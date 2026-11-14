/**
 * 運用者情報とアクセス解析設定を検証し、サイト設定に解決する。
 *
 * - 本番では必須値と形式を検査し、開発時は未設定の必須値をダミー値で補う。
 * - `astro.config.mjs`（Node）からも使うため、`import.meta.env` に依存せず環境値を引数で受け取る。
 */

export type SiteConfig = {
    operator: {
        /** 運営者の名称（個人の場合は活動名でよい。氏名と住所は請求に応じて回答する） */
        name: string
        /** 問い合わせ窓口のメールアドレス */
        email: string
        /** 問い合わせ窓口の Bluesky のハンドル（@ なし）。未設定なら窓口はメールだけ */
        blueskyHandle: string | null
    }
    privacy: {
        /** 最終改定日（YYYY-MM-DD） */
        revisedAt: string
    }
    /** Google アナリティクスの測定 ID（G-XXXX）。未設定ならタグを出さず、ポリシーにも記載しない */
    analyticsId: string | null
}

type Env = Record<string, string | boolean | undefined>

/** 本番ビルドで必須の環境変数 */
const REQUIRED = [
    "SITE_HOST",
    "PUBLIC_OPERATOR_NAME",
    "PUBLIC_OPERATOR_EMAIL",
    "PUBLIC_PRIVACY_REVISED_AT",
] as const

const HOST = /^[a-z0-9.-]+$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HANDLE = /^[a-z0-9.-]+\.[a-z]{2,}$/i
const ANALYTICS_ID = /^G-[A-Z0-9]+$/

const DEV_DEFAULTS = {
    PUBLIC_OPERATOR_NAME: "example-operator",
    PUBLIC_OPERATOR_EMAIL: "operator@example.com",
    PUBLIC_PRIVACY_REVISED_AT: "2000-01-01",
} as const

const read = (env: Env, name: string): string => {
    const value = env[name]
    return typeof value === "string" ? value.trim() : ""
}

/**
 * 本番ビルドの環境変数を検査し、問題の一覧を返す。
 *
 * Input:
 * - `env`: 環境変数（`process.env` など）
 *
 * Output:
 * - 問題の説明の配列。問題がなければ空配列
 *
 * 例:
 * - 入力: `{}` → 出力: `["SITE_HOST が未設定です", ...]`
 */
export const checkSiteEnv = (env: Env): string[] => {
    const problems: string[] = []
    for (const name of REQUIRED) {
        if (read(env, name) === "") problems.push(`${name} が未設定です`)
    }
    const formats: [string, RegExp, string][] = [
        ["SITE_HOST", HOST, "ドメイン名だけ（例: example.com）"],
        ["PUBLIC_OPERATOR_EMAIL", EMAIL, "メールアドレス"],
        ["PUBLIC_OPERATOR_BLUESKY_HANDLE", HANDLE, "ハンドル（@ なし）"],
        ["PUBLIC_PRIVACY_REVISED_AT", DATE, "YYYY-MM-DD"],
        ["PUBLIC_GA_MEASUREMENT_ID", ANALYTICS_ID, "G-XXXX"],
    ]
    for (const [name, pattern, expected] of formats) {
        const value = read(env, name)
        if (value !== "" && !pattern.test(value)) {
            problems.push(`${name} の形式が正しくありません（${expected}）`)
        }
    }
    return problems
}

/**
 * 環境変数から運用者ごとの値を解決する。
 *
 * Input:
 * - `env`: 環境変数（`import.meta.env` など）
 * - `dev`: 開発時なら true。未設定の必須値をダミー値で補う
 *
 * Output:
 * - 解決した値。任意の値が未設定・形式違いなら null
 */
export const resolveSiteConfig = (env: Env, dev: boolean): SiteConfig => {
    const get = (name: keyof typeof DEV_DEFAULTS) =>
        read(env, name) || (dev ? DEV_DEFAULTS[name] : "")
    const optional = (name: string, pattern: RegExp) => {
        const value = read(env, name)
        return pattern.test(value) ? value : null
    }
    return {
        operator: {
            name: get("PUBLIC_OPERATOR_NAME"),
            email: get("PUBLIC_OPERATOR_EMAIL"),
            blueskyHandle: optional("PUBLIC_OPERATOR_BLUESKY_HANDLE", HANDLE),
        },
        privacy: {
            revisedAt: get("PUBLIC_PRIVACY_REVISED_AT"),
        },
        analyticsId: optional("PUBLIC_GA_MEASUREMENT_ID", ANALYTICS_ID),
    }
}

/**
 * 公開するサイトの URL を決める。
 *
 * Input:
 * - `env`: 環境変数（`SITE_HOST` を読む）
 *
 * Output:
 * - `https://<SITE_HOST>`。未設定なら開発サーバーのアドレス
 *
 * 例:
 * - 入力: `{ SITE_HOST: "s.example.com" }` → 出力: `"https://s.example.com"`
 */
export const siteUrl = (env: Env): string =>
    `https://${read(env, "SITE_HOST") || "localhost:4321"}`
