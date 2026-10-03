/**
 * Timeline一覧の1スレッドグループを表示するカード。
 *
 * 責務と処理概要:
 * - `group.replies.length === 0`（単独投稿）の場合は、既存`PostCard`をそのまま描画する
 *   フォールバック（`specs/timeline/design.md §4.1`、FR-2）。
 * - 2件以上のスレッドグループは、既定で折りたたみ表示（ルート投稿＋「スレッドを展開」ボタン）
 *   とし、操作により全投稿を時系列順（古い→新しい）に展開表示する。
 * - 事後entry作成ボタン（`resolveEntryVisualSourcePost`）の判定は`entryCandidate.ts`に委譲する。ボタン自体は常に
 *   ルート投稿のカードにのみ表示し、中間投稿のカードに表示することはない。
 * - Timelineのページング対象アイテムはバックエンドが権威的に確定した`ThreadGroup`
 *   そのものであるため（`specs/timeline/design.md §1`）、削除成功時の一覧除去は常に
 *   スレッドグループ単位で行う（同§4）。
 */
import { useT } from "@/lib/i18n/react"
import { useState } from "react"
import PostCard from "@/components/post/PostCard"
import type { ThreadGroup } from "@/lib/entry/posts"
import { resolveEntryVisualSourcePost } from "./entryCandidate"
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
                postCreateEntryButton={false}
                threadReply
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
