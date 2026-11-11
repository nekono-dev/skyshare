/**
 * 予約日時・編集中の予約・取り消しに関する状態と手順を管理する。
 * 予約の取り消しと適用は下書きフローにも依存するため、フォーム本体が組み合わせる。
 */
import { type Dispatch, type SetStateAction, useEffect, useState } from "react"
import {
    cancelSchedule,
    fetchPendingCount,
} from "@/lib/schedule/submitSchedule"
import {
    applyRunAtChange,
    initialScheduleMode,
    type ScheduleMode,
} from "@/lib/schedule/scheduleMode"
import { deferMessage, type DeferredMessage } from "@/lib/i18n/translate"

export type UseScheduleFlowParams = {
    setStatus: Dispatch<SetStateAction<DeferredMessage | null>>
    setStatusColor: Dispatch<SetStateAction<string | undefined>>
}

/**
 * 予約の状態（日時・編集中の予約・取り消し）と、日時の指定に関する手順を持つ。
 * 予約の取り消しと予約の適用は、下書きの手順と互いに依存するため、投稿フォームの本体に残す。
 */
export const useScheduleFlow = ({
    setStatus,
    setStatusColor,
}: UseScheduleFlowParams) => {
    // 予約の状態（日時なし・新規の予約・予約の編集中・編集中に取り消した後）
    const [scheduleMode, setScheduleMode] =
        useState<ScheduleMode>(initialScheduleMode)

    const [runAtPickerOpen, setRunAtPickerOpen] = useState(false)

    // 日時の指定を開くたびに取得する、待機中の予約の件数（取得前・失敗は null）
    const [pendingCount, setPendingCount] = useState<number | null>(null)
    useEffect(() => {
        if (!runAtPickerOpen) return
        let cancelled = false
        setPendingCount(null)
        void fetchPendingCount().then(count => {
            if (!cancelled) setPendingCount(count)
        })
        return () => {
            cancelled = true
        }
    }, [runAtPickerOpen])

    const [editChoiceOpen, setEditChoiceOpen] = useState(false)
    const [editChoiceBusy, setEditChoiceBusy] = useState(false)
    const [scheduleLoading, setScheduleLoading] = useState(false)

    // 失敗した予約から書き戻した入力のとき、その履歴の識別子。送信に成功したら履歴を削除する
    const [restoredFailedId, setRestoredFailedId] = useState<string | null>(
        null,
    )

    // 予約投稿が無効のときにカレンダーのボタンを押した際の、設定への案内
    const [setupGuideOpen, setSetupGuideOpen] = useState(false)
    // 許可が無効になったときにカレンダーのボタンを押した際の、再度の許可のダイアログ
    const [reauthOpen, setReauthOpen] = useState(false)

    /**
     * 失敗した予約から書き戻した入力の送信に成功したとき、元の失敗の履歴をバックグラウンドで削除する。
     * 失敗しても利用者の操作は妨げない（履歴は保持期間の後片付けで消える）。
     */
    const deleteRestoredFailedSilently = () => {
        if (!restoredFailedId) return
        void cancelSchedule(restoredFailedId)
    }

    /**
     * 実行日時の設定・解除を反映する。
     *
     * 処理の趣旨:
     * - 予約の編集中に解除したら、確認なしで予約を取り消す。フォームの内容は残す。
     * - 取消に失敗したら、編集中の状態と日時に戻して文言を表示する。
     *
     * Input:
     * - `next`: 設定した日時、または解除（null）
     */
    const handleRunAtChange = async (next: Date | null) => {
        const previous = scheduleMode
        const { mode, cancelScheduleId } = applyRunAtChange(previous, next)
        setScheduleMode(mode)
        if (!cancelScheduleId) return
        const result = await cancelSchedule(cancelScheduleId)
        if (!result.ok) {
            setScheduleMode(previous)
            setStatus(deferMessage(result.messageKey))
            setStatusColor("#b00")
            return
        }
        setStatus(deferMessage("schedule.cancelled"))
        setStatusColor("green")
    }

    return {
        scheduleMode,
        setScheduleMode,
        runAtPickerOpen,
        setRunAtPickerOpen,
        pendingCount,
        setPendingCount,
        editChoiceOpen,
        setEditChoiceOpen,
        editChoiceBusy,
        setEditChoiceBusy,
        scheduleLoading,
        setScheduleLoading,
        restoredFailedId,
        setRestoredFailedId,
        setupGuideOpen,
        setSetupGuideOpen,
        reauthOpen,
        setReauthOpen,
        deleteRestoredFailedSilently,
        handleRunAtChange,
    }
}
