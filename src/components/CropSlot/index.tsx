import React, { useEffect, useRef, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import styles from "./index.module.css"

/**
 * 単一画像のクロップ操作を担当するコンポーネント。
 *
 * 責務と処理概要:
 * - `react-easy-crop` を用いて指定アスペクトの切り抜き UI を表示する。
 * - コンテナサイズ変化に追随して `minZoom` と crop フレームを再計算する。
 * - 切り抜き結果を `onChange` で親へ通知する。
 */

export type SlotCropState = {
  crop: { x: number; y: number }
  zoom: number
  cropPixels: Area | null
}

type Props = {
  imageUrl: string
  aspect: number
  label?: string
  initialCropPixels?: Area | null // natural image pixels
  onChange?: (state: SlotCropState) => void
}

/**
 * クロップスロットを描画する。
 *
 * Input:
 * - `imageUrl`: 編集対象画像 URL
 * - `aspect`: 切り抜きアスペクト比
 * - `label`: スロット表示名
 * - `initialCropPixels`: 初期切り抜き領域（自然画像座標）
 * - `onChange`: クロップ状態変化通知
 *
 * Output:
 * - 画像クロップ UI（Cropper + zoom スライダー）
 *
 * 例:
 * - 入力: `{ imageUrl: "blob:...", aspect: 1.9 }`
 * - 出力: 1.9 比率のクロップスロット
 */
const CropSlot: React.FC<Props> = ({
  imageUrl,
  aspect,
  label,
  initialCropPixels = null,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(1)
  const [cropFrameSize, setCropFrameSize] = useState<{
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    /**
     * 現在のコンテナ実寸をクロップフレームへ反映する。
     */
    const updateCropFrameSize = () => {
      const width = container.clientWidth
      const height = container.clientHeight

      if (width <= 0 || height <= 0) {
        return
      }

      setCropFrameSize({ width, height })
    }

    updateCropFrameSize()

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(updateCropFrameSize)
      resizeObserver.observe(container)
      return () => resizeObserver.disconnect()
    }

    window.addEventListener("resize", updateCropFrameSize)
    return () => window.removeEventListener("resize", updateCropFrameSize)
  }, [aspect])

  useEffect(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setMinZoom(1)
  }, [imageUrl])

  /**
   * 画像読み込み完了時に最小ズームと初期位置を計算する。
   *
   * 処理の趣旨:
   * - 画像がフレームを必ず覆うよう `requiredMinZoom` を算出する。
   * - 既存の `initialCropPixels` がある場合は、その中心を維持して復元する。
   *
   * Input:
   * - `mSize`: Cropper から渡される表示/自然サイズ情報
   *
   * Output:
   * - 返り値なし（`zoom`/`crop`/`minZoom` を更新）
   */
  const handleMediaLoaded = (mSize: {
    width: number
    height: number
    naturalWidth?: number
    naturalHeight?: number
  }) => {
    const frameWidth =
      cropFrameSize?.width ?? containerRef.current?.clientWidth ?? mSize.width
    const frameHeight =
      cropFrameSize?.height ??
      containerRef.current?.clientHeight ??
      frameWidth / aspect
    const requiredMinZoom = Math.max(
      frameWidth / mSize.width,
      frameHeight / mSize.height,
      1,
    )

    setMinZoom(requiredMinZoom)

    if (initialCropPixels) {
      const natW = mSize.naturalWidth ?? mSize.width
      const natH = mSize.naturalHeight ?? mSize.height

      const zoomByWidth =
        (frameWidth * (natW / (mSize.width || natW))) / initialCropPixels.width
      const zoomByHeight =
        (frameHeight * (natH / (mSize.height || natH))) /
        initialCropPixels.height
      const calculatedZoom = Math.max(
        zoomByWidth,
        zoomByHeight,
        requiredMinZoom,
      )

      const centerX = initialCropPixels.x + initialCropPixels.width / 2
      const centerY = initialCropPixels.y + initialCropPixels.height / 2
      const xPercent = (centerX / natW - 0.5) * 100
      const yPercent = (centerY / natH - 0.5) * 100

      setZoom(calculatedZoom)
      setCrop({
        x: Number(xPercent.toFixed(4)),
        y: Number(yPercent.toFixed(4)),
      })
      return
    }

    setZoom(requiredMinZoom)
  }

  /**
   * クロップ確定ごとに最新状態を親へ通知する。
   *
   * Input:
   * - `_area`: 比率座標（未使用）
   * - `areaPixels`: 実ピクセル座標のクロップ領域
   *
   * Output:
   * - 返り値なし（`onChange` 呼び出し）
   */
  const handleCropComplete = (_area: Area, areaPixels: Area) => {
    if (onChange) {
      onChange({ crop, zoom, cropPixels: areaPixels })
    }
  }

  return (
    <div className={styles["slot-outer"]}>
      {label && <div className={styles["slot-label"]}>{label}</div>}
      <div
        className={styles["crop-wrapper"]}
        ref={containerRef}
        style={{ aspectRatio: String(aspect) }}
      >
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          minZoom={minZoom}
          maxZoom={8}
          aspect={aspect}
          cropSize={cropFrameSize ?? undefined}
          restrictPosition
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          onMediaLoaded={handleMediaLoaded}
        />
      </div>
      <div className={styles["slider-area"]}>
        <input
          type="range"
          min={minZoom}
          max={8}
          step={0.01}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
        />
      </div>
    </div>
  )
}

export default CropSlot
