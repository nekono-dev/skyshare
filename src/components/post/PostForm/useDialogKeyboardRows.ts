/**
 * PostForm の dialog表示（フローティング表示）時、本文欄(CountedTextInput)の
 * rows初期値をソフトウェアキーボードの占有サイズに応じて動的に決めるフック。
 *
 * 責務と処理概要:
 * - モバイル幅（`src/styles/tokens.css` のブレークポイント 639px と一致させたJS側判定）かつ
 *   `variant === "dialog"` のときのみ動作し、それ以外（デスクトップ / page表示）では何もしない。
 * - 本文欄が初回フォーカスされた瞬間（＝キーボードが開き始めるタイミング）に一度だけ計測し、
 *   以降は再計算しない（入力中にrowsが変動して操作感を乱さないため）。
 * - 計測は `window.visualViewport` の resize を1回だけ待つ（キーボードのアニメーションを待つため）。
 *   一定時間内にresizeが来ない場合はタイムアウトでフォールバックする。
 * - キーボード表示中も画面内に収めたい範囲は「フォーム上端 〜 画像追加/クロップ操作ボタンの
 *   ツールボックス下端」まで（それより下の各種オプショントグルはキーボードに被って隠れてよい）。
 *   その範囲からtextarea自身の実高さ（文字数カウンタ行等は含まない）を除いたものを
 *   textarea以外の専有高さとみなし、visualViewportの高さから差し引いた残りをtextareaに
 *   割り当てられる高さとして、`computeRowsFromAvailableHeight` でrows数に変換する。
 * - 高さ→行数の変換自体はDOM非依存の純粋関数として `autoGrowHeight.ts` 側に置き、
 *   ここではDOM計測（副作用）のみを担う。
 */
import { useRef, useState } from "react"
import {
    computeRowsFromAvailableHeight,
    resolveLineHeightPx,
} from "@/components/common/CountedTextInput/autoGrowHeight"

// src/styles/tokens.css のモバイルブレークポイント(max-width: 639px)と合わせる
const MOBILE_BREAKPOINT_QUERY = "(max-width: 639px)"
const KEYBOARD_RESIZE_TIMEOUT_MS = 400
const VIEWPORT_SAFETY_MARGIN_PX = 8

type Params = {
    /** trueのときのみ計測を行う（PostFormでは variant === "dialog" を渡す） */
    enabled: boolean
    /** ダイアログ全体（本文欄以外を含む）のルート要素のref */
    formRef: React.RefObject<HTMLElement | null>
    /** 本文欄(CountedTextInput)を包むラッパー要素のref */
    inputAreaRef: React.RefObject<HTMLElement | null>
    /**
     * 画像追加/クロップ操作ボタンのツールボックスのref。
     * この下端までを画面内に収める対象とし、それより下（オプショントグル等）は
     * キーボードに被って隠れることを許容する。
     */
    toolboxRef: React.RefObject<HTMLElement | null>
    /** 計測できなかった場合や上限として使う既定rows数 */
    defaultRows: number
    /** 算出結果の下限rows数 */
    minRows: number
}

export type UseDialogKeyboardRowsResult = {
    /** 計測済みならそのrows数、未計測ならundefined（呼び出し側でdefaultRows等にフォールバックする） */
    rows: number | undefined
    /** 本文欄のonFocusにそのまま渡すハンドラ */
    handleTextareaFocus: () => void
}

/**
 * Input:
 * - `enabled`: dialog表示中かどうか
 * - `formRef` / `inputAreaRef` / `toolboxRef`: 高さ計測対象のDOM ref
 * - `defaultRows` / `minRows`: 算出結果のクランプ範囲
 *
 * Output:
 * - `rows`: 初回フォーカス後に算出されたrows数（未計測はundefined）
 * - `handleTextareaFocus`: 本文欄のonFocusに渡す一度限りの計測トリガー
 */
export const useDialogKeyboardRows = ({
    enabled,
    formRef,
    inputAreaRef,
    toolboxRef,
    defaultRows,
    minRows,
}: Params): UseDialogKeyboardRowsResult => {
    const [rows, setRows] = useState<number | undefined>(undefined)
    const hasMeasuredRef = useRef(false)

    const handleTextareaFocus = () => {
        if (!enabled || hasMeasuredRef.current) return
        if (typeof window === "undefined" || !window.visualViewport) return
        if (!window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches) return
        hasMeasuredRef.current = true

        const viewport = window.visualViewport
        const measure = () => {
            const formEl = formRef.current
            const inputAreaEl = inputAreaRef.current
            const toolboxEl = toolboxRef.current
            const textareaEl = inputAreaEl?.querySelector("textarea")
            if (!formEl || !inputAreaEl || !toolboxEl || !textareaEl) return

            const computed = getComputedStyle(textareaEl)
            const fontSizePx = parseFloat(computed.fontSize) || 16
            const lineHeightPx = resolveLineHeightPx(
                computed.lineHeight,
                fontSizePx,
            )
            const verticalExtraPx =
                parseFloat(computed.paddingTop || "0") +
                parseFloat(computed.paddingBottom || "0") +
                parseFloat(computed.borderTopWidth || "0") +
                parseFloat(computed.borderBottomWidth || "0")

            // 「フォーム上端 〜 ツールボックス下端」までの実高さから、textarea自身の高さを除いたものが
            // 画面内に収めるべきtextarea以外の専有高さ（それより下のオプショントグル等は対象外）。
            // input-areaの高さ（inputAreaEl.clientHeight）にはtextarea直下の文字数カウンタ行も
            // 含まれるため、それをchrome側に含めるにはtextarea自身の実高さで差し引く必要がある
            // （inputAreaEl.clientHeightで差し引くと、カウンタ行の高さ分だけavailableHeightPxが
            // 過大になり、算出されるrowsが実際より約1行分多くなってしまう）。
            const textareaHeightPx = textareaEl.getBoundingClientRect().height
            const visibleRangeHeightPx =
                toolboxEl.getBoundingClientRect().bottom -
                formEl.getBoundingClientRect().top
            const chromeHeightPx = visibleRangeHeightPx - textareaHeightPx
            const availableHeightPx =
                viewport.height - chromeHeightPx - VIEWPORT_SAFETY_MARGIN_PX

            setRows(
                computeRowsFromAvailableHeight(
                    availableHeightPx,
                    lineHeightPx,
                    verticalExtraPx,
                    minRows,
                    defaultRows,
                ),
            )
        }

        let settled = false
        const onResize = () => {
            if (settled) return
            settled = true
            viewport.removeEventListener("resize", onResize)
            measure()
        }
        viewport.addEventListener("resize", onResize)
        window.setTimeout(() => {
            if (settled) return
            settled = true
            viewport.removeEventListener("resize", onResize)
            measure()
        }, KEYBOARD_RESIZE_TIMEOUT_MS)
    }

    return { rows, handleTextareaFocus }
}
