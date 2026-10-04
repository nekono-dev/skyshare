/**
 * PostForm の本文欄(PostBodyEditor)の rows を、ソフトウェアキーボードの
 * 占有サイズに応じて動的に決めるフック。dialog表示(PostLauncherのモーダル)でのみ
 * フォーカス連動のリサイズを行う。page表示(index.astro等の常時表示フォーム)は
 * `enabled: false` で使い、フォーカス/ブラーによるリサイズを一切行わず、
 * 呼び出し側の autoGrow（本文量に応じたサイズ変更）にのみ委ねる。
 * これは、フォーカス/ブラーに伴うリサイズがクリック位置とボタン位置のずれ
 * （例: OGPリンクカード取得ボタン等のクリック中にblurが先行してフォームが
 * リサイズされる）を引き起こすため。
 *
 * `enabled: true`（dialog用）の場合の責務と処理概要:
 * - キーボード出現に合わせた計測（フォーカス時のvisualViewport計測）はモバイル幅
 *   （`src/styles/tokens.css` のブレークポイント 639px と一致させたJS側判定）でのみ動作する。
 *   `isKeyboardPlatform` としてこの判定結果を呼び出し側にも返す。
 * - モバイル幅では、本文欄がフォーカスされる度（＝キーボードが開き始めるタイミング）に
 *   visualViewportを計測してrowsをキーボードの残り領域に合わせ、stateへ反映する。
 * - `persistToStorage` が true の場合、モバイル幅での計測結果を
 *   localStorage にも保存し、次回アプリ起動時（モバイル幅の場合のみ）の rows 初期値として使う
 *   （`readTextareaRowsSetting` 参照）。
 * - 非モバイル幅（PC等、ソフトウェアキーボードが表示されずvisualViewport計測が発生しない
 *   プラットフォーム）では、キーボード出現によるviewport計測は行わない。代わりに
 *   フォーカス状態に関わらず常に `nonKeyboardFixedRows` で固定する
 *   （呼び出し側は autoGrow を無効にし、固定rows表示（内部スクロール）にする）。
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
import { useState } from "react"
import {
    computeRowsFromAvailableHeight,
    resolveLineHeightPx,
} from "@/components/common/CountedTextInput/autoGrowHeight"
import {
    readTextareaRowsSetting,
    writeTextareaRowsSetting,
} from "@/lib/settings/shareSettings"

// src/styles/tokens.css のモバイルブレークポイント(max-width: 639px)と合わせる
const MOBILE_BREAKPOINT_QUERY = "(max-width: 639px)"
const KEYBOARD_RESIZE_TIMEOUT_MS = 400
const VIEWPORT_SAFETY_MARGIN_PX = 8

type Params = {
    /** ダイアログ全体（本文欄以外を含む）のルート要素のref */
    formRef: React.RefObject<HTMLElement | null>
    /** 本文欄(PostBodyEditor)を包むラッパー要素のref */
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
    /** 非モバイル幅（PC等）で使う固定rows数。dialogで常時この値を返す。 */
    nonKeyboardFixedRows: number
    /** trueならモバイル幅での計測結果をlocalStorageの保存値と同期する（dialog用）。 */
    persistToStorage: boolean
    /**
     * trueならフォーカス/ブラーに連動したリサイズを行う（dialog用）。
     * falseならフォーカス/ブラーでは一切リサイズせず、呼び出し側のautoGrow
     * （本文量に応じたサイズ変更）にのみ委ねる（page＝常時表示フォーム用）。
     */
    enabled: boolean
}

export type UseKeyboardRowsResult = {
    /** モバイル幅での保存値・計測値のいずれか、無ければundefined（呼び出し側でデフォルト値にフォールバックする） */
    rows: number | undefined
    /**
     * モバイル幅でのキーボード計測による最大行数。`rows`と異なり`resetOnBlur`時も
     * フォーカス解除でリセットされず、直近の計測値を保持し続ける。
     * autoGrow時の上限行数（maxRows）算出に使う想定
     * （フォーカス解除後も、フォーカス中に計測した上限までは本文量に応じて伸びたままにするため。
     * ここをリセットしてしまうと、十分な文章量がある状態でフォーカスを外した際に
     * 表示が一段階縮んでしまう）。
     */
    keyboardMaxRows: number | undefined
    /** 本文欄のonFocusにそのまま渡すハンドラ（`enabled: false`時は何もしない） */
    handleTextareaFocus: () => void
    /** 本文欄のonBlurにそのまま渡すハンドラ（`enabled: false`時は何もしない） */
    handleTextareaBlur: () => void
    /**
     * キーボードによるフォーカス計測が発生するプラットフォーム（モバイル幅）かどうか。
     * falseの場合、呼び出し側はrows/maxRowsを固定値ではなくautoGrow用のmin/maxとして扱い、
     * サイズ変更を入力内容に応じたものだけにする。
     */
    isKeyboardPlatform: boolean
}

const detectKeyboardPlatform = (): boolean =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches

/**
 * Input:
 * - `formRef` / `inputAreaRef` / `toolboxRef`: 高さ計測対象のDOM ref
 * - `defaultRows` / `minRows`: 算出結果のクランプ範囲
 * - `persistToStorage`: trueならモバイル幅での計測結果をlocalStorageと同期する（dialog用）
 * - `enabled`: trueならフォーカス/ブラーに連動したリサイズを行う（dialog用）。falseなら
 *   フォーカス/ブラーによるリサイズを行わず、rows/keyboardMaxRowsは常にundefined
 *   （呼び出し側のautoGrowにサイズ変更を委ねる。page用）
 *
 * Output:
 * - `rows`: モバイル幅での保存値・計測値のいずれか、無ければundefined
 * - `handleTextareaFocus`: 本文欄のonFocusに渡す計測トリガー（フォーカスの度に再計測する）
 * - `handleTextareaBlur`: 本文欄のonBlurに渡すリセットトリガー
 * - `isKeyboardPlatform`: モバイル幅（キーボード計測が働くプラットフォーム）かどうか
 */
export const useKeyboardRows = ({
    formRef,
    inputAreaRef,
    toolboxRef,
    defaultRows,
    minRows,
    nonKeyboardFixedRows,
    persistToStorage,
    enabled,
}: Params): UseKeyboardRowsResult => {
    const [isKeyboardPlatform] = useState(detectKeyboardPlatform)

    // 非モバイル幅（PC等）での初期値。dialogは常にnonKeyboardFixedRowsで固定、
    // 無効時（page）は内容依存(autoGrow)に委ねるため常にundefined。
    const computeInitialRows = (): number | undefined => {
        if (!enabled) return undefined
        if (isKeyboardPlatform) {
            if (persistToStorage) {
                const stored = readTextareaRowsSetting(undefined)
                if (stored !== undefined) return stored
            }
            return undefined
        }
        return nonKeyboardFixedRows
    }

    const [rows, setRows] = useState<number | undefined>(computeInitialRows)
    // フォーカス解除でリセットされない、キーボード計測による最大行数の記憶。
    const [keyboardMaxRows, setKeyboardMaxRows] = useState<number | undefined>(
        computeInitialRows,
    )

    const handleTextareaBlur = () => {}

    const handleTextareaFocus = () => {
        if (!enabled) return
        if (!isKeyboardPlatform) return
        if (typeof window === "undefined" || !window.visualViewport) return

        const viewport = window.visualViewport
        const measure = () => {
            const formEl = formRef.current
            const inputAreaEl = inputAreaRef.current
            const toolboxEl = toolboxRef.current
            const textareaEl = inputAreaEl?.querySelector<HTMLElement>(
                "[data-post-body-editor]",
            )
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

            const nextRows = computeRowsFromAvailableHeight(
                availableHeightPx,
                lineHeightPx,
                verticalExtraPx,
                minRows,
                defaultRows,
            )
            setRows(nextRows)
            setKeyboardMaxRows(nextRows)
            if (persistToStorage) {
                writeTextareaRowsSetting(nextRows)
            }
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

    return {
        rows,
        keyboardMaxRows,
        handleTextareaFocus,
        handleTextareaBlur,
        isKeyboardPlatform,
    }
}
