/**
 * Entry削除確認ダイアログ。
 *
 * 責務と処理概要:
 * - PostCard/EntryCard の「Entryを削除」選択時、削除範囲を確認する。
 * - 「リンクを削除」（skyshare entry のみ削除）「投稿を削除」（Bluesky投稿も併せて削除）
 *   「キャンセル」の3択を基本とし、`showThreadOption`が true の場合のみ
 *   「スレッド全体を削除」（source起点でentry所有者自身の後続投稿もすべて削除）を追加する
 *   （`specs/entry/frontend/design.md §3.4`）。
 */
import React from "react"
import ChoiceDialog from "@/components/common/ChoiceDialog"

type Props = {
  open: boolean
  isDeleting?: boolean
  /** `source`がスレッド先頭かつentry所有者自身の後続投稿が存在する場合のみtrue */
  showThreadOption?: boolean
  onDeleteLink: () => void | Promise<void>
  onDeletePost: () => void | Promise<void>
  onDeleteThread?: () => void | Promise<void>
  onCancel: () => void
}

/**
 * Entry削除確認ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `isDeleting`: 削除 API 実行中フラグ（ボタン disable とローディング表示に使用）
 * - `showThreadOption`: trueの場合のみ「スレッド全体を削除」ボタンを追加表示する
 * - `onDeleteLink`: 「リンクを削除」選択時のコールバック（skyshare entry のみ削除）
 * - `onDeletePost`: 「投稿を削除」選択時のコールバック（Bluesky投稿も併せて削除）
 * - `onDeleteThread`: 「スレッド全体を削除」選択時のコールバック（`showThreadOption`時のみ使用）
 * - `onCancel`: 「キャンセル」選択時、および背景クリック時のコールバック
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、（`showThreadOption`次第で3〜4択）確認ダイアログ
 *
 * 例:
 * - 入力: `{ open: true, onDeleteLink, onDeletePost, onCancel }`
 * - 出力: 「Entryを削除しますか？」ダイアログ
 */
export const Component: React.FC<Props> = ({
  open,
  isDeleting = false,
  showThreadOption = false,
  onDeleteLink,
  onDeletePost,
  onDeleteThread,
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
          label: "Skyshareリンクを削除",
          variant: "black",
          onClick: onDeleteLink,
          disabled: isDeleting,
        },
        {
          key: "delete-post",
          label: "リンク・Bluesky投稿を削除",
          variant: "red",
          onClick: onDeletePost,
          disabled: isDeleting,
        },
        ...(showThreadOption && onDeleteThread
          ? [
              {
                key: "delete-thread",
                label:
                  "リンク・スレッド全体を削除（後続の自己投稿もすべて削除、元に戻せません）",
                variant: "red" as const,
                onClick: onDeleteThread,
                disabled: isDeleting,
              },
            ]
          : []),
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
