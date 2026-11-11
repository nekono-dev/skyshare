/**
 * 削除対象の Bluesky 投稿一覧を含む最終確認ダイアログ。
 *
 * - ConfirmDialog は本文のみのため Overlay で構成する。スレッドでは一覧をスクロールさせ、操作ボタンを画面内に保つ。
 */
import { useT } from "@/components/i18n/useTranslation"
import React from "react"
import Loading from "@/components/common/Loading"
import ComponentList from "@/components/common/list/ComponentList"
import Overlay from "@/components/common/dialog/Overlay"
import DeletePostListItem from "@/components/entry/EntryDeleteConfirmDialog/DeletePostListDialog/DeletePostListItem"
import { variantClassName } from "@/components/common/dialog/ChoiceDialog"
import type { TimelinePost } from "@/lib/timeline/posts"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  open: boolean
  /** 削除予定の投稿（古い→新しい順。1件以上） */
  posts: TimelinePost[]
  isDeleting?: boolean
  /** 「全て削除」押下時のみ呼ばれる */
  onConfirm: () => void | Promise<void>
  /** キャンセルボタン・背景クリック・Esc押下時に呼ばれる */
  onCancel: () => void
}

/**
 * 削除予定投稿の一覧付き最終確認ダイアログを描画する。
 *
 * Input:
 * - `open`: 表示状態 / `posts`: 削除予定の投稿 / `isDeleting`: 削除API実行中
 * - `onConfirm`: 確定時のコールバック / `onCancel`: キャンセル時のコールバック
 *
 * Output:
 * - `open=false`なら何も描画しない
 *
 * 例:
 * - 入力: `{ open: true, posts: [投稿A, 投稿B], onConfirm, onCancel }`
 * - 出力: 「Blueskyのスレッド（2件の投稿）を削除します。」と2件の一覧、2つのボタン
 */
export const Component: React.FC<Props> = ({
  open,
  posts,
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  const { t, tn } = useT()
  // 削除件数を示す概要文。単発は専用文言、複数はスレッドとして件数付きの文言にする。
  const summary =
    posts.length === 1
      ? t("entry.deletePosts.summarySingle")
      : tn("entry.deletePosts.summaryThread", posts.length)
  // スレッド（2件以上）のみ一覧の高さを固定してスクロールさせる。
  const isThread = posts.length >= 2

  return (
    <Overlay open={open} onClose={onCancel} contentClassName={ui["width-md"]}>
      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]}`}
        role="dialog"
        aria-label={t("entry.deletePosts.aria")}
      >
        {isDeleting && <Loading overlay message={t("common.deleting")} />}
        <h2 className={ui.subject}>{t("entry.deletePosts.title")}</h2>
        <div className={ui["dialog-body"]}>
          <p className={ui.text}>
            {summary}
            {t("entry.deletePosts.warning")}
          </p>
          <div
            className={isThread ? styles["post-list-fixed"] : undefined}
            role="region"
            aria-label={t("entry.deletePosts.listAria")}
            tabIndex={isThread ? 0 : undefined}
          >
            <ComponentList
              items={posts}
              itemComponent={DeletePostListItem}
              getItemKey={post => post.uri}
            />
          </div>
        </div>
        <div className={`${ui["dialog-actions"]} ${ui["dialog-actions-row"]}`}>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
            disabled={isDeleting}
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["red-button"]}`}
            disabled={isDeleting}
            onClick={() => {
              void onConfirm()
            }}
          >
            {t("entry.deletePosts.deleteAll")}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default Component
