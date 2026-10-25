/**
 * 実行中のビルドの版・コミット・リポジトリ。
 *
 * 責務と処理概要:
 * - `astro.config.mjs` がビルドの時点で埋め込んだ値（`PUBLIC_VERSION`・`PUBLIC_COMMIT_SHA`・
 *   `PUBLIC_SOURCE_REPOSITORY`）を、画面とサーバーの両方に同じ形で渡す。
 * - 未設定の値（単体テストなど）は "unknown"・null として扱う。
 */
import type { BuildInfo } from "./buildEnv"

export type { BuildInfo }

/** 空文字を null にそろえる（埋め込みが空文字のときも不明として扱うため） */
const orNull = (value: string | undefined): string | null =>
    value ? value : null

/** 実行中のビルドの値。値はビルド時に埋め込まれる */
export const buildInfo: BuildInfo = {
    version: import.meta.env.PUBLIC_VERSION || "unknown",
    commit: orNull(import.meta.env.PUBLIC_COMMIT_SHA),
    repository: orNull(import.meta.env.PUBLIC_SOURCE_REPOSITORY),
}
