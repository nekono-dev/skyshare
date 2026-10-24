/**
 * 実行中のビルドの運用者ごとの値。
 *
 * 責務と処理概要:
 * - ビルド時に埋め込まれた `PUBLIC_*` を `resolveSiteConfig` に渡し、アプリの全体が同じ値を参照する。
 * - コードに運用者固有の値を書かない。別の運用者は環境変数だけを変えて同じコードを配備できる。
 */
import { resolveSiteConfig, type SiteConfig } from "./siteEnv"

export type { SiteConfig }

/** 実行中のビルドの値。`PUBLIC_*` はビルド時に埋め込まれる */
export const siteConfig: SiteConfig = resolveSiteConfig(
    {
        PUBLIC_OPERATOR_NAME: import.meta.env.PUBLIC_OPERATOR_NAME,
        PUBLIC_OPERATOR_EMAIL: import.meta.env.PUBLIC_OPERATOR_EMAIL,
        PUBLIC_OPERATOR_BLUESKY_HANDLE: import.meta.env
            .PUBLIC_OPERATOR_BLUESKY_HANDLE,
        PUBLIC_PRIVACY_ENACTED_AT: import.meta.env.PUBLIC_PRIVACY_ENACTED_AT,
        PUBLIC_PRIVACY_REVISED_AT: import.meta.env.PUBLIC_PRIVACY_REVISED_AT,
        PUBLIC_GA_MEASUREMENT_ID: import.meta.env.PUBLIC_GA_MEASUREMENT_ID,
    },
    import.meta.env.DEV,
)
