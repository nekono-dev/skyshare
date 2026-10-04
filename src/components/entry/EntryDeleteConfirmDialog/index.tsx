/**
 * Entry削除確認ダイアログ。
 *
 * 責務と処理概要:
 * - PostCard/EntryCard の「Entryを削除」選択時、削除方法を確認する
 *   （`specs/entry/frontend/design.md §3.4`）。
 * - 「Skyshareリンクを削除」（entryのみ削除、最終確認なし）「リンク・Bluesky投稿を削除」
 *   「キャンセル」の3択を提示する。
 * - 「リンク・Bluesky投稿を削除」は取り消し不能で影響範囲が大きいため、選択と同時に
 *   `onDeletePost`を実行せず、内部stageを`"confirmPost"`へ切り替えて削除予定投稿の一覧付き
 *   `DeletePostListDialog`による最終確認を必ず挟む（単発投稿でも省略しない）。
 * - `deleteScope`が`deletable`以外（旧実装で作成されたentry・判定不能）の場合、
 *   同じ文言のままボタンをグレーにして無効化し、理由を選択肢ダイアログ内に表示する。
 */
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

/** `deleteScope`が`deletable`以外のときに「リンク・Bluesky投稿を削除」を無効化する理由文。 */
const DISABLED_REASONS = {
  legacy:
    "このEntryは旧仕様で作成されており、Bluesky投稿を含めて削除できません。Skyshareリンクのみ削除するか、Bluesky上で直接投稿を削除してください。",
  unknown:
    "Bluesky投稿の状態を確認できないため、投稿を含めた削除は実行できません。時間をおいて再度お試しください。",
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
      ariaLabel="Entry削除確認"
      loading={isDeleting ? { message: "削除中..." } : undefined}
      description={deletable ? undefined : DISABLED_REASONS[deleteScope.kind]}
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
          variant: deletable ? "red" : "gray",
          onClick: () => setStage("confirmPost"),
          disabled: isDeleting || !deletable,
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
