/**
 * 予約投稿が使えるか（認証情報の登録の有無と制限値）を取得する React フック。
 *
 * 責務と処理概要:
 * - マウント時・ページ遷移（`astro:page-load`）・登録状態の変更の通知のたびに、登録状態を取得し直す。
 * - 制限値は、最初に登録済みと分かったときに1回だけ取得する（実行環境が変わらない限り変化しない）。
 * - 設定画面で登録・削除したときは `notifyScheduleCredentialChange` で通知し、
 *   同じページの投稿フォームのカレンダーのボタンを即座に有効・無効へ切り替える。
 */
import { useCallback, useEffect, useState } from "react"
import {
    getScheduleCredential,
    getScheduleLimits,
} from "@/client/openapi/client"
import type { ScheduleLimits } from "./scheduleLimits"

export const SCHEDULE_CREDENTIAL_EVENT = "skyshare:schedule-credential-change"

/**
 * 予約用の認証情報の登録・削除を、同じページの部品へ知らせる。
 *
 * Example: 登録に成功したら `notifyScheduleCredentialChange()`
 */
export const notifyScheduleCredentialChange = (): void => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent(SCHEDULE_CREDENTIAL_EVENT))
}

/**
 * 予約投稿の可否を取得する。
 *
 * Input:
 * - `enabled`: 偽（ゲストの表示）のときは通信しない
 *
 * Output:
 * - `registered`: 登録済みなら true。取得前・取得の失敗・ゲストは null。
 *   再度の許可が必要なときも true（設定のスイッチをオフに戻さない）
 * - `reauthRequired`: 許可が無効になり、再度の許可が必要なら true
 * - `expiresAt`: 許可の有効期限の目安。無い・再度の許可が必要なときは null
 * - `limits`: 制限値。取得前と取得の失敗は null
 * - `reload`: 登録状態を取得し直す
 *
 * Example: `const { registered, limits } = useScheduleAvailability(!guestMode)`
 */
export const useScheduleAvailability = (
    enabled: boolean,
): {
    registered: boolean | null
    reauthRequired: boolean
    expiresAt: Date | null
    limits: ScheduleLimits | null
    reload: () => void
} => {
    const [registered, setRegistered] = useState<boolean | null>(null)
    const [reauthRequired, setReauthRequired] = useState(false)
    const [expiresAt, setExpiresAt] = useState<Date | null>(null)
    const [limits, setLimits] = useState<ScheduleLimits | null>(null)
    const [version, setVersion] = useState(0)
    const reload = useCallback(() => setVersion(v => v + 1), [])

    // 登録状態の取得。古い応答で新しい結果を上書きしないよう、取り消しの印を持つ
    useEffect(() => {
        if (!enabled) {
            setRegistered(null)
            return
        }
        let cancelled = false
        void (async () => {
            try {
                const res = await getScheduleCredential()
                if (cancelled) return
                if (res.status !== 200) {
                    setRegistered(null)
                    return
                }
                setRegistered(res.data.registered)
                setReauthRequired(res.data.reauthRequired)
                setExpiresAt(
                    res.data.expiresAt ? new Date(res.data.expiresAt) : null,
                )
            } catch {
                if (!cancelled) setRegistered(null)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [enabled, version])

    // 制限値は登録済みと分かった最初の1回だけ取得する
    useEffect(() => {
        if (registered !== true || limits !== null) return
        let cancelled = false
        void (async () => {
            try {
                const res = await getScheduleLimits()
                if (!cancelled && res.status === 200) setLimits(res.data)
            } catch {
                // 取得に失敗したら null のまま（カレンダーのボタンは無効になる）
            }
        })()
        return () => {
            cancelled = true
        }
    }, [registered, limits])

    // ページ遷移と、設定画面からの登録状態の変更の通知を購読する
    useEffect(() => {
        if (!enabled) return
        window.addEventListener(SCHEDULE_CREDENTIAL_EVENT, reload)
        document.addEventListener("astro:page-load", reload)
        return () => {
            window.removeEventListener(SCHEDULE_CREDENTIAL_EVENT, reload)
            document.removeEventListener("astro:page-load", reload)
        }
    }, [enabled, reload])

    return { registered, reauthRequired, expiresAt, limits, reload }
}
