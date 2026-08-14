/**
 * ボタン選択式ダイアログの共通コンポーネント。
 *
 * 責務と処理概要:
 * - Overlay 上に baseCard を重ね、`role="dialog"` の選択肢ダイアログを描画する。
 * - DraftSaveConfirmDialog（3択）や ShareDialog（2択）など、
 *   選択肢ボタンの縦並びだけで構成されるダイアログの共通骨格を提供する。
 */
import React from "react"
import Loading from "@/components/Loading"
import Overlay from "@/components/Overlay"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

export type DialogButtonVariant = "blue" | "gray" | "red" | "black"

export type DialogButton = {
  key: string
  label: string
  variant: DialogButtonVariant
  onClick: () => void | Promise<void>
  disabled?: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  ariaLabel: string
  buttons: DialogButton[]
  loading?: { message: string }
}

const variantClassName: Record<DialogButtonVariant, string> = {
  blue: ui.blueButton,
  gray: ui.grayButton,
  red: ui.redButton,
  black: ui.blackButton,
}

/**
 * 選択肢ボタン付きダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `onClose`: 背景クリック時のコールバック
 * - `ariaLabel`: ダイアログの `aria-label`
 * - `buttons`: 縦並びで表示する選択肢ボタンの定義一覧
 * - `loading`: 指定時、カード内にローディングオーバーレイを表示する
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、`buttons` の順に並んだ選択肢ダイアログ
 *
 * 例:
 * - 入力: `{ open: true, ariaLabel: "確認", buttons: [{ key: "ok", label: "OK", variant: "blue", onClick }] }`
 * - 出力: 「OK」ボタン付きの確認ダイアログ
 */
export const Component: React.FC<Props> = ({
  open,
  onClose,
  ariaLabel,
  buttons,
  loading,
}) => {
  return (
    <Overlay open={open} onClose={onClose} contentClassName={styles.dialogOverlay}>
      <div className={`${ui.baseCard} ${styles.dialogCard}`} role="dialog" aria-label={ariaLabel}>
        {loading && <Loading overlay message={loading.message} />}
        <div className={styles.dialogActions}>
          {buttons.map((button) => (
            <button
              key={button.key}
              type="button"
              className={`${ui.baseButton} ${ui.textButton} ${variantClassName[button.variant]}`}
              disabled={button.disabled}
              onClick={() => {
                void button.onClick()
              }}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  )
}

export default Component
