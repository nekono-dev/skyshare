import { type Dispatch, type SetStateAction } from "react"
import {
    cancelSchedule,
    fetchScheduleForEdit,
} from "@/lib/schedule/submitSchedule"
import {
    editScheduleMode,
    initialScheduleMode,
    type ScheduleMode,
} from "@/lib/schedule/scheduleMode"
import { deferMessage, type DeferredMessage } from "@/lib/i18n/translate"
import {
    revokeImageEntry,
    revokeVideoEntry,
    scheduleDetailToSegments,
    type SegmentState,
} from "../rules/segments"
import type { LoadedDraft } from "./useDraftFlow"

export type UseScheduleEditParams = {
    segments: SegmentState[]
    setSegments: Dispatch<SetStateAction<SegmentState[]>>
    setActiveIndex: Dispatch<SetStateAction<number>>
    languageCode: string
    setLanguageCode: Dispatch<SetStateAction<string>>
    scheduleMode: ScheduleMode
    setScheduleMode: Dispatch<SetStateAction<ScheduleMode>>
    setRestoredFailedId: Dispatch<SetStateAction<string | null>>
    setEditChoiceOpen: Dispatch<SetStateAction<boolean>>
    setEditChoiceBusy: Dispatch<SetStateAction<boolean>>
    setScheduleLoading: Dispatch<SetStateAction<boolean>>
    setLoadedDraft: Dispatch<SetStateAction<LoadedDraft | null>>
    setDraftModalOpen: Dispatch<SetStateAction<boolean>>
    setPendingNavigation: Dispatch<SetStateAction<string | null>>
    setStatus: Dispatch<SetStateAction<DeferredMessage | null>>
    setStatusColor: Dispatch<SetStateAction<string | undefined>>
    closeForm: () => void
    goToPendingNavigation: () => void
}

/**
 * 予約の編集の手順（編集中の予約の取り消し・予約の内容のフォームへの適用）を持つ。
 * 下書きの閉じる処理と確認の遷移に依存するため、下書きのフックの後に呼ぶ。
 */
export const useScheduleEdit = ({
    segments,
    setSegments,
    setActiveIndex,
    languageCode,
    setLanguageCode,
    scheduleMode,
    setScheduleMode,
    setRestoredFailedId,
    setEditChoiceOpen,
    setEditChoiceBusy,
    setScheduleLoading,
    setLoadedDraft,
    setDraftModalOpen,
    setPendingNavigation,
    setStatus,
    setStatusColor,
    closeForm,
    goToPendingNavigation,
}: UseScheduleEditParams) => {
    /**
     * 予約の編集中のキャンセルで「予約を取り消す」を選んだとき。
     * 取消に成功したらフォームを閉じ、失敗したら3択を閉じて文言を表示する（入力は残す）。
     */
    const handleCancelScheduleAndClose = async () => {
        if (scheduleMode.kind !== "editing") return
        setEditChoiceBusy(true)
        try {
            const result = await cancelSchedule(scheduleMode.id)
            setEditChoiceOpen(false)
            if (!result.ok) {
                setPendingNavigation(null)
                setStatus(deferMessage(result.messageKey))
                setStatusColor("#b00")
                return
            }
            closeForm()
            setStatus(deferMessage("schedule.cancelled"))
            setStatusColor("green")
            goToPendingNavigation()
        } finally {
            setEditChoiceBusy(false)
        }
    }

    /**
     * 予約のタブで選んだ予約を、内容と画像ごとフォームへ戻す。待機中の予約は編集中にし、
     * 失敗した予約は日時の無い新規の入力として戻す（送信に成功したら元の履歴を削除する）。
     * 取得に失敗したら、フォームを変えずに文言を表示する。
     *
     * Input:
     * - `id`: 予約の識別子
     */
    const applyScheduleToForm = async (id: string) => {
        setDraftModalOpen(false)
        setScheduleLoading(true)
        try {
            const loaded = await fetchScheduleForEdit(id)
            if (!loaded.ok) {
                setStatus(deferMessage(loaded.messageKey))
                setStatusColor("#b00")
                return
            }
            segments.forEach(segment => {
                revokeImageEntry(segment.imageEntry)
                revokeVideoEntry(segment.videoEntry)
            })
            const nextSegments = scheduleDetailToSegments(
                loaded.detail,
                loaded.images,
                languageCode,
            )
            setSegments(nextSegments)
            setActiveIndex(0)
            setLanguageCode(nextSegments[0]!.languageCode)
            setLoadedDraft(null)
            if (loaded.detail.status === "failed") {
                // 失敗した予約は、日時の無い新規の入力として戻す（送信に成功したら元の履歴を削除する）
                setScheduleMode(initialScheduleMode)
                setRestoredFailedId(id)
            } else {
                setScheduleMode(editScheduleMode(id, loaded.runAt))
                setRestoredFailedId(null)
            }
            setStatus(deferMessage("schedule.applied"))
            setStatusColor("green")
        } finally {
            setScheduleLoading(false)
        }
    }

    return { handleCancelScheduleAndClose, applyScheduleToForm }
}
