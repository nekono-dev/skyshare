/**
 * 本文で理由を伝える、確定・キャンセル操作付きの確認ダイアログ。
 *
 * - `ChoiceDialog` は本文メッセージを表示できないため、`Overlay` を直接使い、継承や多段化はしない。
 * - ボタンの配色型とクラスは `ChoiceDialog` と共有し、操作の種類を揃える。
 */
import { useT } from "@/components/i18n/useTranslation"
import React from "react"
import Loading from "@/components/common/Loading"
import Overlay from "@/components/common/dialog/Overlay"
import {
  type DialogButtonVariant,
  variantClassName,
} from "@/components/common/dialog/ChoiceDialog"
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
 * - `cancelLabel`: キャンセルボタンのラベル（省略時は表示言語の「キャンセル」）
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
  cancelLabel,
  loading,
}) => {
  const { t } = useT()
  return (
    <Overlay open={open} onClose={onClose} contentClassName={ui["width-md"]}>
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
            {cancelLabel ?? t("common.cancel")}
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
