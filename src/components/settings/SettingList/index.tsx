/**
 * 設定一覧コンポーネント。
 *
 * 責務と処理概要:
 * - 設定値ごとの「ラベル・説明文・トグルスイッチ」を1行にまとめ、`ComponentList` を用いて
 *   縦に並べる。
 * - 各設定値の state・永続化・連動ルールは呼び出し元（`Settings` など）に委ね、
 *   このコンポーネントは表示と `onCheckedChange` の橋渡しのみを担う。
 */
import ComponentList from "@/components/common/ComponentList"
import ToggleSwitch from "@/components/common/ToggleSwitch"
import styles from "./index.module.css"

export type SettingListItem = {
  /** 一覧内での一意なキー（React key および ToggleSwitch の id に使用） */
  key: string
  /** 設定値のラベル */
  label: string
  /** 設定値の説明文 */
  description: string
  /** 現在の ON/OFF 値 */
  checked: boolean
  /** 値が変化した後に呼ばれるコールバック */
  onCheckedChange: (next: boolean) => void
  /** true の場合、トグルを操作不能にする */
  disabled?: boolean
}

type SettingListRowProps = {
  item: SettingListItem
}

/**
 * 設定1件分（ラベル・説明文・トグルスイッチ）を描画する。
 *
 * Input:
 * - `item`: 表示・操作対象の設定値
 *
 * Output:
 * - ラベル・説明文とトグルスイッチを横並びにした行
 *
 * 例:
 * - 入力: `{ key: "pinnedFormDisabled", label: "...", description: "...", checked: false, onCheckedChange }`
 * - 出力: OFF状態のトグル付き設定行
 */
const SettingListRow = ({ item }: SettingListRowProps) => {
  const inputId = `setting-${item.key}`

  return (
    <div className={styles.row}>
      <label className={styles.text} htmlFor={inputId}>
        <span className={styles.label}>{item.label}</span>
        <span className={styles.description}>{item.description}</span>
      </label>
      <ToggleSwitch
        id={inputId}
        checked={item.checked}
        disabled={item.disabled}
        label=""
        aria-label={item.label}
        onCheckedChange={item.onCheckedChange}
      />
    </div>
  )
}

type Props = {
  items: SettingListItem[]
  className?: string
}

/**
 * 設定値一覧を縦に並べて描画する。
 *
 * Input:
 * - `items`: 表示する設定値の配列
 * - `className`: 追加の className
 *
 * Output:
 * - `items` の順に並んだ、区切り線付きの設定行一覧
 *
 * 例:
 * - 入力: `{ items: [{ key: "pinnedFormDisabled", label: "投稿フォームを固定表示しない", description: "...", checked: false, onCheckedChange }] }`
 * - 出力: ラベル・説明文・トグルスイッチが並んだ設定一覧
 */
export const SettingList = ({ items, className }: Props) => {
  const containerClassName = className
    ? `${styles.list} ${className}`
    : styles.list

  return (
    <ComponentList
      itemComponent={SettingListRow}
      getItemKey={item => item.key}
      className={containerClassName}
      items={items}
    />
  )
}

export default SettingList
