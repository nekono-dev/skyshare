import {
    type Dispatch,
    type SetStateAction,
    useEffect,
    useRef,
    useState,
} from "react"
import { navigate } from "astro:transitions/client"
import { navigatingLinkTarget } from "../rules/links"
import {
    createDraft,
    deleteDraft,
    getDrafts,
    updateDraft,
} from "@/client/openapi/client"
import {
    deferMessage,
    type DeferredMessage,
    type PlainMessageKey,
} from "@/lib/i18n/translate"
import { normalizeDraftList } from "@/lib/timeline/draftList"
import {
    cancelAction,
    initialScheduleMode,
    type ScheduleMode,
} from "@/lib/schedule/scheduleMode"
import {
    createEmptySegment,
    draftPostsToSegments,
    revokeImageEntry,
    revokeVideoEntry,
    segmentsToDraftPosts,
    type SegmentState,
} from "../rules/segments"

// 読み込んだ下書きの元の内容。保存のときに更新するか、新規に作るかを決める
export type LoadedDraft = {
    id: string
    posts: ReturnType<typeof segmentsToDraftPosts>
}

export type UseDraftFlowParams = {
    variant: "dialog" | "page"
    onClose?: () => void
    segments: SegmentState[]
    setSegments: Dispatch<SetStateAction<SegmentState[]>>
    setActiveIndex: Dispatch<SetStateAction<number>>
    languageCode: string
    hasTextInput: boolean
    scheduleMode: ScheduleMode
    setScheduleMode: Dispatch<SetStateAction<ScheduleMode>>
    setRestoredFailedId: Dispatch<SetStateAction<string | null>>
    setEditChoiceOpen: Dispatch<SetStateAction<boolean>>
    setDraftTab: Dispatch<SetStateAction<"drafts" | "schedules">>
    setStatus: Dispatch<SetStateAction<DeferredMessage | null>>
    setStatusColor: Dispatch<SetStateAction<string | undefined>>
}

/**
 * 投稿フォームの下書きの手順（一覧・読み込み・保存・破棄）と、離脱の確認を持つ。
 * 状態の所有者は投稿フォームの本体（index）のまま、必要な値と setter を受け取る。
 */
export const useDraftFlow = ({
    variant,
    onClose,
    segments,
    setSegments,
    setActiveIndex,
    languageCode,
    hasTextInput,
    scheduleMode,
    setScheduleMode,
    setRestoredFailedId,
    setEditChoiceOpen,
    setDraftTab,
    setStatus,
    setStatusColor,
}: UseDraftFlowParams) => {
    const [loadedDraft, setLoadedDraft] = useState<LoadedDraft | null>(null)
    const [draftModalOpen, setDraftModalOpen] = useState(false)

    const [draftItems, setDraftItems] = useState<
        ReturnType<typeof normalizeDraftList>
    >([])
    const [draftListLoading, setDraftListLoading] = useState(false)
    const [draftListError, setDraftListError] =
        useState<PlainMessageKey | null>(null)
    const [draftSaveConfirmOpen, setDraftSaveConfirmOpen] = useState(false)

    // 下書き保存の確認の後に移るページ。null のときは、確認の後にフォームを閉じるだけ

    const [pendingNavigation, setPendingNavigation] = useState<string | null>(
        null,
    )
    const [isSavingDraft, setIsSavingDraft] = useState(false)

    /**
     * 投稿フォームの入力項目（全セグメント・下書き紐付け）のみを初期状態へ戻す。
     * status/statusColor は触らない（投稿成功メッセージ表示と両立させるため）。
     *
     * 処理の趣旨:
     * - `postGate`（返信/引用設定）は「投稿後にデフォルト値を更新する」トグルの状態に
     *   よって別途決定される値のため、呼び出し側で明示的に渡してもらう
     *   （このフォームインスタンス内で設定を持ち越す/都度デフォルトへ戻す、の
     *   いずれの挙動にも対応できるようにするため）。
     *
     * Input:
     * - `rootPostGate`: リセット後の先頭セグメントに設定する返信/引用設定
     *
     * Output:
     * - なし
     */
    const resetInputFields = (rootPostGate: SegmentState["postGate"]) => {
        segments.forEach(segment => {
            revokeImageEntry(segment.imageEntry)
            revokeVideoEntry(segment.videoEntry)
        })
        setSegments([
            { ...createEmptySegment(languageCode), postGate: rootPostGate },
        ])
        setActiveIndex(0)
        setLoadedDraft(null)
        setScheduleMode(initialScheduleMode)
        setRestoredFailedId(null)
    }

    /**
     * 下書き一覧を取得して選択ダイアログを開く。
     *
     * Input:
     * - なし
     *
     * Output:
     * - なし（state 更新のみ）
     */
    const openDraftPicker = async () => {
        setDraftTab("drafts")
        setDraftModalOpen(true)
        setDraftListLoading(true)
        setDraftListError(null)

        try {
            const res = await getDrafts({ limit: 100 })
            if (res.status !== 200) {
                setDraftItems([])
                setDraftListError("post.composer.draftListLoadFailed")
                return
            }

            setDraftItems(normalizeDraftList(res.data.drafts))
        } catch (error) {
            console.error("ThreadComposer: failed to load drafts", error)
            setDraftItems([])
            setDraftListError("post.composer.draftListLoadFailed")
        } finally {
            setDraftListLoading(false)
        }
    }

    /**
     * 選択した下書きをフォームに反映する（スレッド全体を`segments`配列として復元する）。
     *
     * Input:
     * - `draft`: 下書き一覧の 1 レコード
     *
     * Output:
     * - なし（フォームの state を更新）
     */
    const applyDraftToForm = (
        draft: ReturnType<typeof normalizeDraftList>[number],
    ) => {
        segments.forEach(segment => {
            revokeImageEntry(segment.imageEntry)
            revokeVideoEntry(segment.videoEntry)
        })
        const restored = draftPostsToSegments(draft.posts, languageCode)
        const nextSegments =
            restored.length > 0 ? restored : [createEmptySegment(languageCode)]
        setSegments(nextSegments)
        setActiveIndex(0)
        setLoadedDraft({
            id: draft.id,
            posts: segmentsToDraftPosts(nextSegments),
        })
        // 下書きは予約と結び付かないため、予約の状態を通常の入力へ戻す（予約そのものは残る）
        setScheduleMode(initialScheduleMode)
        setRestoredFailedId(null)
        setStatus(deferMessage("post.composer.draftApplied"))
        setStatusColor("green")
    }

    /**
     * 投稿成功後、使用済みの下書きをバックグラウンドで削除する。
     *
     * Input:
     * - `draftId`: 削除対象の下書き ID
     *
     * Output:
     * - なし
     */
    const deleteDraftSilently = async (draftId: string) => {
        try {
            const res = await deleteDraft({ id: draftId })
            if (res.status !== 200) {
                console.error(
                    "ThreadComposer: failed to delete draft after posting",
                )
            }
        } catch (error) {
            console.error(
                "ThreadComposer: failed to delete draft after posting",
                error,
            )
        }
    }

    /**
     * 現在の入力内容が、開いている下書きから変更されているかを判定する。
     *
     * Input:
     * - なし（`segments`/`loadedDraft` を参照）
     *
     * Output:
     * - 未保存の変更があれば `true`
     */
    const hasUnsavedDraftChanges = (): boolean => {
        if (!hasTextInput) return false
        if (!loadedDraft) return true
        const currentPosts = segmentsToDraftPosts(segments)
        return (
            JSON.stringify(currentPosts) !== JSON.stringify(loadedDraft.posts)
        )
    }

    /**
     * フォームを閉じる。dialog では `onClose` に委ね、常時表示の page では
     * 閉じられないため入力内容（返信/引用設定は維持）をクリアする。
     */
    const closeForm = () => {
        if (variant === "dialog") {
            onClose?.()
            return
        }
        resetInputFields(segments[0].postGate)
    }

    /**
     * 他のページへ移る。同じオリジンならページ遷移（`navigate`）、別のオリジンなら通常の遷移にする。
     */
    const goTo = (to: string) => {
        const url = new URL(to, window.location.href)
        if (url.origin === window.location.origin) void navigate(url.href)
        else window.location.assign(url.href)
    }

    /**
     * 下書き保存の確認を済ませた後の動作。フォームを閉じ、移る先が決まっていればそのページへ移る。
     */
    const finishAfterDraftConfirm = () => {
        setDraftSaveConfirmOpen(false)
        closeForm()
        goToPendingNavigation()
    }

    /**
     * 他のページへ移る。閉じるときと同じ確認（予約の編集中は3択、未保存の本文があれば
     * 下書き保存の確認）を挟んでから移り、作成中の内容を不意に失わないようにする。
     *
     * Input:
     * - `to`: 移る先の URL またはパス（再度の許可では Bluesky の認可の画面）
     */
    const requestNavigation = (to: string) => {
        const action = cancelAction(
            scheduleMode,
            hasUnsavedDraftChanges(),
            hasTextInput,
        )
        if (action === "close") {
            goTo(to)
            return
        }
        setPendingNavigation(to)
        if (action === "editChoice") setEditChoiceOpen(true)
        else setDraftSaveConfirmOpen(true)
    }

    /** 確認の後に移る先が決まっていれば、そのページへ移る */
    const goToPendingNavigation = () => {
        if (!pendingNavigation) return
        const to = pendingNavigation
        setPendingNavigation(null)
        goTo(to)
    }

    const requestNavigationRef = useRef(requestNavigation)
    requestNavigationRef.current = requestNavigation
    const hasUnsavedRef = useRef(hasUnsavedDraftChanges)
    hasUnsavedRef.current = hasUnsavedDraftChanges
    // 作成中にリンクを押して別のページへ移ろうとしたら、移動を止めて下書き保存の確認を出す。
    // Astro のページ遷移の通知（astro:before-preparation）は、取り消すと全体の再読み込みに
    // 切り替わり、入力が失われるため使わず、遷移を始める前のクリックを捕まえる。
    // ブラウザの戻る・進む、再読み込み、タブを閉じる操作は対象にしない。
    // クリックの購読はマウント中ずっと同じ関数で行うため、最新の状態は ref 経由で参照する。
    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            const to = navigatingLinkTarget(event, window.location)
            if (!to || !hasUnsavedRef.current()) return
            // Astro のリンクの処理（バブリング段階）へ届く前に止める
            event.preventDefault()
            event.stopPropagation()
            requestNavigationRef.current(to.href)
        }
        document.addEventListener("click", onClick, true)
        return () => document.removeEventListener("click", onClick, true)
    }, [])

    /**
     * 下書きを保存(新規作成/更新)してからフォームを閉じる。
     *
     * Input:
     * - なし
     *
     * Output:
     * - なし
     */
    const handleSaveDraftAndClose = async () => {
        setIsSavingDraft(true)
        try {
            const posts = segmentsToDraftPosts(segments)
            const res = loadedDraft
                ? await updateDraft({ id: loadedDraft.id, posts })
                : await createDraft({ posts })

            if (res.status !== 200) {
                setStatus(deferMessage("post.composer.draftSaveFailed"))
                setStatusColor("#b00")
                return
            }

            finishAfterDraftConfirm()
        } catch (error) {
            console.error("ThreadComposer: failed to save draft", error)
            setStatus(deferMessage("post.composer.draftSaveFailed"))
            setStatusColor("#b00")
        } finally {
            setIsSavingDraft(false)
        }
    }

    /**
     * 下書きを保存せずフォームを閉じる。
     */
    const handleDiscardDraftAndClose = () => {
        finishAfterDraftConfirm()
    }

    /**
     * フォームを閉じる要求を処理する（キャンセルボタン・Overlay 背景クリック共通）。
     *
     * 処理の趣旨:
     * - 予約の編集中は、予約の取消・予約を残して閉じる・編集を続けるの3択を出す。
     * - 編集中に日時を解除して予約を取り消した後は、変更がなくても下書きの保存を確認する。
     * - それ以外（新規の予約を含む）は、下書きの保存の確認に従う。
     */
    const requestClose = () => {
        const action = cancelAction(
            scheduleMode,
            hasUnsavedDraftChanges(),
            hasTextInput,
        )
        if (action === "editChoice") {
            setEditChoiceOpen(true)
            return
        }
        if (action === "draftConfirm") {
            setDraftSaveConfirmOpen(true)
            return
        }
        closeForm()
    }

    return {
        draftModalOpen,
        setDraftModalOpen,
        draftItems,
        setDraftItems,
        draftListLoading,
        setDraftListLoading,
        draftListError,
        setDraftListError,
        loadedDraft,
        setLoadedDraft,
        draftSaveConfirmOpen,
        setDraftSaveConfirmOpen,
        pendingNavigation,
        setPendingNavigation,
        isSavingDraft,
        setIsSavingDraft,
        resetInputFields,
        openDraftPicker,
        applyDraftToForm,
        deleteDraftSilently,
        hasUnsavedDraftChanges,
        closeForm,
        goTo,
        finishAfterDraftConfirm,
        requestNavigation,
        goToPendingNavigation,
        handleSaveDraftAndClose,
        handleDiscardDraftAndClose,
        requestClose,
    }
}
