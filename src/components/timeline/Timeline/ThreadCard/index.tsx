/**
 * Timeline のスレッドグループを折りたたみ・展開して表示する。
 * Entry 操作はルート投稿に集約し、削除後はページング単位であるスレッド全体を一覧から除く。
 */
import { useT } from "@/components/i18n/useTranslation"
import { useState } from "react"
import PostCard from "@/components/timeline/Timeline/ThreadCard/PostCard"
import type { ThreadGroup } from "@/lib/timeline/posts"
import {
  findEntryCarrier,
  resolveEntryVisualSourcePost,
} from "@/lib/timeline/entryCandidate"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  group: ThreadGroup
  onPostDeleted: (predicate: (item: ThreadGroup) => boolean) => void
  guestMode: boolean
}

/**
 * スレッドグループを描画する。
 *
 * Input:
 * - `group`: バックエンドが確定させたスレッドグループ（`GET /v2/entries`の`threads`の1件）
 * - `onPostDeleted`: 削除成功時、一覧から該当スレッドグループを取り除くための述語ベースコールバック
 * - `guestMode`: ゲスト表示か
 *
 * Output:
 * - `group.replies.length === 0`: 既存`PostCard`と同じ単一カード
 * - 2件以上: 折りたたみ/展開可能なスレッドカード
 */
const Component = ({ group, onPostDeleted, guestMode }: Props) => {
  const { tn, t } = useT()
  const [expanded, setExpanded] = useState(false)
  const entryVisualSourcePost = resolveEntryVisualSourcePost(group)
  // グループ内に Entry の画像取得元も Entry もなければ、全カードをグレーアウトする。
  const threadMuted =
    entryVisualSourcePost === null && findEntryCarrier(group) === null

  const removeThisGroup = () =>
    onPostDeleted(candidate => candidate.rootPost.uri === group.rootPost.uri)

  if (group.replies.length === 0) {
    return (
      <PostCard
        item={group.rootPost}
        onPostDeleted={removeThisGroup}
        guestMode={guestMode}
      />
    )
  }

  return (
    <div className={styles["thread-card"]}>
      <PostCard
        item={group.rootPost}
        onPostDeleted={removeThisGroup}
        guestMode={guestMode}
        postCreateEntryButton={!!entryVisualSourcePost}
        entryVisualSourcePost={entryVisualSourcePost ?? undefined}
        entrySourcePost={group.rootPost}
      />
      {!expanded ? (
        <button
          type="button"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${styles["expand-button"]}`}
          onClick={() => setExpanded(true)}
        >
          <span className={styles["indicator"]} aria-hidden />
          {tn("post.threadExpand", group.replies.length)}
        </button>
      ) : (
        <>
          {/* 返信はルートより幅を縮めて左に余白を設け、スレッドの段（連結）を示す */}
          <div className={styles["reply-list"]}>
            {group.replies.map(reply => (
              <PostCard
                key={reply.uri}
                item={reply}
                onPostDeleted={removeThisGroup}
                guestMode={guestMode}
                hideToolbar
                muted={threadMuted}
              />
            ))}
          </div>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${styles["expand-button"]}`}
            onClick={() => setExpanded(false)}
          >
            <span
              className={`${styles["indicator"]} ${styles["indicator-open"]}`}
              aria-hidden
            />
            {t("post.threadCollapse")}
          </button>
        </>
      )}
    </div>
  )
}

export default Component
