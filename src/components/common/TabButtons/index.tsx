import React, { useRef } from "react"
import styles from "./index.module.css"

/**
 * タブの並び（共通部品）。
 *
 * 責務と処理概要:
 * - タブを横一列に並べ、選択中のタブを太字と下線で、無効なタブを淡い文字色で表示する。
 * - 押下と、左右の矢印キー・Home・End で選択を切り替える（無効なタブは飛ばす）。
 * - タブリスト・タブの役割を付け、選択中のタブだけをキーボードのフォーカスの順序に含める。
 * - 中身（タブパネル）は呼び出し側が `panelId` / `tabId` を使って描画する。
 *
 * 利用例:
 * ```tsx
 * <TabButtons idPrefix="drafts" ariaLabel="下書き・予約" items={[{ key: "drafts", label: "下書き" }]} value={tab} onChange={setTab} />
 * <div role="tabpanel" id={panelId("drafts", "drafts")} aria-labelledby={tabId("drafts", "drafts")} hidden={tab !== "drafts"} />
 * ```
 */

export type TabItem<K extends string> = {
  key: K
  label: string
  disabled?: boolean
}

type Props<K extends string> = {
  /** 同じ画面に複数置くときの識別子の接頭辞 */
  idPrefix: string
  ariaLabel: string
  items: TabItem<K>[]
  value: K
  onChange: (next: K) => void
}

type NavKey = "ArrowLeft" | "ArrowRight" | "Home" | "End"

/** タブの要素の id。 Example: `tabId("drafts", "schedules")` → `"drafts-tab-schedules"` */
export const tabId = (idPrefix: string, key: string): string =>
  `${idPrefix}-tab-${key}`

/** タブパネルの要素の id。 Example: `panelId("drafts", "schedules")` → `"drafts-panel-schedules"` */
export const panelId = (idPrefix: string, key: string): string =>
  `${idPrefix}-panel-${key}`

/**
 * キー操作で次に選ぶタブを決める。
 *
 * Input: タブの並び、現在のタブ、押されたキー
 * Output: 次に選ぶタブの key。無効でないタブが無ければ `current` のまま
 *
 * 処理の趣旨:
 * - 左右は無効なタブを飛ばして隣へ進み、端では反対の端へ巡回する。
 * - Home は先頭の、End は末尾の、無効でないタブを選ぶ。
 *
 * Example: `[a, b(無効), c]` で `nextTabKey(items, "a", "ArrowRight")` → `"c"`
 */
export const nextTabKey = <K extends string>(
  items: TabItem<K>[],
  current: K,
  key: NavKey,
): K => {
  const enabled = items.filter(item => !item.disabled)
  if (enabled.length === 0) return current
  if (key === "Home") return enabled[0]!.key
  if (key === "End") return enabled[enabled.length - 1]!.key
  const step = key === "ArrowRight" ? 1 : -1
  const start = items.findIndex(item => item.key === current)
  // 現在のタブから1つずつ進め、無効でない最初のタブを選ぶ（1周で必ず見つかる）
  for (let i = 1; i <= items.length; i++) {
    const index =
      (((start + step * i) % items.length) + items.length) % items.length
    const item = items[index]!
    if (!item.disabled) return item.key
  }
  return current
}

const NAV_KEYS: readonly string[] = ["ArrowLeft", "ArrowRight", "Home", "End"]

export const Component = <K extends string>({
  idPrefix,
  ariaLabel,
  items,
  value,
  onChange,
}: Props<K>) => {
  const listRef = useRef<HTMLDivElement>(null)

  /**
   * キー操作で選択を移し、選んだタブへフォーカスを移す。
   * 対象の4キー以外は既定の動作（Tab キーでの移動など）に任せる。
   */
  const handleKeyDown = (event: React.KeyboardEvent, current: K) => {
    if (!NAV_KEYS.includes(event.key)) return
    event.preventDefault()
    const next = nextTabKey(items, current, event.key as NavKey)
    onChange(next)
    listRef.current
      ?.querySelector<HTMLButtonElement>(
        `#${CSS.escape(tabId(idPrefix, next))}`,
      )
      ?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={styles["tab-list"]}
    >
      {items.map(item => {
        const selected = item.key === value
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={tabId(idPrefix, item.key)}
            aria-controls={panelId(idPrefix, item.key)}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={`${styles.tab} ${selected ? styles["tab-selected"] : ""}`}
            onClick={() => onChange(item.key)}
            onKeyDown={event => handleKeyDown(event, item.key)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export default Component
