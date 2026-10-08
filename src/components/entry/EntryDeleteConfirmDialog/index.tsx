/**
 * Entry削除確認ダイアログ。
 *
 * 責務と処理概要:
 * - PostCard/EntryCard の「Entryを削除」選択時、削除方法を確認する
 *   （`specs/entry-delete-dialog`）。
 * - 「Skyshareリンクを削除」（entryのみ削除、最終確認なし）「リンク・Bluesky投稿を削除」
 *   「キャンセル」の3択を提示する。
 * - 「リンク・Bluesky投稿を削除」は取り消し不能で影響範囲が大きいため、選択と同時に
 *   `onDeletePost`を実行せず、内部stageを`"confirmPost"`へ切り替えて削除予定投稿の一覧付き
 *   `DeletePostListDialog`による最終確認を必ず挟む（単発投稿でも省略しない）。
 * - `deleteScope`が`deletable`以外（旧実装で作成されたentry・判定不能）の場合、
 *   同じ文言のままボタンをグレーにして無効化し、理由を選択肢ダイアログ内に表示する。
 */
import { useT } from "@/lib/i18n/react"
import React, { useEffect, useState } from "react"
import ChoiceDialog from "@/components/common/ChoiceDialog"
import DeletePostListDialog from "@/components/entry/DeletePostListDialog"
import type { EntryDeleteScope } from "@/lib/entry/resolveEntryDeleteScope"

type Props = {
  open: boolean
  isDeleting?: boolean
  /** 削除範囲の判定結果（呼び出し側がダイアログを開く前に確定させる） */
  deleteScope: EntryDeleteScope
  onDeleteLink: () => void | Promise<void>
  /** 最終確認の確定時のみ呼ばれる */
  onDeletePost: () => void | Promise<void>
  onCancel: () => void
}

/** `deleteScope`が`deletable`以外のときに「リンク・Bluesky投稿を削除」を無効化する理由文のキー。 */
const DISABLED_REASON_KEYS = {
  legacy: "entry.deleteConfirm.legacy",
  unknown: "entry.deleteConfirm.unknown",
} as const

/**
 * Entry削除確認ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `isDeleting`: 削除 API 実行中フラグ（ボタン disable とローディング表示に使用）
 * - `deleteScope`: 削除範囲の判定結果
 * - `onDeleteLink`: 「Skyshareリンクを削除」選択時のコールバック（entryのみ削除）
 * - `onDeletePost`: 最終確認で確定した時のコールバック（Bluesky投稿も併せて削除）
 * - `onCancel`: 1段階目の「キャンセル」選択時、および背景クリック時のコールバック
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - 通常は3択の選択肢ダイアログ、「リンク・Bluesky投稿を削除」選択後は最終確認ダイアログ
 *
 * 例:
 * - 入力: `{ open: true, deleteScope: { kind: "deletable", posts: [投稿] }, ... }`
 * - 出力: 「Skyshareリンクを削除」「リンク・Bluesky投稿を削除」「キャンセル」のダイアログ
 */
export const Component: React.FC<Props> = ({
  open,
  isDeleting = false,
  deleteScope,
  onDeleteLink,
  onDeletePost,
  onCancel,
}) => {
  const { t } = useT()
  const [stage, setStage] = useState<"choice" | "confirmPost">("choice")

  // ダイアログが閉じられたら、次回開いたとき必ず選択肢提示から始まるようにリセットする。
  useEffect(() => {
    if (!open) setStage("choice")
  }, [open])

  if (stage === "confirmPost" && deleteScope.kind === "deletable") {
    return (
      <DeletePostListDialog
        open={open}
        posts={deleteScope.posts}
        isDeleting={isDeleting}
        onConfirm={onDeletePost}
        onCancel={() => setStage("choice")}
      />
    )
  }

  const deletable = deleteScope.kind === "deletable"

  return (
    <ChoiceDialog
      open={open}
      onClose={onCancel}
      ariaLabel={t("entry.card.deleteConfirmAria")}
      loading={isDeleting ? { message: t("common.deleting") } : undefined}
      description={
        deletable ? undefined : t(DISABLED_REASON_KEYS[deleteScope.kind])
      }
      buttons={[
        {
          key: "delete-link",
          label: t("entry.deleteConfirm.deleteLink"),
          variant: "black",
          onClick: onDeleteLink,
          disabled: isDeleting,
        },
        {
          key: "delete-post",
          label: t("entry.deleteConfirm.deleteLinkAndPost"),
          variant: deletable ? "red" : "gray",
          onClick: () => setStage("confirmPost"),
          disabled: isDeleting || !deletable,
        },
        {
          key: "cancel",
          label: t("common.cancel"),
          variant: "gray",
          onClick: onCancel,
          disabled: isDeleting,
        },
      ]}
    />
  )
}

export default Component
