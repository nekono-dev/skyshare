/**
 * 下書き保存確認ダイアログ。
 *
 * 責務と処理概要:
 * - 投稿フォームでキャンセル時に未保存の本文がある場合、下書きとして保存するかを確認する。
 * - 「保存」「破棄」「編集を続ける」の3択を提示し、選択結果を呼び出し元へ委譲する。
 */
import React from "react"
import ChoiceDialog from "@/components/ChoiceDialog"

type Props = {
  open: boolean
  isSaving?: boolean
  onSave: () => void | Promise<void>
  onDiscard: () => void
  onContinueEditing: () => void
}

/**
 * 下書き保存確認ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `isSaving`: 保存 API 実行中フラグ（ボタン disable とローディング表示に使用）
 * - `onSave`: 「下書きを保存」選択時のコールバック
 * - `onDiscard`: 「破棄」選択時のコールバック
 * - `onContinueEditing`: 「編集を続ける」選択時、および背景クリック時のコールバック
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、3択ボタン付きの確認ダイアログ
 *
 * 例:
 * - 入力: `{ open: true, onSave, onDiscard, onContinueEditing }`
 * - 出力: 「下書きを保存しますか？」ダイアログ
 */
export const Component: React.FC<Props> = ({
  open,
  isSaving = false,
  onSave,
  onDiscard,
  onContinueEditing,
}) => {
  return (
    <ChoiceDialog
      open={open}
      onClose={onContinueEditing}
      ariaLabel="下書き保存確認"
      loading={isSaving ? { message: "下書きを保存中..." } : undefined}
      buttons={[
        {
          key: "save",
          label: "下書きを保存",
          variant: "blue",
          onClick: onSave,
          disabled: isSaving,
        },
        {
          key: "discard",
          label: "破棄",
          variant: "red",
          onClick: onDiscard,
          disabled: isSaving,
        },
        {
          key: "continue",
          label: "編集を続ける",
          variant: "gray",
          onClick: onContinueEditing,
          disabled: isSaving,
        },
      ]}
    />
  )
}

export default Component
