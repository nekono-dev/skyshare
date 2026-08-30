/**
 * 1件の Bluesky 投稿を表示するカード。
 *
 * 責務と処理概要:
 * - 投稿本文、作者情報、画像サムネイルを 1 枚のカードにまとめて描画する。
 * - `skyshareEntry` が付与されている場合はその view 画像を優先表示し、Entry ページへのリンクを出す。
 * - `skyshareEntry` が無く画像投稿の場合は、既存投稿から skyshare entry を発行するボタンを出す。
 * - サムネイルはカード右側・author/本文の高さいっぱいに配置し、ツールバーには被らないよう
 *   ツールバーはその下に独立した行として配置する。複数画像がある場合は縦に分割して並べる。
 * - Entry の作成・削除に伴う状態遷移自体は `useSkyshareEntryStatus` に委譲し、
 *   このコンポーネントはその結果（`display`）を描画するだけに徹する。
 */

import { useState } from "react"
import Avatar from "@/components/common/Avatar"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { TimelinePost } from "@/lib/entry/posts"
import { useSkyshareEntryStatus } from "./useSkyshareEntryStatus"
import { useWebShareCrosspost } from "./useWebShareCrosspost"
import { parseAtUri, skyshareEntryPath } from "@/lib/entry/url"
import Loading from "@/components/common/Loading"
import PostCardEntryActions from "@/components/post/PostCardEntryActions"
import SkyshareShareDialog from "@/components/post/SkyshareShareDialog"
import EntryDeleteConfirmDialog from "@/components/entry/EntryDeleteConfirmDialog"
import blueskyIcon from "@/images/bluesky.svg"
import shareIcon from "@/images/share.svg"

type PostCardProps = {
  item: TimelinePost
  onPostDeleted?: () => void
}

/**
 * 投稿カードを描画する。
 *
 * Input:
 * - `item`: 正規化済みの投稿一覧データ
 *
 * Output:
 * - 1件の投稿カード JSX
 *
 * 例:
 * - 入力: `item.text = "hello"`
 * - 出力: 投稿本文と作者情報を持つカード
 */
const Component = ({ item, onPostDeleted }: PostCardProps) => {
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const {
    display,
    createError,
    deleteError,
    isDeleteDialogOpen,
    createEntryFromPost,
    requestDeleteEntry,
    cancelDeleteEntry,
    confirmDeleteEntry,
  } = useSkyshareEntryStatus(item, {
    onCreated: () => setShareDialogOpen(true),
    onPostDeleted,
  })

  const createdAtText = new Date(item.indexedAt).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const activeEntry =
    display.kind === "entry" || display.kind === "deleting"
      ? display.entry
      : null
  const entryWebUrl = activeEntry?.webUrl

  const {
    isSupported: isWebShareSupported,
    isSharing: isWebSharing,
    shareError,
    shareViaWebApi,
  } = useWebShareCrosspost(item, entryWebUrl ?? null)

  // ページ内リンクは entry 自身の AT URI から直接パスを組み立てる（常に相対パス）。
  // X共有（SkyshareShareDialog）は外部サービスへの絶対URLが必要なため、
  // そちらは本番ドメイン固定で生成された entryWebUrl をそのまま渡す。
  const parsedEntryUri = activeEntry ? parseAtUri(activeEntry.uri) : undefined
  const entryPath = parsedEntryUri
    ? skyshareEntryPath(parsedEntryUri.repo, parsedEntryUri.rkey)
    : undefined
  // サムネイルは skyshare の view 画像を優先する。無い場合、複数画像投稿は全画像を縦に分割して表示する。
  const thumbnailImages = activeEntry?.visualUrl
    ? [activeEntry.visualUrl]
    : item.images.map(image => image.url)
  // Entry も無く作成対象にも該当しない投稿（画像を持たない投稿）はカード全体をグレーアウトする。
  const isSkyshareIneligible = display.kind === "ineligible"

  return (
    <article
      className={`${ui["base-card"]} ${styles.card} ${isSkyshareIneligible ? ui["card-muted"] : ""}`}
    >
      <div className={styles["top-row"]}>
        <div className={styles["content-column"]}>
          <div className={styles["author-block"]}>
            <Avatar
              src={item.author.avatar}
              alt={item.author.displayName ?? item.author.handle}
              size="md"
            />

            <div className={styles["author-meta"]}>
              <div className={styles["author-name-row"]}>
                {item.author.displayName !== "" && (
                  <strong>{item.author.displayName}</strong>
                )}
                <span className={styles.handle}>@{item.author.handle}</span>
              </div>
              <p className={styles["created-at"]}>{createdAtText}</p>
            </div>

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

          {item.text ? <p className={styles.text}>{item.text}</p> : null}
        </div>

        {thumbnailImages.length > 0 ? (
          <div className={styles.thumbnail}>
            {thumbnailImages.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className={styles["thumbnail-slice"]}
              >
                <img src={url} alt="" loading="lazy" decoding="async" />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <footer
        className={`${styles.footer} ${ui["toolbar"]} ${ui["toolbar-align"]}`}
      >
        <a
          className={`${ui["base-button"]} ${ui["nontext-button"]} ${ui["md-button"]} ${ui["white-button"]}`}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Bluesky で開く"
          title="Bluesky で開く"
        >
          <img src={blueskyIcon.src} width={20} height={20} alt="" />
        </a>

        {isWebShareSupported ? (
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["nontext-button"]} ${ui["md-button"]} ${ui["white-button"]}`}
            disabled={isWebSharing}
            onClick={shareViaWebApi}
            aria-label="Web Share APIで共有"
            title="Web Share APIで共有"
          >
            <img src={shareIcon.src} width={20} height={20} alt="" />
          </button>
        ) : null}

        <PostCardEntryActions
          display={display}
          createError={createError}
          deleteError={deleteError}
          onCreate={createEntryFromPost}
          onRequestDelete={requestDeleteEntry}
          onCrosspost={() => setShareDialogOpen(true)}
        />

        {shareError ? (
          <span className={styles["share-error"]}>{shareError}</span>
        ) : null}
      </footer>

      {display.kind === "deleting" ? (
        <Loading overlay message="Entryを削除中..." />
      ) : null}

      {isWebSharing && !entryWebUrl && item.images.length > 0 ? (
        <Loading overlay message="画像を読み込み中..." />
      ) : null}

      <SkyshareShareDialog
        open={shareDialogOpen}
        postText={item.text}
        entryUrl={entryWebUrl ?? null}
        onClose={() => setShareDialogOpen(false)}
      />

      <EntryDeleteConfirmDialog
        open={isDeleteDialogOpen}
        isDeleting={display.kind === "deleting"}
        onDeleteLink={() => confirmDeleteEntry(false)}
        onDeletePost={() => confirmDeleteEntry(true)}
        onCancel={cancelDeleteEntry}
      />
    </article>
  )
}

export default Component
