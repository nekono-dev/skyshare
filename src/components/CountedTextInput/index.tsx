import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * テキスト入力に付随する1つの文字数カウンタの定義。
 * カウント方法は呼び出し側から関数としてデリゲートする。
 */
export type CounterSpec = {
  /** counters配列内で一意なキー（React keyにも使用） */
  key: string
  /** カウンタ末尾に表示するラベル（例: "X", "Bluesky", "見出し"） */
  label: string
  /** 文字列を渡すとカウント数を返す関数 */
  count: (text: string) => number
  /** 表示上の分母、かつ横幅算出の基準となる「最大文字数想定」 */
  maxAssumed: number
  /** この値を超えたらwarn状態にする（省略時はwarn判定なし） */
  warnAt?: number
  /** この値を超えたらerror状態にする（省略時はerror判定なし） */
  errorAt?: number
}

type Props = {
  id?: string
  name?: string
  value: string
  onChange: (next: string) => void
  /** trueで<textarea>、false/未指定で<input type="text"> */
  multiline?: boolean
  /** multiline時のみ有効。デフォルト6 */
  rows?: number
  placeholder?: string
  disabled?: boolean
  /** 0件以上。要素数がそのままカウンタ表示個数になる */
  counters?: CounterSpec[]
}

type CounterState = "normal" | "warn" | "error"
const STATE_RANK: Record<CounterState, number> = {
  normal: 0,
  warn: 1,
  error: 2,
}

const resolveCounterState = (
  count: number,
  spec: CounterSpec,
): CounterState => {
  if (spec.errorAt !== undefined && count > spec.errorAt) return "error"
  if (spec.warnAt !== undefined && count > spec.warnAt) return "warn"
  return "normal"
}

const resolveAggregateState = (
  value: string,
  counters: CounterSpec[],
): CounterState =>
  counters.reduce<CounterState>((worst, spec) => {
    const state = resolveCounterState(spec.count(value), spec)
    return STATE_RANK[state] > STATE_RANK[worst] ? state : worst
  }, "normal")

const isFullWidthChar = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  )
}

const estimateDisplayWidthCh = (text: string): number =>
  Array.from(text).reduce((sum, c) => sum + (isFullWidthChar(c) ? 2 : 1), 0)

/**
 * カウンタ1個の表示幅（ch単位）を「最大文字数想定」の桁数から算出する。
 * "{count}/{maxAssumed}:{label}" が取りうる最大幅を固定確保し、
 * 実カウント値が増減してもテキストボックス・カウンタの幅が変動しないようにする。
 */
const computeCounterCellWidthCh = (spec: CounterSpec): number => {
  const maxDigits = String(spec.maxAssumed).length
  return maxDigits * 2 + 2 + estimateDisplayWidthCh(spec.label)
}

/**
 * テキスト入力（1行/複数行）と、複数配置可能な文字数カウンタを一体化したコンポーネント。
 *
 * Input:
 * - `multiline`: falseなら<input>、trueなら<textarea>
 * - `counters`: カウント方法・上限値をデリゲートする定義の配列（0件以上）
 *
 * Output:
 * - テキスト入力欄と、その右端（1行）/右下（複数行）に固定幅で並ぶカウンタ群
 *
 * 例:
 * - 入力: `{ multiline: true, counters: [{ key: "bsky", label: "Bluesky", count: countGraphemes, maxAssumed: 300, errorAt: 300 }] }`
 * - 出力: 複数行テキストエリア + 右下に "12/300:Bluesky" 形式のカウンタ
 */
const Component: React.FC<Props> = ({
  id,
  name,
  value,
  onChange,
  multiline = false,
  rows = 6,
  placeholder,
  disabled,
  counters = [],
}) => {
  const aggregateState = resolveAggregateState(value, counters)
  const aggregateClass =
    aggregateState === "error"
      ? styles["counters-error"]
      : aggregateState === "warn"
        ? styles["counters-warn"]
        : ""

  const wrapperClass = [
    ui["base-input-box"],
    styles.wrapper,
    multiline ? styles["wrapper-multiline"] : styles["wrapper-single-line"],
  ].join(" ")
  const fieldClass = [
    ui["base-input-field"],
    styles.field,
    multiline ? styles["field-multiline"] : styles["field-single-line"],
  ].join(" ")

  return (
    <div className={wrapperClass}>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          className={fieldClass}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          name={name}
          type="text"
          className={fieldClass}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
        />
      )}
      {counters.length > 0 && (
        <div
          className={[
            styles.counters,
            aggregateClass,
            multiline
              ? styles["counters-row-multiline"]
              : styles["counters-row-single-line"],
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {counters.map(spec => (
            <span
              key={spec.key}
              className={styles["counter-item"]}
              style={{ width: `${computeCounterCellWidthCh(spec)}ch` }}
            >
              {spec.count(value)}/{spec.maxAssumed}:{spec.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default Component
