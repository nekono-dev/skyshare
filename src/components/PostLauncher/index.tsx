import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Overlay from "../Overlay"
import PostForm, { type PostFormHandle } from "../PostForm"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import pic from "@/images/pen.svg"

/**
 * 投稿フォーム起動ボタンとモーダル表示を管理するコンポーネント。
 *
 * 責務と処理概要:
 * - フローティングボタンで投稿フォームを開く。
 * - Overlay 内で PostForm を表示し、閉じ操作を集中管理する。
 * - Overlay 背景クリックでの閉じ操作は PostForm の `requestClose` に委譲し、
 *   キャンセルボタンと同様に未保存の変更があれば下書き保存確認ダイアログを挟む。
 */

/**
 * 投稿ランチャーを描画する。
 *
 * Input:
 * - `avatarUrl`: 投稿フォーム内に表示するアバター URL
 *
 * Output:
 * - ランチャーボタン + 開閉可能な投稿フォームモーダル
 *
 * 例:
 * - 入力: `{ avatarUrl: "https://..." }`
 * - 出力: クリックで PostForm が開く UI
 */
const PostLauncher: React.FC<{
  avatarUrl?: string | null
  onPosted?: () => void
}> = ({ avatarUrl, onPosted }) => {
  const [open, setOpen] = useState(false)
  const postFormRef = useRef<PostFormHandle>(null)
  // サイドバーレイアウト(PC・アイコンのみ/フルラベルの両段階)専用トリガーの描画先。
  // Sidebar が用意する #sidebar-action へ Portal で描画することで、フレックス
  // レイアウト任せでナビ項目の直後に自然に並び、フローティングボタンと同じ open
  // state を共有する。アイコン/ラベルどちらを見せるかはCSS側の段階別表示で切り替える。
  const [sidebarActionEl, setSidebarActionEl] = useState<HTMLElement | null>(
    null,
  )
  useEffect(() => {
    setSidebarActionEl(document.getElementById("sidebar-action"))
  }, [])

  return (
    <>
      <button
        className={`${ui["base-button"]} ${ui["blue-button"]} ${ui["nontext-button"]} ${ui["lg-button"]} ${styles["launcher-delta"]}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <img src={pic.src} width={24} height={24} />
      </button>

      {sidebarActionEl &&
        createPortal(
          <button
            className={`${ui["base-button"]} ${ui["blue-button"]} ${ui["text-button"]} ${styles["sidebar-action"]}`}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label="新規投稿"
          >
            <img
              src={pic.src}
              width={20}
              height={20}
              className={styles["sidebar-action-icon"]}
            />
            <span className={styles["sidebar-action-label"]}>新規投稿</span>
          </button>,
          sidebarActionEl,
        )}

      <Overlay open={open} onClose={() => postFormRef.current?.requestClose()}>
        <PostForm
          ref={postFormRef}
          onClose={() => setOpen(false)}
          onPosted={() => {
            setOpen(false)
            onPosted?.()
          }}
          avatarUrl={avatarUrl}
        />
      </Overlay>
    </>
  )
}

export default PostLauncher
