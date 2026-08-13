/**
 * 1件の Bluesky 投稿を表示するカード。
 *
 * 責務と処理概要:
 * - 投稿本文、作者情報、画像サムネイルを 1 枚のカードにまとめて描画する。
 * - `skyshareEntry` が付与されている場合はその view 画像を優先表示し、Entry ページへのリンクを出す。
 * - `skyshareEntry` が無く画像投稿の場合は、既存投稿から skyshare entry を発行するボタンを出す。
 * - サムネイルはカード右側に配置し、左側の情報列（author/本文/ツールバー）の高さいっぱいに広げることで
 *   カード全体の縦幅を最小限に抑える。複数画像がある場合は縦に分割して並べる。
 */

import { useState } from "react"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { TimelinePost } from "@/lib/posts"
import { createEntryFromPost } from "@/client/openapi/client"
import SkyshareShareDialog from "@/components/SkyshareShareDialog"
import blueskyIcon from "@/images/bluesky.svg"
import skyshareIcon from "@/images/skyshare.svg"

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
  const [isCreatingEntry, setIsCreatingEntry] = useState(false)
  const [createEntryError, setCreateEntryError] = useState<string | null>(null)
  const [createdEntryUrl, setCreatedEntryUrl] = useState<string | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const createdAtText = new Date(item.indexedAt).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  // Entry へのリンクは既存の skyshareEntry を優先し、その場発行分は createdEntryUrl で補う。
  const entryWebUrl = item.skyshareEntry?.webUrl ?? createdEntryUrl ?? undefined
  // サムネイルは skyshare の view 画像を優先する。無い場合、複数画像投稿は全画像を縦に分割して表示する。
  const thumbnailImages = item.skyshareEntry?.visualUrl
    ? [item.skyshareEntry.visualUrl]
    : item.images.map(image => image.url)
  const canCreateEntry =
    !item.skyshareEntry && !createdEntryUrl && item.images.length > 0
  // Entry も無く作成対象にも該当しない投稿（画像を持たない投稿）はカード全体をグレーアウトする。
  const isSkyshareIneligible = !entryWebUrl && !canCreateEntry

  /**
   * 既存の Bluesky 投稿から skyshare entry を発行する。
   *
   * Input:
   * - なし（`item.uri` を対象投稿として送信）
   *
   * Output:
   * - なし（成功時は `createdEntryUrl` を更新し、共有ダイアログを開く）
   */
  const handleCreateEntry = async () => {
    if (isCreatingEntry) return

    setIsCreatingEntry(true)
    setCreateEntryError(null)

    try {
      const res = await createEntryFromPost({ postUri: item.uri })
      if (res.status !== 200) {
        setCreateEntryError("skyshareページの作成に失敗しました。")
        return
      }

      setCreatedEntryUrl(res.data.skyshare.uri)
      setShareDialogOpen(true)
    } catch (err) {
      console.error("PostCard: failed to create skyshare entry", err)
      setCreateEntryError("skyshareページの作成に失敗しました。")
    } finally {
      setIsCreatingEntry(false)
    }
  }

  return (
    <article
      className={`${ui.baseCard} ${styles.card} ${isSkyshareIneligible ? styles.cardIneligible : ""}`}
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

        <footer className={styles.footer}>
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

          {entryWebUrl ? (
            <>
              <a
                className={`${ui.baseButton} ${ui.nontextButton} ${ui.mdButton} ${ui.whiteButton}`}
                href={entryWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Entry を開く"
                title="Entry を開く"
              >
                <img src={skyshareIcon.src} width={20} height={20} alt="" />
              </a>
              <button
                type="button"
                className={`${ui.baseButton} ${ui.textButton} ${ui.grayButton}`}
                onClick={() => setShareDialogOpen(true)}
              >
                クロスポスト
              </button>
            </>
          ) : canCreateEntry ? (
            <button
              type="button"
              className={`${ui.baseButton} ${ui.textButton} ${ui.blueButton}`}
              disabled={isCreatingEntry}
              onClick={() => {
                void handleCreateEntry()
              }}
            >
              {isCreatingEntry ? "作成中…" : "Skyshare Entryを作成"}
            </button>
          ) : (
            <span className={styles.noSkyshare}>
              skyshare entry はありません。
            </span>
          )}

          {createEntryError ? (
            <span className={styles.createEntryError}>{createEntryError}</span>
          ) : null}
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
