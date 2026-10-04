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
 *     「Skyshareリンクを削除」「リンク・Bluesky投稿を削除」（最終確認あり、旧entryは無効化）
 *     を提示する。
 * - 編集ボタン: `EntryEditForm` を開き heading/caption を編集できる。
 *   保存成功時は `onSaved` を呼び出し、一覧側の表示を更新する。
 */

import { useFormat, useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { useRef, useState } from "react"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { TimelineSkyshareEntry } from "@/lib/entry/posts"
import { deleteEntry } from "@/client/openapi/client"
import { parseAtUri, skyshareEntryPath } from "@/lib/entry/url"
import ChoiceDialog from "@/components/common/ChoiceDialog"
import EntryDeleteConfirmDialog from "@/components/entry/EntryDeleteConfirmDialog"
import {
  resolveEntryDeleteScope,
  type EntryDeleteScope,
} from "@/lib/entry/resolveEntryDeleteScope"
import { resolveGuestDeleteScope } from "@/lib/entry/guestDummyPosts"
import Loading from "@/components/common/Loading"
import EntryEditForm from "@/components/entry/EntryEditForm"

type Props = {
  item: TimelineSkyshareEntry
  onDeleted?: () => void
  onSaved?: (next: { heading: string; caption: string }) => void
  /**
   * ログイン不要のゲスト表示。編集は無効化する。削除は有効だが、削除範囲の判定・削除の
   * 実行はアプリ内で模擬し、通信は行わない（`specs/entry/frontend/design.md §3.4.4`）。
   * 「Entryを開く」はサンプルEntryページ（`item.webUrl`）へ遷移できる。
   */
  guestMode?: boolean
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
const Component = ({ item, onDeleted, onSaved, guestMode = false }: Props) => {
  const translator = useT()
  const { t } = translator
  const { formatDateTime } = useFormat()
  const isOrphaned = item.orphaned === true
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isResolvingDeleteScope, setIsResolvingDeleteScope] = useState(false)
  const [deleteScope, setDeleteScope] = useState<EntryDeleteScope>({
    kind: "unknown",
  })
  const [deleteError, setDeleteError] = useState<PlainMessageKey | null>(null)
  // 連打時、state 更新の再レンダーが反映される前に多重リクエストが走るのを防ぐ。
  const isDeletingRef = useRef(false)

  const createdAtText = formatDateTime(item.createdAt, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  // ページ内リンクは entry 自身の AT URI から直接パスを組み立てる（常に相対パス）。
  // PostCard の「Entryを開く」リンクと同じ方針。ゲストモードのダミーEntryは
  // PDS上に実レコードを持たないため、実際に閲覧できるサンプルEntryページの
  // パス（`item.webUrl`、`@/lib/entry/guestDummyPosts`で用意）をそのまま使う。
  // このページは `entries/[slug].astro` と同様ログイン不要の公開ページのため、
  // `?guest`は引き継がない。
  const parsedEntryUri = parseAtUri(item.uri)
  const entryPath = guestMode
    ? item.webUrl
    : parsedEntryUri
      ? skyshareEntryPath(parsedEntryUri.repo, parsedEntryUri.rkey)
      : undefined

  /**
   * 削除を確定し、entry を削除する。
   *
   * Input:
   * - `deleteBskyPost`: true の場合、紐づく Bluesky 投稿も併せて削除する
   *   （orphaned entry には無関係のため未指定のまま呼ぶ）
   * - ゲスト表示では`deleteEntry`を呼ばず、成功時と同じ状態遷移のみ行う
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
      if (!guestMode) {
        const res = await deleteEntry(
          deleteBskyPost === undefined
            ? { uri: item.uri }
            : { uri: item.uri, deleteBskyPost },
        )
        if (res.status === 409) {
          setDeleteError("post.entry.deleteBlocked")
          setIsDialogOpen(false)
          return
        }
        if (res.status !== 200) {
          setDeleteError("post.entry.deleteFailed")
          return
        }
      }
      setIsDialogOpen(false)
      onDeleted?.()
    } catch (err) {
      console.error("EntryCard: failed to delete entry", err)
      setDeleteError("post.entry.deleteFailed")
    } finally {
      isDeletingRef.current = false
      setIsDeleting(false)
    }
  }

  /**
   * 削除確認ダイアログを開く。
   *
   * 処理の趣旨:
   * - orphaned entry（元投稿が既に無い）は削除範囲の判定自体が無意味なため、
   *   即座にダイアログを開く。
   * - 非orphanedの場合のみ`resolveEntryDeleteScope`でsourceの削除範囲を判定してから
   *   ダイアログを開く（判定中は削除ボタンを無効化し、ローディング表示する）。
   *   ゲスト表示では通信せず`resolveGuestDeleteScope`で判定する。
   *
   * Output:
   * - なし（判定完了後、`isDialogOpen`をtrueにする）
   */
  const openDeleteDialog = async () => {
    if (isOrphaned) {
      setIsDialogOpen(true)
      return
    }

    setIsResolvingDeleteScope(true)
    const scope = await (guestMode
      ? Promise.resolve(resolveGuestDeleteScope(item.sourceUri, translator))
      : resolveEntryDeleteScope(item.sourceUri))
    setIsResolvingDeleteScope(false)
    setDeleteScope(scope)
    setIsDialogOpen(true)
  }

  return (
    <article
      className={`${ui["base-card"]} ${styles.card} ${isOrphaned ? ui["card-muted"] : ""}`}
    >
      <div className={styles["main-column"]}>
        <div className={styles["header-row"]}>
          <p className={styles["created-at"]}>{createdAtText}</p>
        </div>
        {item.caption ? (
          <p className={styles.caption}>{item.caption}</p>
        ) : (
          <p className={styles["empty-caption"]}>{t("entry.card.noCaption")}</p>
        )}

        <div
          className={`${styles.footer} ${ui.toolbar} ${ui["toolbar-align"]}`}
        >
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
            disabled={guestMode}
            onClick={() => setIsEditDialogOpen(true)}
          >
            {t("common.edit")}
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]}  ${ui["red-button"]}`}
            disabled={isResolvingDeleteScope}
            onClick={() => {
              void openDeleteDialog()
            }}
          >
            {t("common.delete")}
          </button>
          {entryPath ? (
            <a
              className={styles["entry-link"]}
              href={entryPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("post.card.openEntry")}
            </a>
          ) : null}
        </div>

        {deleteError ? (
          <p className={styles["error-text"]}>{t(deleteError)}</p>
        ) : null}
      </div>

      {item.visualUrl ? (
        <div className={styles.thumbnail}>
          <img src={item.visualUrl} alt="" loading="lazy" decoding="async" />
        </div>
      ) : (
        <div className={styles["thumbnail-placeholder"]} aria-hidden="true" />
      )}

      {isDeleting ? (
        <Loading overlay message={t("post.card.deletingEntry")} />
      ) : null}
      {isResolvingDeleteScope ? (
        <Loading overlay message={t("post.card.checkingDeletion")} />
      ) : null}

      {isOrphaned ? (
        <ChoiceDialog
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          ariaLabel={t("entry.card.deleteConfirmAria")}
          loading={isDeleting ? { message: t("common.deleting") } : undefined}
          buttons={[
            {
              key: "delete",
              label: t("common.delete"),
              variant: "red",
              onClick: () => {
                void confirmDelete()
              },
              disabled: isDeleting,
            },
            {
              key: "cancel",
              label: t("common.cancel"),
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
          deleteScope={deleteScope}
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
