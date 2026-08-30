import React from "react"
import ComponentList from "@/components/common/ComponentList"
import FloatingBox from "@/components/common/FloatingBox"
import Avatar from "@/components/common/Avatar"
import InlineIcon from "@/components/common/InlineIcon"
import type { SuggestCandidate } from "@/components/post/PostForm/useSuggest"
import styles from "./index.module.css"

/**
 * PostFormのメンション/ハッシュタグ候補ポップアップ。
 *
 * 責務と処理概要:
 * - 状態は一切持たないプレゼンテーショナルコンポーネント。開閉・候補内容・ハイライト位置は
 *   すべて `src/components/post/PostForm/useSuggest.ts` が管理する。
 * - フローティング表示（ポータル・位置決め・常に最前面・スクロール/リサイズでの消去）は
 *   共通コンポーネント `FloatingBox` に委譲し、候補の反復描画は共通コンポーネント
 *   `ComponentList` に委譲する。
 */

type Props = {
  candidates: SuggestCandidate[]
  activeIndex: number
  position: { top: number; left: number } | null
  listboxId: string
  onHoverIndex: (index: number) => void
  onSelect: (index: number) => void
  onDismiss: () => void
}

type CandidateOptionRowProps = {
  item: SuggestCandidate
  index: number
  isActive: boolean
  listboxId: string
  onHoverIndex: (index: number) => void
  onSelect: (index: number) => void
}

/**
 * 候補1件分を `role="option"` の行として描画する。
 *
 * Input:
 * - `item`: メンション/ハッシュタグいずれかの候補
 * - `index`: 候補一覧内でのindex
 * - `isActive`: キーボード/マウスでハイライト中かどうか
 *
 * Output:
 * - 候補行（アバター・表示名・handle、または `#tag`）
 */
const CandidateOptionRow: React.FC<CandidateOptionRowProps> = ({
  item: candidate,
  index,
  isActive,
  listboxId,
  onHoverIndex,
  onSelect,
}) => (
  <div
    id={`${listboxId}-option-${index}`}
    role="option"
    aria-selected={isActive}
    className={`${styles.option} ${isActive ? styles["option-active"] : ""}`}
    onMouseEnter={() => onHoverIndex(index)}
    onMouseDown={e => {
      // mousedownはblurより先に発火するため、preventDefault()しておけばtextareaの
      // フォーカス・選択範囲を失わずに候補を確定できる
      // （onClickだと先にblurが走り、確定処理側で正しいカーソル位置が取れなくなる）。
      e.preventDefault()
      onSelect(index)
    }}
  >
    {candidate.kind === "mention" ? (
      <>
        <Avatar src={candidate.item.avatarUrl} alt="" size="sm" />
        <span className={styles["candidate-text"]}>
          <span className={styles["display-name"]}>
            {candidate.item.displayName || candidate.item.handle}
          </span>
          <span className={styles.handle}>@{candidate.item.handle}</span>
        </span>
      </>
    ) : (
      <span className={styles["candidate-text"]}>
        <span className={styles["display-name"]}>
          <InlineIcon name="hashtag" alt="" />
          {candidate.item.tag}
        </span>
        {candidate.item.source === "trending" && (
          <span className={styles.handle}>トレンド</span>
        )}
      </span>
    )}
  </div>
)

/**
 * メンション/ハッシュタグ候補一覧をキャレット位置にフローティング表示する。
 *
 * Input:
 * - `candidates`: 表示する候補一覧（0件なら描画しない）
 * - `activeIndex`: キーボード/マウスでハイライト中の候補index
 * - `position`: ビューポート基準のpx座標
 * - `onDismiss`: スクロール/リサイズ等で位置が無効化された際に呼ばれる
 *
 * Output:
 * - 候補一覧UI。`candidates`が空または`position`が未確定なら何も描画しない
 */
export const SuggestPopover: React.FC<Props> = ({
  candidates,
  activeIndex,
  position,
  listboxId,
  onHoverIndex,
  onSelect,
  onDismiss,
}) => (
  <FloatingBox
    open={candidates.length > 0}
    position={position}
    onDismiss={onDismiss}
    id={listboxId}
    role="listbox"
    className={styles.popover}
  >
    <ComponentList
      items={candidates}
      itemComponent={CandidateOptionRow}
      getItemProps={(item, index) => ({
        index,
        isActive: index === activeIndex,
        listboxId,
        onHoverIndex,
        onSelect,
      })}
      getItemKey={item =>
        item.kind === "mention"
          ? `mention-${item.item.did}`
          : `hashtag-${item.item.tag}`
      }
    />
  </FloatingBox>
)

export default SuggestPopover
