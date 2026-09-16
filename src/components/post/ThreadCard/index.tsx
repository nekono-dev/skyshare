/**
 * Timeline一覧の1スレッドグループを表示するカード。
 *
 * 責務と処理概要:
 * - `group.replies.length === 0`（単独投稿）の場合は、既存`PostCard`をそのまま描画する
 *   フォールバック（`specs/timeline/design.md §4.1`、FR-2）。
 * - 2件以上のスレッドグループは、既定で折りたたみ表示（ルート投稿＋「返信を表示」ボタン）
 *   とし、操作により全投稿を時系列順（古い→新しい）に展開表示する。
 * - 事後entry作成ボタン（`resolvePostCreateEntryTarget`）・スレッド由来の視覚的区別
 *   （`findEntryCarrier`）の判定は`entryCandidate.ts`に委譲する。
 */
import { useState } from "react"
import PostCard from "@/components/post/PostCard"
import type { TimelinePost } from "@/lib/entry/posts"
import type { ThreadGroup } from "@/components/post/Timeline/threadGroup"
import {
  findEntryCarrier,
  resolvePostCreateEntryTarget,
} from "./entryCandidate"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  group: ThreadGroup
  onPostDeleted: (predicate: (item: TimelinePost) => boolean) => void
  guestMode: boolean
}

/**
 * スレッドグループを描画する。
 *
 * Input:
 * - `group`: グルーピング済みの投稿群（`groupIntoThreads`の結果）
 * - `onPostDeleted`: 削除成功時、一覧から該当投稿を取り除くための述語ベースコールバック
 * - `guestMode`: ゲスト表示か
 *
 * Output:
 * - `group.replies.length === 0`: 既存`PostCard`と同じ単一カード
 * - 2件以上: 折りたたみ/展開可能なスレッドカード
 */
const Component = ({ group, onPostDeleted, guestMode }: Props) => {
  const [expanded, setExpanded] = useState(false)
  const entryCarrier = findEntryCarrier(group)
  const postCreateEntryTarget = resolvePostCreateEntryTarget(group)

  // グループ内の投稿群（ルート＋返信）いずれかのuriと一致するかを判定する。
  // スレッド全体削除（deletedThread=true）時、表示上折りたたみ/展開の対象になっていた
  // 投稿すべてを一覧から除去するために使う（`specs/timeline/requirements.md FR-5`）。
  const matchesGroup = (candidate: TimelinePost) =>
    candidate.uri === group.rootPost.uri ||
    group.replies.some(reply => reply.uri === candidate.uri)

  if (group.replies.length === 0) {
    return (
      <PostCard
        item={group.rootPost}
        onPostDeleted={deletedThread =>
          onPostDeleted(
            deletedThread
              ? matchesGroup
              : candidate => candidate.uri === group.rootPost.uri,
          )
        }
        guestMode={guestMode}
      />
    )
  }

  return (
    <div className={styles["thread-card"]}>
      <PostCard
        item={group.rootPost}
        onPostDeleted={deletedThread =>
          onPostDeleted(
            deletedThread
              ? matchesGroup
              : candidate => candidate.uri === group.rootPost.uri,
          )
        }
        guestMode={guestMode}
        threadBadge={!!entryCarrier}
      />
      {!expanded ? (
        <button
          type="button"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${styles["expand-button"]}`}
          onClick={() => setExpanded(true)}
        >
          返信を表示（{group.replies.length}件）
        </button>
      ) : (
        <>
          {group.replies.map(reply => (
            <PostCard
              key={reply.uri}
              item={reply}
              onPostDeleted={() =>
                onPostDeleted(candidate => candidate.uri === reply.uri)
              }
              guestMode={guestMode}
              postCreateEntryButton={reply.uri === postCreateEntryTarget?.uri}
            />
          ))}
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${styles["expand-button"]}`}
            onClick={() => setExpanded(false)}
          >
            折りたたむ
          </button>
        </>
      )}
    </div>
  )
}

export default Component
