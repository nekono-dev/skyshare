import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import Spinner from "@/components/common/Spinner"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * 汎用ローディング表示コンポーネント。
 *
 * 責務と処理概要:
 * - インライン表示と全画面オーバーレイ表示を切り替える。
 * - 読み上げ補助のため `role="status"` と `aria-live` を設定する。
 */

type Props = {
  /** 表示メッセージ（翻訳済みの文字列） */
  message?: string
  /** 表示メッセージの文言キー。Astro のページから island に渡す場合のように、翻訳済み文字列を渡せないときに使う。`message` が優先される */
  messageKey?: PlainMessageKey
  overlay?: boolean
}

/**
 * ローディング UI を表示する。
 *
 * Input:
 * - `message`: 表示メッセージ（翻訳済み）
 * - `messageKey`: 表示メッセージの文言キー（`message` 省略時に使用。両方省略時は「処理中...」）
 * - `overlay`: `true` の場合は全画面オーバーレイで表示
 *
 * Output:
 * - ローディング表示用 JSX
 *
 * 例:
 * - 入力: `{ message: "保存中...", overlay: true }`
 * - 出力: 背景を覆うスピナー表示
 */
export const Component = ({ message, messageKey, overlay = false }: Props) => {
  const { t } = useT()
  const text = message ?? t(messageKey ?? "common.processing")
  if (overlay) {
    return (
      <div className={styles.overlay} role="status" aria-live="polite">
        <div className={`${ui["base-card"]} ${styles.panel}`}>
          <Spinner />
          <p className={styles.message}>{text}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.inline} role="status" aria-live="polite">
      <Spinner />
      <p className={styles.message}>{text}</p>
    </div>
  )
}

export default Component
