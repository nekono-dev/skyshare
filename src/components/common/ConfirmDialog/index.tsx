/**
 * タイトル・本文メッセージ・確定/キャンセルボタンを持つ汎用確認ダイアログ。
 *
 * 責務と処理概要:
 * - `ChoiceDialog`はボタン列挙のみを責務とし、ユーザ向けの警告文（本文メッセージ）を
 *   表示する仕組みを持たない。取り消し不能な操作の最終確認など、理由を明示する文章が
 *   必要な場面のために、`Overlay`を直接使い本文メッセージ付きの確認ダイアログとして
 *   独立に実装する（`ChoiceDialog`の継承・多段化はしない）。
 * - ボタンの配色は`ChoiceDialog`が定義する`DialogButtonVariant`型・`variantClassName`を
 *   再利用し、アプリ全体のボタン配色と一貫させる。
 */
import React from "react"
import Loading from "@/components/common/Loading"
import Overlay from "@/components/common/Overlay"
import {
  type DialogButtonVariant,
  variantClassName,
} from "@/components/common/ChoiceDialog"
import ui from "@/styles/ui.module.css"

type Props = {
  open: boolean
  onClose: () => void
  ariaLabel: string
  title?: string
  message: string
  confirmLabel: string
  confirmVariant: DialogButtonVariant
  onConfirm: () => void | Promise<void>
  cancelLabel?: string
  loading?: { message: string }
}

/**
 * タイトル・本文メッセージ・確定/キャンセルボタンを持つ確認ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `onClose`: キャンセルボタン押下・背景クリック・Esc押下いずれの場合も呼ばれるコールバック
 * - `ariaLabel`: ダイアログの`aria-label`
 * - `title`: 見出し（省略時は表示しない）
 * - `message`: 本文メッセージ（警告文など）
 * - `confirmLabel`/`confirmVariant`/`onConfirm`: 確定ボタンのラベル・配色・押下時のコールバック
 * - `cancelLabel`: キャンセルボタンのラベル（既定値: "キャンセル"）
 * - `loading`: 指定時、カード内にローディングオーバーレイを表示し、両ボタンを無効化する
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、タイトル・本文・確定/キャンセルボタンを持つ確認ダイアログ
 *
 * 例:
 * - 入力: `{ open: true, ariaLabel: "削除の最終確認", message: "この操作は取り消せません。", confirmLabel: "削除する", confirmVariant: "red-strong", onConfirm, onClose }`
 * - 出力: 本文メッセージと「削除する」「キャンセル」ボタンを持つ確認ダイアログ
 */
export const Component: React.FC<Props> = ({
  open,
  onClose,
  ariaLabel,
  title,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  cancelLabel = "キャンセル",
  loading,
}) => {
  return (
    <Overlay open={open} onClose={onClose} contentClassName={ui["width-xs"]}>
      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]}`}
        role="dialog"
        aria-label={ariaLabel}
      >
        {loading && <Loading overlay message={loading.message} />}
        {title ? <h2 className={ui.subject}>{title}</h2> : null}
        <div className={ui["dialog-body"]}>
          <p className={ui.text}>{message}</p>
        </div>
        <div className={`${ui["dialog-actions"]} ${ui["dialog-actions-row"]}`}>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
            disabled={Boolean(loading)}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${variantClassName[confirmVariant]}`}
            disabled={Boolean(loading)}
            onClick={() => {
              void onConfirm()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default Component
