/**
 * PostForm本文入力欄における「@メンション/#ハッシュタグ候補」の状態管理フック。
 *
 * 責務と処理概要:
 * - 本文欄(`PostBodyEditor`、contenteditableなdiv)内のカーソル直前のトークンを
 *   `detectSuggestTrigger` で判定し、200msデバウンスの上でBluesky公開API
 *   （メンション: `searchMentionSuggestions`、ハッシュタグ: `getHashtagCandidates`）を呼び候補を取得する。
 * - IME変換中は評価・キー操作の横取りを一切行わない（変換候補選択を妨げないため）。
 * - 候補取得の失敗は本文入力・投稿フローに一切影響させない（呼び出し先が既に例外を握りつぶし
 *   空配列を返す設計のため、ここでは候補が0件のままポップアップを開かないだけで済む）。
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import {
    detectSuggestTrigger,
    type SuggestTrigger,
} from "@/util/textarea/suggestTrigger"
import {
    getPlainTextSelection,
    measureIndexPixelPosition,
    setPlainTextCaret,
} from "@/util/textarea/contentEditableModel"
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
    editorRef: React.RefObject<HTMLDivElement | null>
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
    handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
    handleBlur: () => void
    handleCompositionStart: () => void
    handleCompositionEnd: () => void
    handleCaretMove: () => void
    close: () => void
}

/**
 * PostFormのメンション/ハッシュタグ候補機能一式（トリガー検出・取得・キー操作・確定処理）を提供する。
 *
 * Input:
 * - `text`: 投稿本文（PostFormのstate）
 * - `onReplaceText`: 候補確定時に呼ぶテキスト置換関数（実質 `setText`）
 * - `editorRef`: キャレット測定・ポップアップ位置計算に使うDOM参照（`PostBodyEditor`のルート要素）
 * - `disabled`: 投稿送信中など、候補機能自体を無効化したい場合に `true`
 *
 * Output:
 * - 候補ポップアップの描画・操作に必要な状態とハンドラ一式
 */
export const useSuggest = ({
    text,
    onReplaceText,
    editorRef,
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
        const el = editorRef.current
        if (!el) return

        const editorRect = el.getBoundingClientRect()
        const caret = measureIndexPixelPosition(el, startIndex)

        setPosition({
            top:
                editorRect.top +
                caret.top +
                caret.height +
                POPOVER_VERTICAL_GAP_PX,
            left: editorRect.left + caret.left,
        })
    }

    const evaluateTrigger = () => {
        if (disabledRef.current) {
            close()
            return
        }

        const el = editorRef.current
        if (!el || isComposingRef.current) return

        const selection = getPlainTextSelection(el)
        if (!selection || selection.start !== selection.end) {
            close()
            return
        }

        const nextTrigger = detectSuggestTrigger(text, selection.start)
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
        // クエリまで含めて完全に同一なら、triggerを更新しない（下記の理由で重要）。
        const triggerChanged = anchorChanged || prev.query !== nextTrigger.query

        // ここでtriggerが完全に同一な場合にsetTrigger(新規オブジェクト参照)を呼んでしまうと、
        // [trigger]依存のデバウンス再取得effectがキー入力の度（矢印キーでのアクティブ行選択も
        // 含む）に無条件で再発火し、200ms後に再取得した候補でactiveIndexが0へ巻き戻ってしまう
        // （矢印キーで選んだ直後に選択が元に戻って見えるバグの原因だった）。textareaを
        // ArrowDown/Upで動かした場合はcaret位置が変わらずnextTriggerの内容も不変なため、
        // ここで弾けば候補一覧・選択位置を保持したままにできる。
        if (triggerChanged) {
            triggerRef.current = nextTrigger
            setTrigger(nextTrigger)
        }

        if (anchorChanged) {
            setCandidates([])
            setActiveIndex(0)
            recomputePosition(nextTrigger.startIndex)
        }
    }

    // disabledがtrueへ変わったら即座に閉じる（textが変化するまで待たない）。
    useEffect(() => {
        if (disabled) close()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disabled])

    // text変化時: 候補確定直後ならキャレット位置を復元するだけに留め、それ以外はトリガーを再評価する。
    // useLayoutEffectにするのは、`PostBodyEditor`側がハイライトspan構造をuseLayoutEffectで
    // 再構築するため（Reactは子の副作用を親より先に実行するので、この副作用が走る時点では
    // 既に再構築後のDOMになっている）。ここが先に走ってしまうと、古いDOM構造に対して
    // キャレット位置を設定してしまいズレる。
    useLayoutEffect(() => {
        if (pendingCaretIndex !== null) {
            const el = editorRef.current
            if (el) {
                el.focus()
                setPlainTextCaret(el, pendingCaretIndex)
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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

    const handleCompositionStart = () => {
        isComposingRef.current = true
    }

    // ここでevaluateTriggerを同期的に呼ばないのは、この時点ではまだ`PostBodyEditor`側の
    // onChangeによるReact stateの更新（=このフックの`text`引数の更新）が反映されておらず、
    // 古いtextを見て誤判定するため。isComposingRef解除後は、`text`変化を検知する
    // 下記useLayoutEffectが再評価を担う。
    const handleCompositionEnd = () => {
        isComposingRef.current = false
    }

    // クリック/キー操作によるキャレット移動を検知して再評価する（onClick/onKeyUpに接続する）。
    const handleCaretMove = () => evaluateTrigger()

    const isOpen = trigger !== null && candidates.length > 0

    // ポップアップの開閉・ハイライト位置をスクリーンリーダーにも伝える。`PostBodyEditor`の
    // Props型を汚さないため、公開された`editorRef`経由でDOM要素へ直接設定する。
    useEffect(() => {
        const el = editorRef.current
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
        handleCompositionStart,
        handleCompositionEnd,
        handleCaretMove,
        close,
    }
}
