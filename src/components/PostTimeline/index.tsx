/**
 * 自分の投稿一覧と投稿ランチャーをまとめて扱うクライアントコンポーネント。
 *
 * 責務と処理概要:
 * - ページロード時に `/v1/entry` を読み直し、投稿一覧を取得する。
 * - PostForm の投稿成功後に一覧を再取得する。
 * - 取得結果を ComponentList + PostCard で描画する。
 */

import { useEffect, useState } from "react"
import { getEntry } from "@/client/openapi/client"
import ComponentList from "@/components/ComponentList"
import PostCard from "@/components/PostCard"
import PostLauncher from "@/components/PostLauncher"
import type { TimelinePost } from "@/lib/posts"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  avatarUrl?: string | null
}

/**
 * 投稿一覧を読み込み、再取得を管理する。
 *
 * Input:
 * - `avatarUrl`: 投稿フォーム内の表示用アバター
 *
 * Output:
 * - 投稿ランチャーと一覧表示を含む UI
 */
const Component = ({ avatarUrl }: Props) => {
  const [posts, setPosts] = useState<TimelinePost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const loadPosts = async () => {
      setLoading(true)
      setError("")

      try {
        const res = await getEntry({ limit: 20 })
        if (cancelled) return

        if (res.status === 200) {
          setPosts(res.data.posts ?? [])
          return
        }

        if (res.status === 401) {
          setError("ログインが必要です。")
          return
        }

        setError(res.data.error ?? "投稿一覧の取得に失敗しました。")
      } catch (err) {
        if (!cancelled) {
          console.error("PostTimeline: failed to load posts", err)
          setError("投稿一覧の取得に失敗しました。")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPosts()

    return () => {
      cancelled = true
    }
  }, [refreshCount])

  return (
    <section className={`${ui.baseCard} ${styles.timelineCard}`}>
      <PostLauncher
        avatarUrl={avatarUrl}
        onPosted={() => setRefreshCount(count => count + 1)}
      />

      <header className={styles.timelineHeader}>
        <h2 className={styles.timelineTitle}>自分の投稿一覧</h2>
        <p className={styles.timelineNote}>
          Bluesky の投稿と、紐づく skyshare entry を並べて表示します。
        </p>
      </header>

      {loading ? (
        <p className={styles.emptyState}>読み込み中…</p>
      ) : error ? (
        <p className={styles.errorState}>{error}</p>
      ) : posts.length > 0 ? (
        <ComponentList
          items={posts}
          itemComponent={PostCard}
          getItemKey={item => item.uri}
          className={styles.timelineList}
        />
      ) : (
        <p className={styles.emptyState}>投稿がまだありません。</p>
      )}
    </section>
  )
}

export default Component
