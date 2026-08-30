/**
 * PostForm専用の投稿本文欄。contenteditableなdivとしてハッシュタグ/メンションを
 * インラインでハイライト表示する。
 *
 * 責務と処理概要:
 * - `value`/`onChange`は`CountedTextInput`と同型の契約（制御コンポーネント）にし、
 *   PostForm側の呼び出しコードの構造を変えずに済むようにする。
 * - `CountedTextInput`は本コンポーネント以外にも汎用的に使われるため一切変更しない。
 *   カウンタ表示ロジックはここに複製し、影響範囲を完全にこのディレクトリ配下へ閉じ込める。
 * - 表示テキストは`computeHighlightSegments`でハッシュタグ/メンションとそれ以外に分割し、
 *   Reactのjsxで宣言的に子要素を描画するのではなく、`useLayoutEffect`内で明示的にDOM操作を
 *   行う。ただしキー入力の度にDOM全体を作り直すことはしない: ブラウザは`input`イベントが
 *   発火する時点で既にネイティブに実DOMを編集済みのため、`reconcileContent`
 *   （`contentEditableReconcile.ts`）で現在の実DOMと`value`から計算すべき理想構造を比較し、
 *   一致する区間には一切触れず、差分のある区間だけを差分パッチする。こうすることで
 *   ブラウザ自身の編集操作（ひいてはネイティブUndo/Redo）をできるだけ素通しする。
 *   IME変換中(`compositionstart`〜`compositionend`)はこの同期処理自体を止め、ブラウザの
 *   ネイティブ編集に完全に委ねる（変換中のカーソル飛び・変換中断を防ぐため）。
 */
import React, { useLayoutEffect, useRef } from "react"
import {
  clampAutoGrowHeightPx,
  computeAutoGrowBounds,
  resolveLineHeightPx,
} from "@/components/common/CountedTextInput/autoGrowHeight"
import type { CounterSpec } from "@/components/common/CountedTextInput"
import {
  extractPlainText,
  resolveAnchorAwareDeleteText,
} from "@/util/textarea/contentEditableModel"
import {
  reconcileContent,
  rebuildContentFully,
} from "@/util/textarea/contentEditableReconcile"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  value: string
  onChange: (next: string) => void
  /** 初期表示行数(最小行数)。autoGrow時は自動伸長の下限としても使う */
  rows: number
  /** autoGrow時のみ有効。伸長できる最大行数（省略時は無制限に伸びる） */
  maxRows?: number
  /** true=コンテンツに合わせて高さを自動伸長する（false=固定rows+内部スクロール） */
  autoGrow?: boolean
  placeholder?: string
  disabled?: boolean
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onCompositionStart?: () => void
  onCompositionEnd?: () => void
  /** クリック/キー操作によるキャレット移動の通知（サジェスト機能のトリガー再評価に使う） */
  onCaretMove?: () => void
  counters?: CounterSpec[]
  wrapperClassName?: string
  editorRef: React.RefObject<HTMLDivElement | null>
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

const computeCounterCellWidthCh = (spec: CounterSpec): number => {
  const maxDigits = String(spec.maxAssumed).length
  return maxDigits * 2 + 2 + estimateDisplayWidthCh(spec.label)
}

/**
 * 投稿本文欄本体を描画する。
 *
 * Input:
 * - `value`/`onChange`: 制御コンポーネントとしての本文文字列
 * - `editorRef`: サジェスト機能・キーボード行数調整フックへ公開するDOM参照
 *
 * Output:
 * - ハッシュタグ/メンションをインラインで色付け表示するcontenteditable本文欄
 */
const Component: React.FC<Props> = ({
  value,
  onChange,
  rows,
  maxRows,
  autoGrow = false,
  placeholder,
  disabled,
  onFocus,
  onBlur,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onCaretMove,
  counters = [],
  wrapperClassName,
  editorRef,
}) => {
  const isComposingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // 表示内容の同期（差分パッチ）。IME変換中は行わない（変換中のカーソル飛び・変換中断を
  // 防ぐため）。autoGrowの高さ計算（下のuseLayoutEffect）より必ず先に実行する必要がある
  // （同期後のDOMのscrollHeightを基準に高さを求めるため、同一コンポーネント内での
  // 宣言順がそのまま実行順になることを利用している）。
  useLayoutEffect(() => {
    const root = editorRef.current
    if (!root || isComposingRef.current) return
    reconcileContent(root, value, styles.highlight)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useLayoutEffect(() => {
    const root = editorRef.current
    if (!root) return

    const computed = getComputedStyle(root)
    const fontSizePx = parseFloat(computed.fontSize) || 16
    const lineHeightPx = resolveLineHeightPx(computed.lineHeight, fontSizePx)
    const verticalExtraPx =
      parseFloat(computed.paddingTop || "0") +
      parseFloat(computed.paddingBottom || "0") +
      parseFloat(computed.borderTopWidth || "0") +
      parseFloat(computed.borderBottomWidth || "0")

    if (!autoGrow) {
      const { minHeightPx } = computeAutoGrowBounds(
        rows,
        undefined,
        lineHeightPx,
        verticalExtraPx,
      )
      root.style.height = `${minHeightPx}px`
      root.style.overflowY = "auto"
      return
    }

    const { minHeightPx, maxHeightPx } = computeAutoGrowBounds(
      rows,
      maxRows,
      lineHeightPx,
      verticalExtraPx,
    )
    root.style.height = "auto"
    const { heightPx, overflowY } = clampAutoGrowHeightPx(
      root.scrollHeight,
      minHeightPx,
      maxHeightPx,
    )
    root.style.height = `${heightPx}px`
    root.style.overflowY = overflowY
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, autoGrow, rows, maxRows])

  const handleInput = () => {
    if (isComposingRef.current) return
    const root = editorRef.current
    if (!root) return
    onChange(extractPlainText(root))
  }

  const handleCompositionStart = () => {
    isComposingRef.current = true
    onCompositionStart?.()
  }

  const handleCompositionEnd = () => {
    isComposingRef.current = false
    const root = editorRef.current
    if (root) onChange(extractPlainText(root))
    onCompositionEnd?.()
  }

  // Enter/Shift+Enterの改行を<br>挿入に統一する。ReactのonBeforeInput(JSX prop)は、
  // このReactバージョンでは合成イベントのnativeEvent.inputTypeが正しく伝播されない
  // （常にundefinedになる）ため、ネイティブのbeforeinputイベントに直接リスナーを張る。
  // マウント時の1回だけ登録し、常に最新のonChangeを呼べるようonChangeRef経由で参照する。
  useLayoutEffect(() => {
    const root = editorRef.current
    if (!root) return

    const handleNativeBeforeInput = (e: InputEvent) => {
      if (
        e.inputType !== "insertParagraph" &&
        e.inputType !== "insertLineBreak"
      ) {
        return
      }
      e.preventDefault()

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      range.deleteContents()
      const br = document.createElement("br")
      range.insertNode(br)
      range.setStartAfter(br)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)

      onChangeRef.current(extractPlainText(root))
    }

    root.addEventListener("beforeinput", handleNativeBeforeInput)
    return () =>
      root.removeEventListener("beforeinput", handleNativeBeforeInput)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // リッチペースト（書式付き）を拒否しプレーンテキストのみ挿入する。stopPropagationは
    // 呼ばない: 外側のPostForm本体は画像ファイルのペーストをこのイベントのバブリングで
    // 拾うため（本文欄側でのpreventDefaultはテキストとしてのデフォルト挙動を止めるだけで、
    // 画像ファイル抽出処理には影響しない）。
    e.preventDefault()
    const root = editorRef.current
    const selection = window.getSelection()
    const text = e.clipboardData.getData("text/plain")
    if (!root || !selection || selection.rangeCount === 0 || !text) return

    const range = selection.getRangeAt(0)
    range.deleteContents()

    const fragment = document.createDocumentFragment()
    const lines = text.split("\n")
    lines.forEach((line, i) => {
      if (line.length > 0) fragment.appendChild(document.createTextNode(line))
      if (i < lines.length - 1) {
        fragment.appendChild(document.createElement("br"))
      }
    })
    const lastNode = fragment.lastChild
    range.insertNode(fragment)
    if (lastNode) {
      range.setStartAfter(lastNode)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    onChange(extractPlainText(root))
  }

  const handleBlur = () => {
    // DOM状態が`value`から導出されるべき内容とズレるリスク（想定外のDOM構造の混入等）への
    // 安全弁として、フォーカスを失う度にDOM全体を`value`基準で強制再構築する。
    const root = editorRef.current
    if (root) rebuildContentFully(root, value, styles.highlight)
    onBlur?.()
  }

  const handleClick = () => onCaretMove?.()
  const handleKeyUp = () => onCaretMove?.()

  // Backspace/DeleteキーがCARET_ANCHOR（文末の不可視マーカー文字）に触れる操作の場合、
  // ネイティブ削除に処理させる前に横取りする。ネイティブ処理に任せると、DOM上は変化する
  // のに平文としては変化しない/かえって行が増える既知の挙動があるため
  // （詳細は`resolveAnchorAwareDeleteText`、`contentEditableModel.ts`）。
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      const root = editorRef.current
      if (root && !isComposingRef.current && !e.nativeEvent.isComposing) {
        const nextText = resolveAnchorAwareDeleteText(root, value, e.key)
        if (nextText !== undefined) {
          e.preventDefault()
          if (nextText !== null) onChangeRef.current(nextText)
          return
        }
      }
    }
    onKeyDown?.(e)
  }

  const aggregateState = resolveAggregateState(value, counters)
  const aggregateClass =
    aggregateState === "error"
      ? styles["counters-error"]
      : aggregateState === "warn"
        ? styles["counters-warn"]
        : ""

  const wrapperClass = [ui["base-input-box"], styles.wrapper, wrapperClassName]
    .filter(Boolean)
    .join(" ")
  const fieldClass = [ui["base-input-field"], styles.editor]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={wrapperClass}>
      <div
        ref={editorRef}
        data-post-body-editor
        className={fieldClass}
        contentEditable={!disabled}
        aria-disabled={disabled}
        aria-multiline="true"
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        onFocus={onFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onKeyUp={handleKeyUp}
      />
      {counters.length > 0 && (
        <div
          className={[styles.counters, aggregateClass]
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
