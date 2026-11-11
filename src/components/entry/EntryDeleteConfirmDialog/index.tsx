/**
 * Entry と関連する Bluesky 投稿の削除範囲を確認するダイアログ。
 *
 * - 投稿削除は取り消せないため、選択後に単発投稿でも一覧付きの最終確認を挟む。
 * - 判定不能または削除不可の Entry では、投稿削除の選択肢を無効にする。
 */
import { useT } from "@/components/i18n/useTranslation"
import React, { useEffect, useState } from "react"
import ChoiceDialog from "@/components/common/dialog/ChoiceDialog"
import DeletePostListDialog from "@/components/entry/EntryDeleteConfirmDialog/DeletePostListDialog"
import type { EntryDeleteScope } from "@/lib/timeline/resolveEntryDeleteScope"

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
