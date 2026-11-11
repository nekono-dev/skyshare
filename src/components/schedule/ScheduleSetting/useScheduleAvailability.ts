/**
 * 予約投稿の認可状態と実行制限を取得する React フック。
 *
 * - 登録状態のヒント cookie は7日間利用し、未利用者のページ遷移でサーバー照会を発生させない。
 * - 明示的な再取得、変更通知、設定画面では cookie を使わず照会する。
 * - ゲスト表示では通信せず、制限値は実行環境ごとに一度取得し、失敗時は null のまま扱う。
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
    getScheduleCredential,
    getScheduleLimits,
} from "@/client/openapi/client"
import { readScheduleHint } from "@/lib/schedule/availabilityHint"
import type { ScheduleLimits } from "@/lib/schedule/scheduleLimits"

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
 * - `revalidate`: 真なら、マウントとページ遷移のたびに cookie を使わず問い合わせる（設定の画面）
 *
 * Output:
 * - `registered`: 登録済みなら true。取得前・取得の失敗・ゲストは null。
 *   再度の許可が必要なときも true（設定のスイッチをオフに戻さない）
 * - `reauthRequired`: 許可が無効になり、再度の許可が必要なら true
 * - `expiresAt`: 許可の有効期限の目安。無い・再度の許可が必要なときは null
 * - `limits`: 制限値。取得前と取得の失敗は null
 * - `reload`: cookie を使わずに登録状態を取得し直す（予約の UI を開くときに呼ぶ）
 *
 * Example: `const { registered, limits } = useScheduleAvailability(!guestMode)`
 */
export const useScheduleAvailability = (
    enabled: boolean,
    revalidate = false,
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
    // 次の取得で cookie を使わず問い合わせるか。取得の効果が読んで下ろす
    const forceRef = useRef(revalidate)
    const reload = useCallback(() => {
        forceRef.current = true
        setVersion(v => v + 1)
    }, [])
    const refresh = useCallback(() => {
        if (revalidate) forceRef.current = true
        setVersion(v => v + 1)
    }, [revalidate])

    // 登録状態の取得。古い応答で新しい結果を上書きしないよう、取り消しの印を持つ
    useEffect(() => {
        if (!enabled) {
            setRegistered(null)
            return
        }
        const force = forceRef.current
        forceRef.current = false
        const hint = force ? undefined : readScheduleHint(document.cookie)
        if (hint) {
            setRegistered(hint.registered)
            setReauthRequired(hint.reauthRequired)
            setExpiresAt(hint.expiresAt ? new Date(hint.expiresAt) : null)
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
        document.addEventListener("astro:page-load", refresh)
        return () => {
            window.removeEventListener(SCHEDULE_CREDENTIAL_EVENT, reload)
            document.removeEventListener("astro:page-load", refresh)
        }
    }, [enabled, reload, refresh])

    return { registered, reauthRequired, expiresAt, limits, reload }
}
