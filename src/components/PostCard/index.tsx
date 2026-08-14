/**
 * 1件の Bluesky 投稿を表示するカード。
 *
 * 責務と処理概要:
 * - 投稿本文、作者情報、画像サムネイルを 1 枚のカードにまとめて描画する。
 * - `skyshareEntry` が付与されている場合はその view 画像を優先表示し、Entry ページへのリンクを出す。
 * - `skyshareEntry` が無く画像投稿の場合は、既存投稿から skyshare entry を発行するボタンを出す。
 * - サムネイルはカード右側に配置し、左側の情報列（author/本文/ツールバー）の高さいっぱいに広げることで
 *   カード全体の縦幅を最小限に抑える。複数画像がある場合は縦に分割して並べる。
 * - Entry の作成・削除に伴う状態遷移自体は `useSkyshareEntryStatus` に委譲し、
 *   このコンポーネントはその結果（`display`）を描画するだけに徹する。
 */

import { useState } from "react"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { TimelinePost } from "@/lib/posts"
import { useSkyshareEntryStatus } from "./useSkyshareEntryStatus"
import Loading from "@/components/Loading"
import PostCardEntryActions from "@/components/PostCardEntryActions"
import SkyshareShareDialog from "@/components/SkyshareShareDialog"
import blueskyIcon from "@/images/bluesky.svg"

type PostCardProps = {
  item: TimelinePost
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
const Component = ({ item }: PostCardProps) => {
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const {
    display,
    createError,
    deleteError,
    createEntryFromPost,
    deleteEntryRecord,
  } = useSkyshareEntryStatus(item, {
    onCreated: () => setShareDialogOpen(true),
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
  // サムネイルは skyshare の view 画像を優先する。無い場合、複数画像投稿は全画像を縦に分割して表示する。
  const thumbnailImages = activeEntry?.visualUrl
    ? [activeEntry.visualUrl]
    : item.images.map(image => image.url)
  // Entry も無く作成対象にも該当しない投稿（画像を持たない投稿）はカード全体をグレーアウトする。
  const isSkyshareIneligible = display.kind === "ineligible"

  return (
    <article
      className={`${ui.baseCard} ${styles.card} ${isSkyshareIneligible ? ui.cardMuted : ""}`}
    >
      <div className={styles.mainColumn}>
        <div className={styles.authorBlock}>
          {item.author.avatar ? (
            <img
              className={styles.avatar}
              src={item.author.avatar}
              alt={item.author.displayName ?? item.author.handle}
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={styles.avatarPlaceholder} aria-hidden="true" />
          )}

          <div className={styles.authorMeta}>
            <div className={styles.authorNameRow}>
              <strong>{item.author.displayName ?? item.author.handle}</strong>
              <span className={styles.handle}>@{item.author.handle}</span>
            </div>
            <p className={styles.createdAt}>{createdAtText}</p>
          </div>
        </div>

        {item.text ? <p className={styles.text}>{item.text}</p> : null}

        <footer className={`${styles.footer} ${ui.toolbar} ${ui.toolbarAlign}`}>
          <a
            className={`${ui.baseButton} ${ui.nontextButton} ${ui.mdButton} ${ui.whiteButton}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Bluesky で開く"
            title="Bluesky で開く"
          >
            <img src={blueskyIcon.src} width={20} height={20} alt="" />
          </a>

          <PostCardEntryActions
            display={display}
            createError={createError}
            deleteError={deleteError}
            onCreate={createEntryFromPost}
            onDelete={deleteEntryRecord}
            onCrosspost={() => setShareDialogOpen(true)}
          />
        </footer>
      </div>

      {thumbnailImages.length > 0 ? (
        <div className={styles.thumbnail}>
          {thumbnailImages.map((url, index) => (
            <div key={`${url}-${index}`} className={styles.thumbnailSlice}>
              <img src={url} alt="" loading="lazy" decoding="async" />
            </div>
          ))}
        </div>
      ) : null}

      {display.kind === "deleting" ? (
        <Loading overlay message="Entryを削除中..." />
      ) : null}

      <SkyshareShareDialog
        open={shareDialogOpen}
        postText={item.text}
        entryUrl={entryWebUrl ?? null}
        onClose={() => setShareDialogOpen(false)}
      />
    </article>
  )
}

export default Component
