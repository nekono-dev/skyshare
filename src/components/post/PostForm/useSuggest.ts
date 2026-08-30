/**
 * PostForm本文入力欄における「@メンション/#ハッシュタグ候補」の状態管理フック。
 *
 * 責務と処理概要:
 * - textarea内のカーソル直前のトークンを `detectSuggestTrigger` で判定し、200msデバウンスの上で
 *   Bluesky公開API（メンション: `searchMentionSuggestions`、ハッシュタグ: `getHashtagCandidates`）
 *   を呼び候補を取得する。
 * - IME変換中は評価・キー操作の横取りを一切行わない（変換候補選択を妨げないため）。
 * - 候補取得の失敗は本文入力・投稿フローに一切影響させない（呼び出し先が既に例外を握りつぶし
 *   空配列を返す設計のため、ここでは候補が0件のままポップアップを開かないだけで済む）。
 */
import { useEffect, useId, useRef, useState } from "react"
import {
    detectSuggestTrigger,
    type SuggestTrigger,
} from "@/util/textarea/suggestTrigger"
import { measureCaretPixelPosition } from "@/util/textarea/caretPosition"
import {
    searchMentionSuggestions,
    type MentionSuggestion,
} from "@/lib/atproto/suggest"
import { getHashtagCandidates, type HashtagCandidate } from "./suggestHashtags"

export type SuggestCandidate =
    | { kind: "mention"; item: MentionSuggestion }
    | { kind: "hashtag"; item: HashtagCandidate }

type UseSuggestParams = {
    text: string
    onReplaceText: (nextText: string) => void
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
    disabled?: boolean
    /** falseの場合、"#"トリガーを検出しても候補取得・ポップアップ表示を一切行わない */
    hashtagSuggestEnabled?: boolean
    /** falseの場合、"@"トリガーを検出しても候補取得・ポップアップ表示を一切行わない */
    mentionSuggestEnabled?: boolean
}

const SUGGEST_DEBOUNCE_MS = 200
const POPOVER_VERTICAL_GAP_PX = 4

export type UseSuggestResult = {
    isOpen: boolean
    candidates: SuggestCandidate[]
    activeIndex: number
    position: { top: number; left: number } | null
    listboxId: string
    onHoverIndex: (index: number) => void
    onSelect: (index: number) => void
    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    handleBlur: () => void
    close: () => void
}

/**
 * PostFormのメンション/ハッシュタグ候補機能一式（トリガー検出・取得・キー操作・確定処理）を提供する。
 *
 * Input:
 * - `text`: 投稿本文（PostFormのstate）
 * - `onReplaceText`: 候補確定時に呼ぶテキスト置換関数（実質 `setText`）
 * - `textareaRef`: キャレット測定・ポップアップ位置計算に使うDOM参照
 * - `disabled`: 投稿送信中など、候補機能自体を無効化したい場合に `true`
 *
 * Output:
 * - 候補ポップアップの描画・操作に必要な状態とハンドラ一式
 */
export const useSuggest = ({
    text,
    onReplaceText,
    textareaRef,
    disabled = false,
    hashtagSuggestEnabled = true,
    mentionSuggestEnabled = true,
}: UseSuggestParams): UseSuggestResult => {
    const listboxId = useId()

    const [trigger, setTrigger] = useState<SuggestTrigger | null>(null)
    const [candidates, setCandidates] = useState<SuggestCandidate[]>([])
    const [activeIndex, setActiveIndex] = useState(0)
    const [position, setPosition] = useState<{
        top: number
        left: number
    } | null>(null)
    const [pendingCaretIndex, setPendingCaretIndex] = useState<number | null>(
        null,
    )

    const triggerRef = useRef<SuggestTrigger | null>(null)
    const isComposingRef = useRef(false)
    const disabledRef = useRef(disabled)
    const hashtagSuggestEnabledRef = useRef(hashtagSuggestEnabled)
    const mentionSuggestEnabledRef = useRef(mentionSuggestEnabled)
    const requestSeqRef = useRef(0)
    const abortControllerRef = useRef<AbortController | null>(null)
    const evaluateTriggerRef = useRef<() => void>(() => {})

    disabledRef.current = disabled
    hashtagSuggestEnabledRef.current = hashtagSuggestEnabled
    mentionSuggestEnabledRef.current = mentionSuggestEnabled

    const close = () => {
        triggerRef.current = null
        setTrigger(null)
        setCandidates([])
        setActiveIndex(0)
        setPosition(null)
    }

    const recomputePosition = (startIndex: number) => {
        const el = textareaRef.current
        if (!el) return

        const textareaRect = el.getBoundingClientRect()
        const caret = measureCaretPixelPosition(el, startIndex)

        setPosition({
            top:
                textareaRect.top +
                caret.top +
                caret.height +
                POPOVER_VERTICAL_GAP_PX,
            left: textareaRect.left + caret.left,
        })
    }

    const evaluateTrigger = () => {
        if (disabledRef.current) {
            close()
            return
        }

        const el = textareaRef.current
        if (!el || isComposingRef.current) return

        if (
            el.selectionStart == null ||
            el.selectionStart !== el.selectionEnd
        ) {
            close()
            return
        }

        const nextTrigger = detectSuggestTrigger(el.value, el.selectionStart)
        if (!nextTrigger) {
            close()
            return
        }

        if (
            (nextTrigger.kind === "hashtag" &&
                !hashtagSuggestEnabledRef.current) ||
            (nextTrigger.kind === "mention" &&
                !mentionSuggestEnabledRef.current)
        ) {
            close()
            return
        }

        const prev = triggerRef.current
        const anchorChanged =
            !prev ||
            prev.kind !== nextTrigger.kind ||
            prev.startIndex !== nextTrigger.startIndex

        triggerRef.current = nextTrigger
        setTrigger(nextTrigger)

        if (anchorChanged) {
            setCandidates([])
            setActiveIndex(0)
            recomputePosition(nextTrigger.startIndex)
        }
    }
    evaluateTriggerRef.current = evaluateTrigger

    // disabledがtrueへ変わったら即座に閉じる（textが変化するまで待たない）。
    useEffect(() => {
        if (disabled) close()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disabled])

    // textarea自身のcompositionstart/compositionend・click・keyupは、CountedTextInputが
    // イベントpropを公開していないため、公開されたtextareaRef経由でネイティブリスナーを張る。
    // マウント時の1回だけ登録し、常に最新の判定を行えるようevaluateTriggerRefを経由して呼ぶ。
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return

        const handleCompositionStart = () => {
            isComposingRef.current = true
        }
        const handleCompositionEnd = () => {
            isComposingRef.current = false
            evaluateTriggerRef.current()
        }
        const handleCaretMove = () => evaluateTriggerRef.current()

        el.addEventListener("compositionstart", handleCompositionStart)
        el.addEventListener("compositionend", handleCompositionEnd)
        el.addEventListener("click", handleCaretMove)
        el.addEventListener("keyup", handleCaretMove)

        return () => {
            el.removeEventListener("compositionstart", handleCompositionStart)
            el.removeEventListener("compositionend", handleCompositionEnd)
            el.removeEventListener("click", handleCaretMove)
            el.removeEventListener("keyup", handleCaretMove)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // text変化時: 候補確定直後ならキャレット位置を復元するだけに留め、それ以外はトリガーを再評価する。
    useEffect(() => {
        if (pendingCaretIndex !== null) {
            const el = textareaRef.current
            if (el) {
                el.focus()
                el.setSelectionRange(pendingCaretIndex, pendingCaretIndex)
            }
            setPendingCaretIndex(null)
            return
        }
        evaluateTrigger()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text])

    // トリガー(query含む)が変わるたびにデバウンスして候補取得する。
    useEffect(() => {
        if (!trigger) return

        const timer = setTimeout(() => {
            void runSearch(trigger)
        }, SUGGEST_DEBOUNCE_MS)

        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger])

    const runSearch = async (t: SuggestTrigger) => {
        const mySeq = ++requestSeqRef.current
        abortControllerRef.current?.abort()
        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            if (t.kind === "mention") {
                const results = await searchMentionSuggestions(t.query, {
                    signal: controller.signal,
                })
                if (mySeq !== requestSeqRef.current) return
                setCandidates(
                    results.map(item => ({ kind: "mention" as const, item })),
                )
            } else {
                const results = await getHashtagCandidates({
                    prefix: t.query,
                    signal: controller.signal,
                })
                if (mySeq !== requestSeqRef.current) return
                setCandidates(
                    results.map(item => ({ kind: "hashtag" as const, item })),
                )
            }
            setActiveIndex(0)
        } catch (err) {
            if ((err as Error)?.name === "AbortError") return
            console.warn("useSuggest: failed to fetch suggestions", err)
        }
    }

    const handleSelect = (index: number) => {
        const currentTrigger = triggerRef.current
        const candidate = candidates[index]
        if (!currentTrigger || !candidate) return

        const insertText =
            candidate.kind === "mention"
                ? `@${candidate.item.handle}`
                : `#${candidate.item.tag}`
        const before = text.slice(0, currentTrigger.startIndex)
        const after = text.slice(
            currentTrigger.startIndex + 1 + currentTrigger.query.length,
        )
        const nextText = `${before}${insertText} ${after}`

        setPendingCaretIndex(before.length + insertText.length + 1)
        onReplaceText(nextText)
        close()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return
        if (!trigger || candidates.length === 0) return

        if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex(i => (i + 1) % candidates.length)
            return
        }
        if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex(i => (i - 1 + candidates.length) % candidates.length)
            return
        }
        if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            handleSelect(activeIndex)
            return
        }
        if (e.key === "Tab") {
            e.preventDefault()
            handleSelect(activeIndex)
            return
        }
        if (e.key === "Escape") {
            e.preventDefault()
            close()
            return
        }
    }

    const handleBlur = () => {
        close()
    }

    const isOpen = trigger !== null && candidates.length > 0

    // ポップアップの開閉・ハイライト位置をスクリーンリーダーにも伝える。CountedTextInputの
    // Props型を汚さないため、公開されたtextareaRef経由でDOM要素へ直接設定する。
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return

        el.setAttribute("role", "combobox")
        el.setAttribute("aria-autocomplete", "list")
        el.setAttribute("aria-expanded", String(isOpen))
        if (isOpen) {
            el.setAttribute("aria-controls", listboxId)
            el.setAttribute(
                "aria-activedescendant",
                `${listboxId}-option-${activeIndex}`,
            )
        } else {
            el.removeAttribute("aria-controls")
            el.removeAttribute("aria-activedescendant")
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, activeIndex, listboxId])

    return {
        isOpen,
        candidates,
        activeIndex,
        position,
        listboxId,
        onHoverIndex: setActiveIndex,
        onSelect: handleSelect,
        handleKeyDown,
        handleBlur,
        close,
    }
}
