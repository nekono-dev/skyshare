import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import styles from "./index.module.css"

/**
 * アンカー追従型のフローティングコンテナ。
 *
 * 責務と処理概要:
 * - 中身（`children`）の内容は一切関知しない薄いプリミティブ。`Overlay` と同じ
 *   `createPortal` で `document.body` 直下へ描画し、常に最前面（`Overlay` より上、
 *   全画面 `Loading` より下）に表示する。
 * - 呼び出し側が計算したビューポート相対座標（`position`）を基準に `position: fixed` で
 *   配置するが、そのまま使うとパネルが画面外にはみ出しうるため、実際に描画したパネルの
 *   実寸（`offsetWidth`/`offsetHeight`）を使ってビューポート内に収まるよう座標を補正する
 *   （幅・高さは縮めず、位置だけをずらす）。候補内容の変化でパネルの実寸が変わった場合も
 *   `ResizeObserver` で検知し再補正する。
 * - スクロール・リサイズなど、`position` を再計算しないまま表示位置が実態とズレうる
 *   イベントが発生した場合は `onDismiss` を呼ぶ。ただしパネル自身の内部スクロール
 *   （中身が `overflow-y: auto` 等を持つ場合）では閉じない。
 * - フォーカスアウトや外側クリックでの消去は持たない。用途によって意味が異なるため、
 *   各利用側が `onDismiss` 経由で個別に配線する。
 */

/** ビューポート端とパネルの間に最低限確保する余白(px) */
const VIEWPORT_EDGE_MARGIN_PX = 8

type Props = {
  open: boolean
  position: { top: number; left: number } | null
  onDismiss: () => void
  id?: string
  role?: string
  "aria-label"?: string
  className?: string
  children: React.ReactNode
}

/**
 * `children` をフローティングパネルとして描画する。
 *
 * Input:
 * - `open`: 表示状態
 * - `position`: `document.body` 基準（ビューポート相対）のpx座標
 * - `onDismiss`: スクロール/リサイズなど位置が無効化されうるイベント発生時に呼ぶ
 *
 * Output:
 * - `open=false` または `position=null` の場合 `null`
 * - それ以外は `document.body` へポータル描画されたパネル
 */
export const FloatingBox: React.FC<Props> = ({
  open,
  position,
  onDismiss,
  id,
  role,
  className,
  children,
  ...rest
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  // 呼び出し側から渡された生の座標(position)を、実際に描画したパネルの実寸に基づいて
  // ビューポート内に収まるよう補正した座標。初回描画時はまだパネルの実寸が測れないため
  // positionをそのまま使い、直後のuseLayoutEffectで補正する(ペイント前に反映されるため
  // チラつきは生じない)。
  const [adjustedPosition, setAdjustedPosition] = useState(position)

  useEffect(() => {
    if (!open) return

    const handleScroll = (e: Event) => {
      const panelEl = panelRef.current
      if (panelEl && e.target instanceof Node && panelEl.contains(e.target)) {
        return
      }
      onDismissRef.current()
    }
    const handleResize = () => onDismissRef.current()

    // scrollイベントはバブリングしないため、任意の子孫スクロールコンテナのスクロールを
    // 検知するにはdocumentへcaptureフェーズで登録する必要がある。
    document.addEventListener("scroll", handleScroll, true)
    window.addEventListener("resize", handleResize)

    return () => {
      document.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleResize)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !position) {
      setAdjustedPosition(position)
      return
    }

    const panelEl = panelRef.current
    if (!panelEl) {
      setAdjustedPosition(position)
      return
    }

    const clampToViewport = () => {
      const { offsetWidth: width, offsetHeight: height } = panelEl
      const maxLeft = Math.max(
        VIEWPORT_EDGE_MARGIN_PX,
        window.innerWidth - width - VIEWPORT_EDGE_MARGIN_PX,
      )
      const maxTop = Math.max(
        VIEWPORT_EDGE_MARGIN_PX,
        window.innerHeight - height - VIEWPORT_EDGE_MARGIN_PX,
      )
      setAdjustedPosition({
        left: Math.min(
          Math.max(position.left, VIEWPORT_EDGE_MARGIN_PX),
          maxLeft,
        ),
        top: Math.min(Math.max(position.top, VIEWPORT_EDGE_MARGIN_PX), maxTop),
      })
    }

    clampToViewport()

    // 候補件数・文字列長の変化などでposition自体は変わらないままパネルの実寸だけが
    // 変わるケースがあるため、実寸変化も監視して再補正する。
    const observer = new ResizeObserver(clampToViewport)
    observer.observe(panelEl)
    return () => observer.disconnect()
  }, [open, position])

  if (!open || !position) return null

  const panel = (
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={rest["aria-label"]}
      className={[styles.panel, className].filter(Boolean).join(" ")}
      style={{
        top: adjustedPosition?.top ?? position.top,
        left: adjustedPosition?.left ?? position.left,
      }}
    >
      {children}
    </div>
  )

  if (typeof document === "undefined") return panel

  return createPortal(panel, document.body)
}

export default FloatingBox
