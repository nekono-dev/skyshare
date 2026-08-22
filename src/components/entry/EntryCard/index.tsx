/**
 * skyshare entry 1件を表示するカード。
 *
 * 責務と処理概要:
 * - entry の createdAt・manifest.caption・manifest.visual を表示する。
 * - `item.orphaned`（紐づく Bluesky 投稿が削除済み）の場合、`ui["card-muted"]` により
 *   `PostCard` の作成対象外投稿と同じ要領で背景色を変えて識別しやすくする。
 * - 削除ボタン: `item.orphaned` に応じて確認ダイアログを出し分ける。
 *   - orphaned: `ChoiceDialog` による単純確認のみ（対応する Bluesky 投稿は既に
 *     存在しないため `deleteBskyPost` は付与しない）。
 *   - 非orphaned: `PostCard` と同じ `EntryDeleteConfirmDialog` を用い、
 *     「リンクのみ削除」「投稿を削除」の2択を提示する。
 * - 編集ボタン: `EntryEditForm` を開き heading/caption を編集できる。
 *   保存成功時は `onSaved` を呼び出し、一覧側の表示を更新する。
 */

import { useRef, useState } from "react"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { TimelineSkyshareEntry } from "@/lib/entry/posts"
import { deleteEntry } from "@/client/openapi/client"
import { parseAtUri, skyshareEntryPath } from "@/lib/entry/url"
import ChoiceDialog from "@/components/common/ChoiceDialog"
import EntryDeleteConfirmDialog from "@/components/entry/EntryDeleteConfirmDialog"
import Loading from "@/components/common/Loading"
import EntryEditForm from "@/components/entry/EntryEditForm"

type Props = {
  item: TimelineSkyshareEntry
  onDeleted?: () => void
  onSaved?: (next: { heading: string; caption: string }) => void
}

/**
 * entryカードを描画する。
 *
 * Input:
 * - `item`: entryの表示用データ（`orphaned` を含む）
 * - `onDeleted`: 削除成功時に呼び出すコールバック（一覧からの除去に使う）
 *
 * Output:
 * - 1件のentryカード JSX
 *
 * 例:
 * - 入力: `item.caption = "旅行の写真"`
 * - 出力: caption・作成日時・visual画像を持つカード
 */
const Component = ({ item, onDeleted, onSaved }: Props) => {
  const isOrphaned = item.orphaned === true
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // 連打時、state 更新の再レンダーが反映される前に多重リクエストが走るのを防ぐ。
  const isDeletingRef = useRef(false)

  const createdAtText = new Date(item.createdAt).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  // ページ内リンクは entry 自身の AT URI から直接パスを組み立てる（常に相対パス）。
  // PostCard の「Entryを開く」リンクと同じ方針。
  const parsedEntryUri = parseAtUri(item.uri)
  const entryPath = parsedEntryUri
    ? skyshareEntryPath(parsedEntryUri.repo, parsedEntryUri.rkey)
    : undefined

  /**
   * 削除を確定し、entry を削除する。
   *
   * Input:
   * - `deleteBskyPost`: true の場合、紐づく Bluesky 投稿も併せて削除する
   *   （orphaned entry には無関係のため未指定のまま呼ぶ）
   *
   * Output:
   * - なし（成功時は `onDeleted` を呼び、失敗時はエラー文言を表示する）
   */
  const confirmDelete = async (deleteBskyPost?: boolean) => {
    if (isDeletingRef.current) {
      return
    }
    isDeletingRef.current = true
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const res = await deleteEntry(
        deleteBskyPost === undefined
          ? { uri: item.uri }
          : { uri: item.uri, deleteBskyPost },
      )
      if (res.status !== 200) {
        setDeleteError("Entryの削除に失敗しました。")
        return
      }
      setIsDialogOpen(false)
      onDeleted?.()
    } catch (err) {
      console.error("EntryCard: failed to delete entry", err)
      setDeleteError("Entryの削除に失敗しました。")
    } finally {
      isDeletingRef.current = false
      setIsDeleting(false)
    }
  }

  return (
    <article
      className={`${ui["base-card"]} ${styles.card} ${isOrphaned ? ui["card-muted"] : ""}`}
    >
      <div className={styles["main-column"]}>
        <div className={styles["header-row"]}>
          <p className={styles["created-at"]}>{createdAtText}</p>
          {entryPath ? (
            <a
              className={styles["entry-link"]}
              href={entryPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              Entryを開く
            </a>
          ) : null}
        </div>
        {item.caption ? (
          <p className={styles.caption}>{item.caption}</p>
        ) : (
          <p className={styles["empty-caption"]}>キャプションはありません。</p>
        )}

        <div
          className={`${styles.footer} ${ui.toolbar} ${ui["toolbar-align"]}`}
        >
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
            onClick={() => setIsEditDialogOpen(true)}
          >
            編集
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]}  ${ui["red-button"]}`}
            onClick={() => setIsDialogOpen(true)}
          >
            削除
          </button>
        </div>

        {deleteError ? (
          <p className={styles["error-text"]}>{deleteError}</p>
        ) : null}
      </div>

      {item.visualUrl ? (
        <div className={styles.thumbnail}>
          <img src={item.visualUrl} alt="" loading="lazy" decoding="async" />
        </div>
      ) : (
        <div className={styles["thumbnail-placeholder"]} aria-hidden="true" />
      )}

      {isDeleting ? <Loading overlay message="Entryを削除中..." /> : null}

      {isOrphaned ? (
        <ChoiceDialog
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          ariaLabel="Entry削除確認"
          loading={isDeleting ? { message: "削除中..." } : undefined}
          buttons={[
            {
              key: "delete",
              label: "削除",
              variant: "red",
              onClick: () => {
                void confirmDelete()
              },
              disabled: isDeleting,
            },
            {
              key: "cancel",
              label: "キャンセル",
              variant: "gray",
              onClick: () => setIsDialogOpen(false),
              disabled: isDeleting,
            },
          ]}
        />
      ) : (
        <EntryDeleteConfirmDialog
          open={isDialogOpen}
          isDeleting={isDeleting}
          onDeleteLink={() => confirmDelete(false)}
          onDeletePost={() => confirmDelete(true)}
          onCancel={() => setIsDialogOpen(false)}
        />
      )}

      <EntryEditForm
        open={isEditDialogOpen}
        uri={item.uri}
        initialHeading={item.heading}
        initialCaption={item.caption}
        onClose={() => setIsEditDialogOpen(false)}
        onSaved={next => {
          onSaved?.(next)
          setIsEditDialogOpen(false)
        }}
      />
    </article>
  )
}

export default Component
