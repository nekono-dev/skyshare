/**
 * Entry削除確認ダイアログ。
 *
 * 責務と処理概要:
 * - PostCard の「Entryを削除」選択時、削除範囲を確認する。
 * - 「リンクを削除」（skyshare entry のみ削除）「投稿を削除」（Bluesky投稿も併せて削除）
 *   「キャンセル」の3択を提示し、選択結果を呼び出し元へ委譲する。
 */
import React from "react"
import ChoiceDialog from "@/components/common/ChoiceDialog"

type Props = {
  open: boolean
  isDeleting?: boolean
  onDeleteLink: () => void | Promise<void>
  onDeletePost: () => void | Promise<void>
  onCancel: () => void
}

/**
 * Entry削除確認ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `isDeleting`: 削除 API 実行中フラグ（ボタン disable とローディング表示に使用）
 * - `onDeleteLink`: 「リンクを削除」選択時のコールバック（skyshare entry のみ削除）
 * - `onDeletePost`: 「投稿を削除」選択時のコールバック（Bluesky投稿も併せて削除）
 * - `onCancel`: 「キャンセル」選択時、および背景クリック時のコールバック
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、3択ボタン付きの確認ダイアログ
 *
 * 例:
 * - 入力: `{ open: true, onDeleteLink, onDeletePost, onCancel }`
 * - 出力: 「Entryを削除しますか？」ダイアログ
 */
export const Component: React.FC<Props> = ({
  open,
  isDeleting = false,
  onDeleteLink,
  onDeletePost,
  onCancel,
}) => {
  return (
    <ChoiceDialog
      open={open}
      onClose={onCancel}
      ariaLabel="Entry削除確認"
      loading={isDeleting ? { message: "削除中..." } : undefined}
      buttons={[
        {
          key: "delete-link",
          label: "リンクのみ削除",
          variant: "black",
          onClick: onDeleteLink,
          disabled: isDeleting,
        },
        {
          key: "delete-post",
          label: "投稿を削除",
          variant: "red",
          onClick: onDeletePost,
          disabled: isDeleting,
        },
        {
          key: "cancel",
          label: "キャンセル",
          variant: "gray",
          onClick: onCancel,
          disabled: isDeleting,
        },
      ]}
    />
  )
}

export default Component
