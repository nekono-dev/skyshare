import { useEffect, useId, useRef, useState, type ChangeEvent } from "react"
import ImageCropDialog from "@/components/ImageCropDialog"
import Loading from "@/components/Loading"
import type { Area } from "react-easy-crop"
import {
  computeCropAroundCenter,
  computeInitialCrop,
  createProcessedImages,
  getSlotDefs,
  loadImageSize,
} from "@/lib/postImageProcessing"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import pic from "@/images/image.svg"

export type SlotCropState = {
  crop: { x: number; y: number }
  zoom: number
  cropPixels: Area | null
}

export type ImageSlot = {
  objectUrl: string
  fileName: string
  naturalWidth?: number
  naturalHeight?: number
  cropState: SlotCropState
  file?: File
}

export type ImageEntry = {
  originalBlobs: Blob[]
  thumbnailBlob: Blob
  originalPreviews: string[]
  thumbnailPreview: string
  sourceFileNames: string[]
  meta?: { width?: number; height?: number }[]
}

type Props = {
  value: ImageEntry | null
  onChange: (entry: ImageEntry | null) => void
  disabled?: boolean
}

export const Component = ({ value, onChange, disabled = false }: Props) => {
  const [slots, setSlots] = useState<ImageSlot[]>([])
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [isPreparingPreview, setIsPreparingPreview] = useState(false)
  const slotsRef = useRef<ImageSlot[]>([])
  const inputId = useId()

  const revokeSlotUrls = (targetSlots: ImageSlot[]) => {
    targetSlots.forEach(slot => {
      try {
        URL.revokeObjectURL(slot.objectUrl)
      } catch (error) {}
    })
  }

  useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  useEffect(() => {
    return () => {
      revokeSlotUrls(slotsRef.current)
    }
  }, [])

  useEffect(() => {
    if (value === null && slotsRef.current.length > 0) {
      revokeSlotUrls(slotsRef.current)
      setSlots([])
    }
  }, [value])

  const createEntryFromSlots = async (nextSlots: ImageSlot[]) => {
    if (nextSlots.length === 0) {
      onChange(null)
      return
    }

    const cropStates = nextSlots.map(slot => slot.cropState)
    const { originalBlobs, thumbnailBlob } = await createProcessedImages(
      nextSlots.map(slot => slot.objectUrl),
      cropStates,
    )

    onChange({
      originalBlobs,
      thumbnailBlob,
      originalPreviews: originalBlobs.map(blob => URL.createObjectURL(blob)),
      thumbnailPreview: URL.createObjectURL(thumbnailBlob),
      sourceFileNames: nextSlots.map(slot => slot.fileName),
      meta: nextSlots.map(slot => ({
        width: slot.naturalWidth,
        height: slot.naturalHeight,
      })),
    })
  }

  const normalizeSlotsForLayout = (
    sourceSlots: ImageSlot[],
    defs: ReturnType<typeof getSlotDefs>,
  ) =>
    sourceSlots.map((slot, index) => {
      const def = defs[index]
      if (!def || !slot.naturalWidth || !slot.naturalHeight) {
        return slot
      }

      const currentCrop = slot.cropState.cropPixels
      const centerX = currentCrop
        ? currentCrop.x + currentCrop.width / 2
        : slot.naturalWidth / 2
      const centerY = currentCrop
        ? currentCrop.y + currentCrop.height / 2
        : slot.naturalHeight / 2

      const cropPixels = computeCropAroundCenter(
        slot.naturalWidth,
        slot.naturalHeight,
        def.w,
        def.h,
        centerX,
        centerY,
      )

      return {
        ...slot,
        cropState: {
          crop: { x: 0, y: 0 },
          zoom: 1,
          cropPixels,
        },
      }
    })

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const newFiles = input.files ? Array.from(input.files) : []
    input.value = ""
    if (newFiles.length === 0) return

    const allowed = Math.max(0, 4 - slots.length)
    const take = newFiles.slice(0, allowed)

    const urls = take.map(f => ({
      url: URL.createObjectURL(f),
      name: f.name,
      file: f,
    }))

    // compute slot defs for new total count
    const newCount = slots.length + urls.length
    const defs = getSlotDefs(newCount)

    const addedSlots: ImageSlot[] = []
    for (let i = 0; i < urls.length; i++) {
      const idx = slots.length + i
      const { url, name, file } = urls[i]
      try {
        const size = await loadImageSize(url)
        const def = defs[idx]
        const cropPixels = computeInitialCrop(
          size.width,
          size.height,
          def.w,
          def.h,
        )
        addedSlots.push({
          objectUrl: url,
          fileName: name,
          naturalWidth: size.width,
          naturalHeight: size.height,
          cropState: { crop: { x: 0, y: 0 }, zoom: 1, cropPixels },
          file,
        })
      } catch (err) {
        // fallback: still add slot
        addedSlots.push({
          objectUrl: url,
          fileName: name,
          cropState: { crop: { x: 0, y: 0 }, zoom: 1, cropPixels: null },
          file,
        })
      }
    }

    const nextSlots = normalizeSlotsForLayout(
      slots.concat(addedSlots).slice(0, 4),
      defs,
    )
    setSlots(nextSlots)

    setIsPreparingPreview(true)
    try {
      await createEntryFromSlots(nextSlots)
    } catch (error) {
      console.error(error)
      onChange(null)
    } finally {
      setIsPreparingPreview(false)
    }
    console.log(`nextSlots: ${JSON.stringify(nextSlots)}`)
  }

  const handleOpenCrop = () => {
    if (slots.length === 0) return
    setShowCropDialog(true)
  }

  const handleCropConfirm = (
    originalBlobs: Blob[],
    thumbnailBlob: Blob,
    newStates: SlotCropState[],
  ) => {
    // update slots cropState from newStates
    setSlots(prev =>
      prev.map((s, i) => ({ ...s, cropState: newStates[i] ?? s.cropState })),
    )

    const entry: ImageEntry = {
      originalBlobs,
      thumbnailBlob,
      originalPreviews: originalBlobs.map(b => URL.createObjectURL(b)),
      thumbnailPreview: URL.createObjectURL(thumbnailBlob),
      sourceFileNames: slots.map(s => s.fileName),
      meta: slots.map(s => ({
        width: s.naturalWidth,
        height: s.naturalHeight,
      })),
    }

    onChange(entry)
    setShowCropDialog(false)
  }

  const handleRemoveAll = () => {
    revokeSlotUrls(slots)
    setSlots([])
    setShowCropDialog(false)
    onChange(null)
  }

  const previewEntry = value

  return (
    <section className={styles.section}>
      {isPreparingPreview && <Loading message="画像プレビューを生成中..." />}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <label
          htmlFor={inputId}
          className={`${ui.baseButton} ${ui.whiteButton} ${ui.nontextButton} ${ui.mdButton}`}
          aria-label="画像追加"
          aria-disabled={disabled}
          style={{ cursor: disabled ? "default" : "pointer" }}
        >
          <img src={pic.src} width={18} height={18} alt="" />
        </label>

        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={disabled}
        />

        <button
          type="button"
          className={`${ui.baseButton} ${ui.textButton} ${ui.blueButton}`}
          onClick={handleOpenCrop}
          disabled={disabled || slots.length === 0}
        >
          クロップ設定
        </button>

        {slots.length > 0 && (
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
            onClick={handleRemoveAll}
            disabled={disabled}
          >
            画像を撤去
          </button>
        )}
      </div>

      {previewEntry && (
        <div className={styles.previewArea}>
          <article className={styles.previewItem}>
            <p className={styles.previewTitle}>
              サムネイル（visual: 1200x630）
            </p>
            <img
              src={previewEntry.thumbnailPreview}
              alt="1200x630 サムネイル"
              className={styles.previewImg}
            />
          </article>

          {/* <div className={styles.previewList}>
            {previewEntry.originalPreviews.map((preview, index) => (
              <article
                key={`${previewEntry.sourceFileNames[index]}-${index}`}
                className={styles.previewItem}
              >
                <p className={styles.previewTitle}>
                  {previewEntry.sourceFileNames[index] ?? `画像 ${index + 1}`}
                </p>
                <img
                  src={preview}
                  alt={
                    previewEntry.sourceFileNames[index] ?? `画像 ${index + 1}`
                  }
                  className={styles.previewImg}
                />
              </article>
            ))}
          </div> */}
        </div>
      )}

      {showCropDialog && (
        <ImageCropDialog
          imageUrls={slots.map(s => s.objectUrl)}
          initialCropStates={slots.map(s => ({
            crop: s.cropState.crop,
            zoom: s.cropState.zoom,
            cropPixels: s.cropState.cropPixels ?? null,
          }))}
          onCancel={() => setShowCropDialog(false)}
          onConfirm={handleCropConfirm}
        />
      )}
    </section>
  )
}

export default Component
