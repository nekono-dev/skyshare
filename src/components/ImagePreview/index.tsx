/**
 * 投稿画像のサムネイルプレビューを表示するコンポーネント。
 *
 * 責務と処理概要:
 * - `ImagePicker` が生成した `ImageEntry` を受け取り、サムネイルを表示する。
 * - 画像未選択時は何も描画せず、レイアウト上の責務を最小化する。
 */
import type { ImageEntry } from "@/components/ImagePicker"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  value: ImageEntry | null
}

/**
 * サムネイルプレビュー領域を描画する。
 *
 * Input:
 * - `value`: 画像選択結果。`null` の場合は未選択扱い。
 *
 * Output:
 * - サムネイル表示 UI。`value` が `null` の場合は `null`。
 *
 * 例:
 * - 入力: `{ value: null }`
 * - 出力: `null`
 */
export const Component = ({ value }: Props) => {
  if (!value) {
    return null
  }

  return (
    <section className={ui.baseCard}>
      <div className={`${ui.label}`}>サムネイル（visual: 1200x630）</div>
      <div className={ui.center}>
        <img
          src={value.thumbnailPreview}
          alt="1200x630 サムネイル"
          className={ui.preview}
        />
      </div>
    </section>
  )
}

export default Component
