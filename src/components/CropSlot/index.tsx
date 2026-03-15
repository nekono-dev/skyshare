import React, { useEffect, useRef, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import styles from "./index.module.css"

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

  const handleCropComplete = (_area: Area, areaPixels: Area) => {
    if (onChange) {
      onChange({ crop, zoom, cropPixels: areaPixels })
    }
  }

  return (
    <div className={styles.slotOuter}>
      {label && <div className={styles.slotLabel}>{label}</div>}
      <div
        className={styles.cropWrapper}
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
      <div className={styles.sliderArea}>
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
