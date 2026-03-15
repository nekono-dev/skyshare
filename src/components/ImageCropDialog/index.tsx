import { useEffect, useState } from "react"
import CropSlot, { type SlotCropState } from "@/components/CropSlot"
import Overlay from "@/components/Overlay"
import Loading from "@/components/Loading"
import { createProcessedImages, getSlotDefs } from "@/lib/postImageProcessing"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  imageUrls: string[]
  initialCropStates?: (SlotCropState | null)[]
  onConfirm: (
    originalBlobs: Blob[],
    thumbnailBlob: Blob,
    cropStates: SlotCropState[],
  ) => void
  onCancel: () => void
}

export const Component: React.FC<Props> = ({
  imageUrls,
  initialCropStates = [],
  onConfirm,
  onCancel,
}) => {
  const count = Math.min(4, Math.max(1, imageUrls.length))
  const slotDefs = getSlotDefs(count)
  const [cropStates, setCropStates] = useState<SlotCropState[]>(() =>
    Array.from({ length: count }).map(
      (_, i) =>
        initialCropStates[i] ?? {
          crop: { x: 0, y: 0 },
          zoom: 1,
          cropPixels: null,
        },
    ),
  )
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    setCropStates(
      Array.from({ length: count }).map(
        (_, i) =>
          initialCropStates[i] ?? {
            crop: { x: 0, y: 0 },
            zoom: 1,
            cropPixels: null,
          },
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrls.length])

  const handleSlotChange = (idx: number, state: SlotCropState) => {
    setCropStates(prev => {
      const next = prev.slice()
      next[idx] = state
      return next
    })
  }

  const canConfirm =
    cropStates.length === slotDefs.length &&
    cropStates.every(s => s.cropPixels !== null)

  const handleConfirm = async () => {
    if (!canConfirm || isProcessing) return
    setIsProcessing(true)
    try {
      const { originalBlobs, thumbnailBlob } = await createProcessedImages(
        imageUrls,
        cropStates,
      )
      onConfirm(originalBlobs, thumbnailBlob, cropStates)
    } catch (err) {
      console.error(err)
      setIsProcessing(false)
    }
  }

  return (
    <Overlay
      open
      onClose={isProcessing ? () => {} : onCancel}
      contentClassName={`${styles.overlayContent} ${styles[`overlayContent${count}`]}`}
    >
      {isProcessing && <Loading overlay message="画像を処理中..." />}
      <div className={styles.container}>
        <h3 className={styles.title}>画像を調整</h3>
        <p className={styles.caption}>
          1200 x 630 の範囲で配置と拡大率を調整します。
        </p>

        <div className={`${styles.compositeArea} ${styles[`layout${count}`]}`}>
          {slotDefs.map((def, i) => (
            <div
              key={i}
              style={{ gridArea: `slot${i}` }}
              className={styles.slotContainer}
            >
              <CropSlot
                imageUrl={imageUrls[i]}
                aspect={def.w / def.h}
                initialCropPixels={cropStates[i]?.cropPixels ?? null}
                label={`画像 ${i + 1}`}
                onChange={s => handleSlotChange(i, s)}
              />
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
            onClick={onCancel}
            disabled={isProcessing}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.blueButton}`}
            onClick={handleConfirm}
            disabled={!canConfirm || isProcessing}
          >
            OK
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default Component
