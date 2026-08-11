import React, { useState } from "react"
import Overlay from "../Overlay"
import PostForm from "../PostForm"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import pic from "@/images/pen.svg"

/**
 * 投稿フォーム起動ボタンとモーダル表示を管理するコンポーネント。
 *
 * 責務と処理概要:
 * - フローティングボタンで投稿フォームを開く。
 * - Overlay 内で PostForm を表示し、閉じ操作を集中管理する。
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

  return (
    <>
      <button
        className={`${ui.baseButton} ${ui.blueButton} ${ui.nontextButton} ${ui.lgButton} ${styles.launcherDelta}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <img src={pic.src} width={24} height={24} />
      </button>

      <Overlay open={open} onClose={() => setOpen(false)}>
        <PostForm
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
