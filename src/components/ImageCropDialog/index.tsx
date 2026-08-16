import { useEffect, useState } from "react"
import CropSlot, { type SlotCropState } from "@/components/CropSlot"
import Overlay from "@/components/Overlay"
import Loading from "@/components/Loading"
import {
  createProcessedImages,
  getSlotDefs,
} from "@/lib/image/postImageProcessing"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * 複数画像クロップをまとめて確定するダイアログコンポーネント。
 *
 * 責務と処理概要:
 * - 画像枚数に応じたスロット定義で `CropSlot` を並べる。
 * - 全スロットのクロップ完了を確認してから画像処理を実行する。
 * - 処理中は閉じ操作を抑止し、オーバーレイで進行状態を示す。
 */

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

/**
 * 画像クロップダイアログを描画する。
 *
 * Input:
 * - `imageUrls`: クロップ対象画像 URL 配列
 * - `initialCropStates`: 初期クロップ状態配列
 * - `onConfirm`: 画像処理完了時コールバック
 * - `onCancel`: キャンセル時コールバック
 *
 * Output:
 * - オーバーレイ上のクロップ調整 UI
 *
 * 例:
 * - 入力: 2枚の画像 URL
 * - 出力: 2 スロットのクロップダイアログ
 */
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

  /**
   * 指定インデックスのクロップ状態を更新する。
   *
   * Input:
   * - `idx`: 対象スロット index
   * - `state`: 新しいクロップ状態
   *
   * Output:
   * - 返り値なし（`cropStates` を更新）
   */
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

  /**
   * 全スロットの切り抜き状態を使って画像処理を実行し、親へ結果を返す。
   *
   * 失敗時の方針:
   * - 例外はログ出力し、処理中状態だけ解除してユーザーが再試行できるようにする。
   *
   * Output:
   * - 返り値なし（`onConfirm` を呼び出し）
   */
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
      contentClassName={ui["width-xl"]}
    >
      {isProcessing && <Loading overlay message="画像を処理中..." />}
      <div className={`${ui["base-card"]} ${ui["dialog-card"]}`}>
        <h3 className={styles.title}>画像を調整</h3>
        <p className={styles.caption}>
          1200 x 630 の範囲で配置と拡大率を調整します。
        </p>

        <div
          className={`${styles["composite-area"]} ${styles[`layout${count}`]}`}
        >
          {slotDefs.map((def, i) => (
            <div
              key={i}
              style={{ gridArea: `slot${i}` }}
              className={styles["slot-container"]}
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
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
            onClick={onCancel}
            disabled={isProcessing}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
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
