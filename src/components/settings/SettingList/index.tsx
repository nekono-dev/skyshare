/**
 * 設定一覧コンポーネント。
 *
 * 責務と処理概要:
 * - 設定値ごとの「ラベル・説明文・トグルスイッチ」を1行にまとめ、`ComponentList` を用いて
 *   縦に並べる。
 * - 各設定値の state・永続化・連動ルールは呼び出し元（`Settings` など）に委ね、
 *   このコンポーネントは表示と `onCheckedChange` の橋渡しのみを担う。
 */
import type React from "react"
import ComponentList from "@/components/common/ComponentList"
import CountedTextInput from "@/components/common/CountedTextInput"
import ToggleSwitch from "@/components/common/ToggleSwitch"
import styles from "./index.module.css"

export type SettingListItem = {
  /** 一覧内での一意なキー（React key および ToggleSwitch の id に使用） */
  key: string
  /** 設定値のラベル（文中にInlineIconなどを埋め込む場合はReactNodeを渡す） */
  label: React.ReactNode
  /** 設定値の説明文（文中にInlineIconなどを埋め込む場合はReactNodeを渡す） */
  description: React.ReactNode
  /** 現在の ON/OFF 値 */
  checked: boolean
  /** 値が変化した後に呼ばれるコールバック */
  onCheckedChange: (next: boolean) => void
  /** true の場合、トグルを操作不能にする */
  disabled?: boolean
  /** label が文字列でない場合のアクセシビリティ用ラベル（省略時はlabelが文字列の場合のみそれを使用） */
  ariaLabel?: string
  /**
   * true の場合、トグル行の下にテキスト入力欄を追加表示する
   * （例: 「連携を有効にする」トグル + インスタンスドメイン入力欄）。
   * true の場合は `textInputValue` / `onTextInputChange` も指定する。
   */
  textInput?: boolean
  /** textInput が true の場合のテキスト入力欄の値 */
  textInputValue?: string
  /** textInput が true の場合のテキスト入力欄の変更コールバック */
  onTextInputChange?: (next: string) => void
  /** textInput が true の場合のプレースホルダ */
  textInputPlaceholder?: string
  /**
   * textInput が true の場合の入力値バリデーション。
   * 値が空でなく、この関数が true を返す場合のみ入力欄右端にチェックマークを表示する。
   * 省略時は値が空でない限り常に妥当とみなす。
   */
  textInputValidate?: (value: string) => boolean
  /**
   * textInputValidate が false を返した場合（値が空でない場合のみ）に表示するエラー文言。
   * 省略時はエラー文言を表示しない（チェックマークが出ないだけになる）。
   */
  textInputErrorMessage?: string
  /**
   * true の場合、テキスト入力欄自体を操作不能にする。
   * 行自体の `disabled`（トグルの操作可否）とは独立させる
   * （例: トグルがドメイン未入力等の理由でdisabledでも、ドメインを
   * 入力できるようテキスト入力欄はこの値でのみ制御する。省略時は常に有効）。
   */
  textInputDisabled?: boolean
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
  const ariaLabel =
    item.ariaLabel ?? (typeof item.label === "string" ? item.label : undefined)

  const textInputValue = item.textInputValue ?? ""
  const hasTextInputValue = textInputValue.trim() !== ""
  const isTextInputValid = item.textInputValidate
    ? item.textInputValidate(textInputValue)
    : true

  return (
    <div className={styles.row}>
      <div className={styles["toggle-row"]}>
        <label className={styles.text} htmlFor={inputId}>
          <span className={styles.label}>{item.label}</span>
          <span className={styles.description}>{item.description}</span>
        </label>
        <ToggleSwitch
          id={inputId}
          checked={item.checked}
          disabled={item.disabled}
          label=""
          aria-label={ariaLabel}
          onCheckedChange={item.onCheckedChange}
        />
      </div>
      {item.textInput && (
        <div className={styles["text-input-row"]}>
          <div className={styles["text-input-wrapper"]}>
            <CountedTextInput
              id={`${inputId}-text`}
              value={textInputValue}
              onChange={next => item.onTextInputChange?.(next)}
              placeholder={item.textInputPlaceholder}
              disabled={item.textInputDisabled ?? false}
            />
            {hasTextInputValue && isTextInputValid && (
              <span className={styles["text-input-check"]} aria-hidden>
                ✓
              </span>
            )}
          </div>
          {hasTextInputValue &&
            !isTextInputValid &&
            item.textInputErrorMessage && (
              <span className={styles["text-input-error"]}>
                {item.textInputErrorMessage}
              </span>
            )}
        </div>
      )}
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
