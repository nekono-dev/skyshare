import React, { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { acquireScrollLock, releaseScrollLock } from "@/lib/scrollLock"
import styles from "./index.module.css"

/**
 * クリックで閉じられるモーダル用オーバーレイコンポーネント。
 *
 * 責務と処理概要:
 * - `open` が `true` のときだけ背景と内容を描画する。
 * - 背景上での押下（mousedown）と離す（mouseup）が両方とも背景自身で発生した場合のみ
 *   `onClose` を呼ぶ。内容領域内でのテキスト選択ドラッグ中にマウスが背景側で
 *   離された場合に誤ってダイアログが閉じてしまうのを防ぐため。
 * - 表示中は背面のスクロールを止め、スクロール操作が内容領域（PostForm など）へ向くようにする。
 *   ロック自体は `scrollLock`（参照カウント方式）に委譲し、投稿フォーム内で
 *   下書き保存確認やクロップダイアログなど Overlay が入れ子になっても、
 *   一番外側が保存したスクロール位置だけを基準に正しく復元されるようにする。
 * - ブラウザ環境では `createPortal` で `document.body` 配下へ描画する。
 */

type Props = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  contentClassName?: string
  contentStyle?: React.CSSProperties
}

/**
 * オーバーレイと内容領域を描画する。
 *
 * Input:
 * - `open`: 表示状態
 * - `onClose`: 背景を押下→離すが両方とも背景自身で完結した場合のクローズ処理
 * - `children`: 表示する内容
 * - `contentClassName`: 内容領域に追加するクラス名
 *
 * Output:
 * - `open=false` の場合 `null`
 * - `open=true` の場合 オーバーレイ JSX（環境に応じて通常描画/Portal描画）
 *
 * 例:
 * - 入力: `{ open: true, children: <Dialog /> }`
 * - 出力: 画面全体の backdrop 上に Dialog を表示
 */
const Overlay: React.FC<Props> = ({
  open,
  onClose,
  children,
  contentClassName,
  contentStyle,
}) => {
  const pressedOnBackdrop = useRef(false)

  useEffect(() => {
    if (!open || typeof document === "undefined") return

    acquireScrollLock()
    return () => releaseScrollLock()
  }, [open])

  if (!open) return null

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    pressedOnBackdrop.current = e.target === e.currentTarget
  }

  const handleBackdropMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const shouldClose =
      pressedOnBackdrop.current && e.target === e.currentTarget
    pressedOnBackdrop.current = false
    if (shouldClose) onClose()
  }

  const overlay = (
    <div
      className={styles.backdrop}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
      role="presentation"
    >
      <div
        className={[styles.content, contentClassName].filter(Boolean).join(" ")}
        style={contentStyle}
      >
        {children}
      </div>
    </div>
  )

  if (typeof document === "undefined") {
    return overlay
  }

  return createPortal(overlay, document.body)
}

export default Overlay
