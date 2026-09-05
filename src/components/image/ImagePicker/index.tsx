import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import ImageCropDialog from "@/components/image/ImageCropDialog"
import Loading from "@/components/common/Loading"
import type { Area } from "react-easy-crop"
import {
  computeCropAroundCenter,
  computeInitialCrop,
  createProcessedImages,
  getSlotDefs,
  loadImageSize,
} from "@/lib/image/postImageProcessing"
import ui from "@/styles/ui.module.css"
import pic from "@/images/image.svg"

/**
 * 投稿画像の選択とクロップ調整を担うコンポーネント。
 *
 * 責務と処理概要:
 * - ファイル入力から最大4枚の画像を受け取り、スロット情報を管理する。
 * - 初期クロップを算出して投稿用画像を生成し、親へ `ImageEntry` を通知する。
 * - クロップダイアログで再調整した結果を反映する。
 */

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

/**
 * 親（PostForm のペースト/ドロップ処理など）からファイルを追加投入するための命令的ハンドル。
 */
export type ImagePickerHandle = {
  addFiles: (files: File[]) => void | Promise<void>
}

/**
 * 画像ピッカー UI を描画する。
 *
 * Input:
 * - `value`: 現在の画像エントリ
 * - `onChange`: 画像エントリ更新通知
 * - `disabled`: 操作可否
 *
 * Output:
 * - 画像追加・クロップ・撤去の操作 UI
 *
 * 例:
 * - 入力: `{ value: null, disabled: false }`
 * - 出力: 画像追加ボタンとクロップ操作ボタン
 */
export const Component = forwardRef<ImagePickerHandle, Props>(
  function ImagePicker({ value, onChange, disabled = false }, ref) {
    const [slots, setSlots] = useState<ImageSlot[]>([])
    const [showCropDialog, setShowCropDialog] = useState(false)
    const [isPreparingPreview, setIsPreparingPreview] = useState(false)
    const slotsRef = useRef<ImageSlot[]>([])
    const inputId = useId()

    /**
     * 指定スロット群の object URL を解放する。
     *
     * Input:
     * - `targetSlots`: 解放対象スロット配列
     *
     * Output:
     * - 返り値なし（URL 解放を副作用として実行）
     */
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

    /**
     * 現在スロット群から投稿用 `ImageEntry` を生成して親へ通知する。
     *
     * Input:
     * - `nextSlots`: 反映後スロット配列
     *
     * Output:
     * - 返り値なし（`onChange` で `ImageEntry | null` を通知）
     *
     * 例:
     * - 入力: 2件のスロット
     * - 出力: 2件の `originalBlobs` と1件の `thumbnailBlob` を持つ `ImageEntry`
     */
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

    /**
     * 現在のレイアウト定義に合わせて各スロットの初期クロップを再計算する。
     *
     * 処理の趣旨:
     * - 画像枚数変化でスロット比率が変わるため、既存中心点をなるべく維持して切り抜き領域を再配置する。
     *
     * Input:
     * - `sourceSlots`: 再計算対象スロット
     * - `defs`: 現在枚数に対応するスロット定義
     *
     * Output:
     * - 再計算済みスロット配列
     */
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

    /**
     * ファイル群を追加し、スロットとプレビューを更新する。
     *
     * 処理の趣旨:
     * - ファイル入力の change だけでなく、ペースト/ドロップ由来のファイル追加からも
     *   共通して呼べるようにする。
     * - 追加可能枚数（最大4）を超える入力を切り詰める。
     * - 画像サイズ取得に失敗してもフォールバックでスロットは維持し、全体処理を止めない。
     *
     * Input:
     * - `newFiles`: 追加対象ファイル配列
     *
     * Output:
     * - 返り値なし（state 更新と `onChange` 通知を実行）
     */
    const addFiles = async (newFiles: File[]) => {
      if (newFiles.length === 0) return

      const allowed = Math.max(0, 4 - slots.length)
      const take = newFiles.slice(0, allowed)

      const urls = take.map(f => ({
        url: URL.createObjectURL(f),
        name: f.name,
        file: f,
      }))

      // 追加後の総枚数に対するスロット定義を算出する。
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
          // サイズ取得失敗時もスロットだけは残して後続調整を可能にする。
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
    }

    /**
     * ファイル選択イベントを処理する。
     *
     * Input:
     * - `event`: `<input type="file">` の change イベント
     *
     * Output:
     * - 返り値なし（`addFiles` へ委譲）
     */
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget
      const newFiles = input.files ? Array.from(input.files) : []
      input.value = ""
      await addFiles(newFiles)
    }

    useImperativeHandle(ref, () => ({ addFiles }))

    /**
     * クロップダイアログを開く。
     *
     * 失敗時の方針:
     * - スロット未登録時は何もせず return する。
     */
    const handleOpenCrop = () => {
      if (slots.length === 0) return
      setShowCropDialog(true)
    }

    /**
     * クロップ確定結果を state と `ImageEntry` に反映する。
     *
     * Input:
     * - `originalBlobs`: 個別画像 Blob 配列
     * - `thumbnailBlob`: サムネイル Blob
     * - `newStates`: 各スロットの新しいクロップ状態
     *
     * Output:
     * - 返り値なし（`slots`/`onChange`/ダイアログ状態を更新）
     */
    const handleCropConfirm = (
      originalBlobs: Blob[],
      thumbnailBlob: Blob,
      newStates: SlotCropState[],
    ) => {
      // 確定したクロップ状態を各スロットへ反映する。
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

    /**
     * すべての画像スロットを削除し、プレビュー状態を初期化する。
     *
     * Output:
     * - 返り値なし（URL 解放と state 初期化を実行）
     */
    const handleRemoveAll = () => {
      revokeSlotUrls(slots)
      setSlots([])
      setShowCropDialog(false)
      onChange(null)
    }

    return (
      <section>
        {isPreparingPreview && <Loading message="画像プレビューを生成中..." />}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label
            htmlFor={inputId}
            className={`${ui["base-button"]} ${ui["white-button"]} ${ui["nontext-button"]} ${ui["md-button"]}`}
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

          {slots.length > 0 && (
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
              onClick={handleOpenCrop}
              disabled={disabled}
            >
              サムネ調整
            </button>
          )}

          {slots.length > 0 && (
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
              onClick={handleRemoveAll}
              disabled={disabled}
            >
              画像撤去
            </button>
          )}
        </div>

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
  },
)

export default Component
