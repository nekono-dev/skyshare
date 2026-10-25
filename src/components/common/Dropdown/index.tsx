import { useT } from "@/lib/i18n/react"
import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { flushSync } from "react-dom"
import ComponentList from "@/components/common/ComponentList"
import ListboxOption from "@/components/common/ListboxOption"
import { filterOptions } from "@/util/listbox/filter"
import {
  findPrefixIndex,
  firstEnabledIndex,
  indexOfEnabled,
  lastEnabledIndex,
  nextEnabledIndex,
} from "@/util/listbox/navigation"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * アプリ共通のプルダウン（単一選択）。
 *
 * 責務と処理概要:
 * - トリガー（現在値表示）・開閉・キーボード操作・検索モード・配置の向きの決定・
 *   スクロール追従を担う。
 * - パネルはトリガーと同じ親（外枠）の中に `position: absolute` で置く。画面のスクロール・
 *   ソフトウェアキーボードによるビューポートの変化への追従はブラウザに任せ、座標は計算しない
 *   （JSで座標を持つと、iOSでキーボード表示中にトリガーとずれるため）。
 *   親の `overflow` による見切れは、外枠に付ける `data-dropdown` を目印に
 *   `ui.module.css` が祖先の `overflow` を解除して防ぐ。
 * - 検索付き（`searchable`）では、トリガー自身が入力欄（`<input>`）になる。パネルは入力欄を
 *   持たず、一覧だけを表示する。1回目の操作で一覧モードで開き（ソフトウェアキーボードは出さない）、
 *   開いたまま再操作すると検索モードに入り、トリガーへ入力した文字でパネルが絞り込まれる。
 * - 選択肢1行は `ListboxOption`、反復描画は `ComponentList` に委譲する。
 * - 選択肢の中身（ReactNode）や値の型変換は関知しない。値は常に文字列で、
 *   型変換は各ラッパー（LanguageSelect など）が行う。
 * - WAI-ARIA の combobox（select-only）+ listbox パターンに従う。
 */

export type DropdownOption = {
  /** 呼び出し側へ返す値。空文字列も有効な値として扱う */
  value: string
  /** アクセシビリティ名・既定の絞り込み対象・先頭一致検索の対象 */
  label: string
  /** 一覧での表示内容。未指定なら label */
  content?: React.ReactNode
  /** トリガー（現在値）での表示内容（検索なしのみ）。未指定なら content、それも無ければ label */
  triggerContent?: React.ReactNode
  /**
   * 検索トリガー（入力欄）に表示する現在値の文字列（検索付きのみ）。
   * 入力欄にはReactNodeを描けないため、国旗絵文字など文字列で表せる装飾はここに含める。未指定なら label
   */
  inputText?: string
  /** 絞り込み対象に追加する文字列（例: 言語コード） */
  searchText?: string
  disabled?: boolean
}

type Props = {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  disabled?: boolean
  /** 検索の有無。true の場合、トリガー自身が入力欄になる。既定 false */
  searchable?: boolean
  /** 現在値が options に無い場合のトリガー表示。未指定なら value 自体を表示 */
  placeholder?: string
  /** 検索モードで入力待ちのときのトリガーの placeholder */
  searchPlaceholder?: string
  /** 検索モードで入力が空のときにパネルへ出す文言（0件の emptyText とは別） */
  searchPromptText?: string
  /** 検索で該当項目が0件のときの文言 */
  emptyText?: string
  /** true の場合、トリガー幅を選択内容に合わせる。既定は固定幅 */
  autoWidth?: boolean
  className?: string
  id?: string
  ariaLabel?: string
}

/** 開いたときに決める、パネルの向きと一覧の最大高さ */
type PanelLayout = {
  vertical: "bottom" | "top"
  horizontal: "right" | "left"
  /** 一覧（スクロール領域）の最大高さ(px) */
  maxHeight: number
}

/** トリガーとパネルの間隔(px)。CSS の `.panel` の `4px` と同値 */
const GAP_PX = 4
/** 一覧に同時に表示する最大行数。これを超える選択肢は一覧内をスクロールして見る */
const MAX_VISIBLE_ROWS = 5
/** 行の実寸が測れない場合の一覧の最大高さ(px) */
const FALLBACK_MAX_LIST_HEIGHT_PX = 160
/** 画面が極端に狭い場合でも確保する一覧の最低高さ(px) */
const MIN_LIST_HEIGHT_PX = 96
/** 範囲の端の余白(px) */
const EDGE_MARGIN_PX = 8
/** 先頭一致検索の連続入力を1つの文字列として扱う時間(ms) */
const TYPEAHEAD_RESET_MS = 600

/** 一覧から選ぶ通常の状態（list）と、トリガーへ入力して絞り込む状態（search） */
type Mode = "list" | "search"

type OptionRowProps = {
  item: DropdownOption
  index: number
  listboxId: string
  isActive: boolean
  isSelected: boolean
  onHover: (index: number) => void
  onSelect: (item: DropdownOption) => void
}

/**
 * 選択肢1件を `ListboxOption` で描画する行。
 *
 * Input: `item` 選択肢 / `index` 表示中一覧でのindex / `isActive`・`isSelected` 表示状態
 * Output: 選択肢の行（`content` 未指定なら `label`）
 */
const DropdownOptionRow: React.FC<OptionRowProps> = ({
  item,
  index,
  listboxId,
  isActive,
  isSelected,
  onHover,
  onSelect,
}) => (
  <ListboxOption
    id={`${listboxId}-option-${index}`}
    isActive={isActive}
    isSelected={isSelected}
    disabled={item.disabled}
    onHover={() => onHover(index)}
    onSelect={() => onSelect(item)}
  >
    <span className={styles["option-body"]}>{item.content ?? item.label}</span>
  </ListboxOption>
)

/**
 * 配置に使える縦方向の範囲を返す。
 *
 * 処理の趣旨: ビューポート（`visualViewport`）と、トリガーの祖先のうち
 * `overflow-y: auto|scroll` のスクロール枠の共通部分。パネルがスクロール枠の外へ
 * はみ出して見えなくならないよう、向きと高さをこの範囲で決める。
 *
 * Input: `trigger` トリガー要素
 * Output: レイアウトビューポート座標の `{ top, bottom }`
 */
const visibleVerticalBounds = (
  trigger: HTMLElement,
): { top: number; bottom: number } => {
  const vv = window.visualViewport
  let top = vv?.offsetTop ?? 0
  let bottom = top + (vv?.height ?? window.innerHeight)
  for (
    let el = trigger.parentElement;
    el && el !== document.body;
    el = el.parentElement
  ) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === "auto" || overflowY === "scroll") {
      const rect = el.getBoundingClientRect()
      top = Math.max(top, rect.top)
      bottom = Math.min(bottom, rect.bottom)
    }
  }
  return { top, bottom }
}

/**
 * プルダウンを描画する。
 *
 * Input:
 * - `value`: 現在値
 * - `options`: 選択肢一覧
 * - `onChange`: 確定時に値を渡すコールバック（同じ値の再選択でも呼ぶ）
 * - `searchable`: 検索の有無（トリガーが入力欄になる）
 * - その他: 表示・属性制御
 *
 * Output:
 * - トリガー（検索なしはボタン、検索付きは入力欄）と、開いている間のパネル。
 *   サーバー描画時は閉じた状態のトリガーのみ。
 *
 * 例:
 * - 入力: `{ value: "ja", options: [{ value: "ja", label: "日本語" }], onChange: fn }`
 * - 出力: 「日本語」を表示するトリガー
 */
export const Dropdown: React.FC<Props> = ({
  value,
  options,
  onChange,
  disabled = false,
  searchable = false,
  placeholder,
  searchPlaceholder,
  searchPromptText,
  emptyText,
  autoWidth = false,
  className,
  id,
  ariaLabel,
}) => {
  const { t } = useT()
  const resolvedSearchPlaceholder =
    searchPlaceholder ?? t("common.dropdown.searchPlaceholder")
  const resolvedSearchPromptText =
    searchPromptText ?? t("common.dropdown.searchPrompt")
  const resolvedEmptyText = emptyText ?? t("common.dropdown.empty")
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("list")
  const [activeIndex, setActiveIndex] = useState(-1)
  // 検索モードのトリガー入力値
  const [query, setQuery] = useState("")
  // 向き・一覧の最大高さ。開いた直後の配置確定まで null（不可視で描画して実寸を測る）
  const [layout, setLayout] = useState<PanelLayout | null>(null)
  // 検索なしは button、検索付きは input。どちらも focus/getBoundingClientRect だけを使う
  const triggerRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sizerRef = useRef<HTMLDivElement>(null)
  const typeaheadRef = useRef({ text: "", timer: 0 })
  // キーボード操作によるactiveIndex変更のときだけ一覧をスクロール追従させる
  const isKeyboardNavRef = useRef(false)
  // パネル内を最後に押した時刻。blur の原因が選択肢の操作かどうかの判定に使う
  const panelPointerAtRef = useRef(0)
  const modeRef = useRef<Mode>("list")
  const queryRef = useRef("")
  const listboxId = useId()

  modeRef.current = mode
  queryRef.current = query

  const selectedOption = options.find(option => option.value === value)
  // 検索モードは入力が空の間は候補を出さない（0件と同じ枠で入力待ちの文言を出す）
  const visibleOptions = useMemo(() => {
    if (mode !== "search") return options
    return query.trim() === "" ? [] : filterOptions(options, query)
  }, [mode, options, query])
  const selectedInputText =
    selectedOption?.inputText ?? selectedOption?.label ?? placeholder ?? value
  const triggerContent = selectedOption
    ? (selectedOption.triggerContent ??
      selectedOption.content ??
      selectedOption.label)
    : (placeholder ?? value)

  const optionDomId = (index: number) => `${listboxId}-option-${index}`

  /**
   * パネルを開く。
   *
   * 処理の趣旨: 一覧モードでは選択中の項目（無ければ先頭の有効項目）をアクティブにする。
   * 検索モードで開く場合は、入力済みの文字列から始める（閉じている間の文字キー入力）。
   *
   * Input: `nextMode` 開くモード / `initialQuery` 検索モードの初期入力
   */
  const openPanel = (nextMode: Mode = "list", initialQuery = "") => {
    if (disabled) return
    setLayout(null)
    isKeyboardNavRef.current = true
    setMode(nextMode)
    setQuery(initialQuery)
    setActiveIndex(
      nextMode === "list"
        ? indexOfEnabled(options, value)
        : firstEnabledIndex(filterOptions(options, initialQuery)),
    )
    setOpen(true)
  }

  /**
   * 検索モードに入る。パネルは閉じない。
   *
   * 処理の趣旨: 一覧モードの入力欄は常に編集可能な入力欄のまま inputMode="none"
   * （ソフトウェアキーボードを出さない）にしている。タップ（ユーザー操作）の中で
   * inputMode を "text" へ DOM に直接書き換え、再フォーカスしてキーボードを出す。
   * （readOnly の切り替えは iOS でキーボードが出ないことがあるため使わない）
   *
   * Input: `initialQuery` 最初から入力済みにする文字列
   */
  const enterSearch = (initialQuery = "") => {
    // 再描画を待たず、タップの中で同期的に inputMode を切り替える
    triggerRef.current?.setAttribute("inputmode", "text")
    flushSync(() => {
      setMode("search")
      setQuery(initialQuery)
      setActiveIndex(
        initialQuery === ""
          ? -1
          : firstEnabledIndex(filterOptions(options, initialQuery)),
      )
    })
    const el = triggerRef.current
    el?.blur()
    el?.focus({ preventScroll: true })
  }

  /**
   * パネルを閉じる。入力は破棄し、トリガーは直前の選択項目の表示に戻る。
   *
   * Input: `returnFocus` トリガーへフォーカスを戻すか
   */
  const close = (returnFocus: boolean) => {
    const el = triggerRef.current
    const wasSearching = searchable && mode === "search"
    setOpen(false)
    setMode("list")
    setQuery("")
    if (wasSearching && el) {
      // 検索モードで開いたソフトウェアキーボードと入力状態を確実に閉じるため、
      // inputMode を戻してから一度フォーカスを外す（iOS は外側タップでは外れない）
      el.setAttribute("inputmode", "none")
      el.blur()
    }
    if (returnFocus) {
      el?.focus({ preventScroll: true })
    } else if (el && document.activeElement === el) {
      // パネル外の操作（スクロールバーのクリックなど、ブラウザがフォーカスを外さない操作を含む）で
      // 閉じるときは、入力欄にフォーカスとキャレットを残さない（閉じたのに入力中に見えるのを防ぐ）
      el.blur()
    }
  }

  /**
   * 検索モード中に入力欄のフォーカスが外れたときの処理。
   *
   * 処理の趣旨: iOS のキーボードの完了（チェックマーク）ではフォーカスだけが外れる。
   * 入力が空（検索待ちのまま）なら一覧モードへ戻す（パネルは開いたまま）。入力済みなら
   * 入力と絞り込み結果を残す。選択肢の操作による blur、再フォーカス
   * （検索モードへの遷移・close）では何もしない。
   */
  const handleTriggerBlur = () => {
    window.setTimeout(() => {
      if (!searchable || modeRef.current !== "search") return
      if (document.activeElement === triggerRef.current) return
      if (Date.now() - panelPointerAtRef.current < 500) return
      // 入力済みなら、入力と絞り込み結果はそのまま残す（候補を選ぶ操作が続くため）
      if (queryRef.current.trim() !== "") return
      setMode("list")
      setQuery("")
      isKeyboardNavRef.current = true
      setActiveIndex(indexOfEnabled(options, value))
    }, 0)
  }

  /** 選択肢を確定して閉じる。無効項目は何もしない */
  const commit = (option: DropdownOption) => {
    if (option.disabled) return
    onChange(option.value)
    close(true)
  }

  /**
   * 一覧内で指定indexの項目が完全に見えるよう、scrollTopを最小限動かす。
   *
   * 処理の趣旨: `scrollIntoView` は祖先（ページ）までスクロールするため使わず、
   * 一覧コンテナのscrollTopだけを直接調整する。
   */
  const ensureVisible = (index: number) => {
    const list = listRef.current
    const el = list?.querySelector<HTMLElement>(
      `#${CSS.escape(optionDomId(index))}`,
    )
    if (!list || !el) return
    if (el.offsetTop < list.scrollTop) {
      list.scrollTop = el.offsetTop
    } else if (
      el.offsetTop + el.offsetHeight >
      list.scrollTop + list.clientHeight
    ) {
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight
    }
  }

  // 配置の決定: 開いた直後（ペイント前）に一度だけ、向きと一覧の最大高さを決める。
  // 座標は持たない。以後のスクロール・キーボードへの追従はブラウザ任せ
  // （絞り込みで一覧が縮んでも、上向きは下端基準で配置されるため向きは変えない）
  useLayoutEffect(() => {
    if (!open || layout) return
    const trigger = triggerRef.current
    const panel = panelRef.current
    const list = listRef.current
    if (!trigger || !panel || !list) return

    const rect = trigger.getBoundingClientRect()
    const bounds = visibleVerticalBounds(trigger)
    const below = bounds.bottom - rect.bottom - GAP_PX - EDGE_MARGIN_PX
    const above = rect.top - bounds.top - GAP_PX - EDGE_MARGIN_PX

    // 枠線の高さ（パネルに入力欄は無い）。一覧のmax-height適用状態によらず一定
    const chrome = panel.offsetHeight - list.offsetHeight
    // 一覧の最大高さ = 先頭 MAX_VISIBLE_ROWS 行の実高さの合計（行の高さが揃っていなくてもよい）。
    // 行の実寸は、全選択肢を不可視で描画している sizer から測る
    const rows = Array.from(sizerRef.current?.children ?? []).slice(
      0,
      MAX_VISIBLE_ROWS,
    )
    const maxListPx =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + (row as HTMLElement).offsetHeight, 0)
        : FALLBACK_MAX_LIST_HEIGHT_PX
    const wanted = chrome + Math.min(list.scrollHeight, maxListPx)

    // 下に収まるなら下。収まらず、上の方が広い場合のみ上へ反転する
    const vertical = below < wanted && above > below ? "top" : "bottom"
    const space = vertical === "top" ? above : below
    const maxHeight = Math.max(
      Math.min(MIN_LIST_HEIGHT_PX, maxListPx),
      Math.min(maxListPx, space - chrome),
    )

    // 横: トリガーの右端に揃える。左へはみ出す場合だけ左端に揃える
    const width = panel.offsetWidth
    const horizontal =
      rect.right - width < EDGE_MARGIN_PX &&
      rect.left + width <= window.innerWidth - EDGE_MARGIN_PX
        ? "left"
        : "right"

    setLayout({ vertical, horizontal, maxHeight })
  }, [open, layout])

  // 配置確定直後: 選択中項目へスクロールする
  useLayoutEffect(() => {
    if (!open || !layout) return
    if (activeIndex >= 0) ensureVisible(activeIndex)
    // 開いた直後（layoutが決まった時）だけ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, layout === null])

  // キーボード操作でアクティブ項目が変わったとき、一覧内で見える位置へ追従する
  useLayoutEffect(() => {
    if (!open || !isKeyboardNavRef.current || activeIndex < 0) return
    ensureVisible(activeIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  // パネル外のpointerdownで閉じる（トリガーはクリック側の処理に任せる）
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      close(false)
    }
    document.addEventListener("pointerdown", handlePointerDown, true)
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 開いたまま無効化されたら閉じる
  useEffect(() => {
    if (disabled) close(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  useEffect(() => () => window.clearTimeout(typeaheadRef.current.timer), [])

  /** 連続入力を1つの文字列として扱い、先頭一致する項目へアクティブを移す */
  const typeahead = (key: string) => {
    window.clearTimeout(typeaheadRef.current.timer)
    typeaheadRef.current.text += key
    typeaheadRef.current.timer = window.setTimeout(() => {
      typeaheadRef.current.text = ""
    }, TYPEAHEAD_RESET_MS)
    const index = findPrefixIndex(
      visibleOptions,
      typeaheadRef.current.text,
      activeIndex,
    )
    if (index >= 0) {
      isKeyboardNavRef.current = true
      setActiveIndex(index)
    }
  }

  /**
   * トリガーのキーダウン処理。
   *
   * 処理の趣旨: IME変換中は何もしない（ただし検索付きの一覧モードでのIME開始は検索モードへ
   * 入るきっかけにする）。閉じている間は開く操作、開いている間は移動・確定・閉じる・
   * 先頭一致検索（検索なし）・検索モードへの遷移（検索付き）を扱う。
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isImeKey = e.nativeEvent.isComposing || e.keyCode === 229
    if (isImeKey) {
      // 一覧モードのままではIME入力が現在値の文字列に混ざるため、検索モードへ切り替えて続行させる
      if (searchable && open && mode === "list") enterSearch()
      return
    }

    const isCharKey =
      e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey

    if (!open) {
      if (
        ["Enter", "ArrowDown", "ArrowUp"].includes(e.key) ||
        (e.key === " " && !searchable)
      ) {
        e.preventDefault()
        openPanel()
      } else if (searchable && isCharKey) {
        // 閉じている間の文字キーは、検索モードで開いてその文字を入力として扱う
        e.preventDefault()
        openPanel("search", e.key)
      }
      return
    }

    const moveTo = (index: number) => {
      isKeyboardNavRef.current = true
      setActiveIndex(index)
    }
    const commitActive = () => {
      if (activeIndex >= 0 && visibleOptions[activeIndex]) {
        commit(visibleOptions[activeIndex])
      }
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        moveTo(nextEnabledIndex(visibleOptions, activeIndex, 1))
        return
      case "ArrowUp":
        e.preventDefault()
        moveTo(nextEnabledIndex(visibleOptions, activeIndex, -1))
        return
      case "Home":
        // 検索モードでは入力欄のカーソル移動を優先する
        if (mode === "search") return
        e.preventDefault()
        moveTo(firstEnabledIndex(visibleOptions))
        return
      case "End":
        if (mode === "search") return
        e.preventDefault()
        moveTo(lastEnabledIndex(visibleOptions))
        return
      case "Enter":
        // 確定できる候補が無ければ何もしない（開いたまま。直前の選択項目のまま）
        e.preventDefault()
        commitActive()
        return
      case " ":
        // 一覧モード（検索なし）のSpaceは確定。検索付きでは入力文字として扱う
        if (searchable) break
        e.preventDefault()
        commitActive()
        return
      case "Escape":
        // 親モーダルのEscまで発火させない
        e.preventDefault()
        e.stopPropagation()
        close(true)
        return
      case "Tab":
        // 確定はしない。フォーカスは自然に移動させる
        close(false)
        return
    }

    if (!isCharKey) return
    if (!searchable) {
      typeahead(e.key)
    } else if (mode === "list") {
      // 一覧モードへの文字キーは、検索モードへ入ってその文字を入力として扱う
      e.preventDefault()
      enterSearch(e.key)
    }
  }

  const activeId =
    open && activeIndex >= 0 && visibleOptions[activeIndex]
      ? optionDomId(activeIndex)
      : undefined

  return (
    <span
      className={[ui["select-wrapper"], autoWidth && ui["select-wrapper-auto"]]
        .filter(Boolean)
        .join(" ")}
      // 目印。ui.module.css が、この要素と祖先の overflow を解除してパネルの見切れを防ぐ
      data-dropdown=""
    >
      {autoWidth && (
        <span className={ui["select-sizer"]} aria-hidden>
          {searchable ? (
            // 現在値と placeholder を同じセルに重ね、広い方に幅を合わせる
            // （検索モードで placeholder が見切れず、入るときに幅が変わらない）
            <span className={styles["sizer-stack"]}>
              <span>{selectedInputText}</span>
              <span>{resolvedSearchPlaceholder}</span>
            </span>
          ) : (
            triggerContent
          )}
        </span>
      )}
      {searchable ? (
        <input
          type="text"
          ref={triggerRef as React.RefObject<HTMLInputElement>}
          id={id}
          className={[
            ui["base-select"],
            styles.trigger,
            autoWidth && styles["trigger-auto"],
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          // 開いている間は一覧モードでも入力待ち（placeholder）を見せる。閉じている間は現在値
          value={open ? query : selectedInputText}
          placeholder={resolvedSearchPlaceholder}
          // 一覧モードでもテキストボックスのまま、キーボードだけ出さない
          // （検索モードに入る再操作で inputMode を "text" にする）
          inputMode={mode === "list" ? "none" : "text"}
          autoComplete="off"
          disabled={disabled}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={ariaLabel}
          aria-activedescendant={activeId}
          onClick={() => {
            if (disabled) return
            if (!open) openPanel()
            else if (mode === "list") enterSearch()
          }}
          onChange={e => {
            const next = e.target.value
            // 貼り付けなどキー入力以外の変更でも、一覧モードから検索モードへ移る
            setMode("search")
            setQuery(next)
            isKeyboardNavRef.current = true
            setActiveIndex(firstEnabledIndex(filterOptions(options, next)))
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleTriggerBlur}
        />
      ) : (
        <button
          type="button"
          ref={triggerRef as React.RefObject<HTMLButtonElement>}
          id={id}
          className={[
            ui["base-select"],
            styles.trigger,
            autoWidth && styles["trigger-auto"],
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={ariaLabel}
          aria-activedescendant={activeId}
          onClick={() => (open ? close(false) : openPanel())}
          onKeyDown={handleKeyDown}
          // Spaceのclickはkeyupで発火するため、keydownで開いた直後に閉じ直さないよう抑止する
          onKeyUp={e => {
            if (e.key === " ") e.preventDefault()
          }}
        >
          {triggerContent}
        </button>
      )}
      {open && (
        <div
          ref={panelRef}
          className={styles.panel}
          data-vertical={layout?.vertical ?? "bottom"}
          data-horizontal={layout?.horizontal ?? "right"}
          // 配置確定までは不可視で描画して実寸を測る
          style={{ visibility: layout ? undefined : "hidden" }}
          onPointerDownCapture={() => {
            panelPointerAtRef.current = Date.now()
          }}
        >
          {/* 幅の算出専用。全選択肢を不可視・高さ0で描画し、パネル幅を
              「全選択肢のうち最も広いもの」にする（絞り込みで幅が変わらない） */}
          <div ref={sizerRef} className={styles.sizer} aria-hidden>
            {options.map(option => (
              <div key={option.value} className={styles["sizer-row"]}>
                <span className={styles["option-body"]}>
                  {option.content ?? option.label}
                </span>
              </div>
            ))}
          </div>
          <div
            id={listboxId}
            ref={listRef}
            role="listbox"
            className={styles.list}
            style={{ maxHeight: layout?.maxHeight }}
          >
            {visibleOptions.length === 0 ? (
              <p role="status" className={styles.empty}>
                {mode === "search" && query.trim() === ""
                  ? resolvedSearchPromptText
                  : resolvedEmptyText}
              </p>
            ) : (
              <ComponentList
                items={visibleOptions}
                itemComponent={DropdownOptionRow}
                getItemProps={(item, index) => ({
                  index,
                  listboxId,
                  isActive: index === activeIndex,
                  isSelected: item.value === value,
                  onHover: (i: number) => {
                    isKeyboardNavRef.current = false
                    setActiveIndex(i)
                  },
                  onSelect: commit,
                })}
                getItemKey={item => item.value}
              />
            )}
          </div>
        </div>
      )}
    </span>
  )
}

export default Dropdown
