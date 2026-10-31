/**
 * 予約用の認証情報の状態（GET /v2/schedules/credential）と、予約投稿の無効化（DELETE /v2/schedules/credential）の判断。
 *
 * 責務と処理概要:
 * - 認証情報の状態は、応答の本体と登録状態のヒント（cookie の値の元になる形）を返す。トークンは返さない。
 * - 無効化は、実行中の予約の確認 → 待機中と失敗の予約の削除と画像の後始末 → トークンの取り消し → 認証情報の削除、の順で行う。
 * - バインディングは関数の中で取得する。想定外の例外は捕まえず、呼び出し側へ投げる。
 *
 * 実装上の制約:
 * - `lib/api` を import しない（HTTP の形は持たない）。応答の本体は、このファイルのローカルの型で表す。
 * - Cookie の組み立て（Set-Cookie の値）は行わない。ページが `hint` から組み立てる。
 */
import type { Outcome } from "@/util/outcome"
import type { ScheduleHint } from "@/lib/schedule/availabilityHint"
import { getScheduleEnv } from "@/lib/schedule/env"
import { estimateCredentialExpiry } from "@/lib/schedule/credentialExpiry"
import { parseCredential } from "@/lib/schedule/oauth/storedCredential"
import { revokeCredential } from "@/lib/schedule/oauth/flow"
import { removeImages } from "@/lib/schedule/imageStaging"
import { toIso } from "@/lib/schedule/scheduleResponse"
import {
    deleteCredential,
    deleteSchedulesExceptRunning,
    getCredentialStatus,
    listSchedules,
    loadCredential,
    parseKeys,
} from "@/lib/schedule/store"

/** 認証情報の状態の応答の本体（GET の応答と同じ形） */
export type CredentialStateDto =
    | { registered: false; reauthRequired: false }
    | {
          registered: true
          reauthRequired: boolean
          updatedAt: string
          expiresAt?: string
      }

/**
 * 認証情報の状態を返す。
 *
 * Input: `did`（要求したアカウント）
 * Output: 応答の本体と、登録状態のヒント（ページが cookie にする値）
 *
 * Example: `await getCredentialState({ did })` → `{ body: { registered: false, reauthRequired: false }, hint: { registered: false, reauthRequired: false } }`
 */
export const getCredentialState = async (input: {
    did: string
}): Promise<{ body: CredentialStateDto; hint: ScheduleHint }> => {
    const env = await getScheduleEnv()
    const status = await getCredentialStatus(env.DB, input.did)
    if (!status.registered) {
        return {
            body: { registered: false, reauthRequired: false },
            hint: { registered: false, reauthRequired: false },
        }
    }
    const expiresAt = status.reauthRequired
        ? undefined
        : toIso(estimateCredentialExpiry(status))
    return {
        body: {
            registered: true,
            reauthRequired: status.reauthRequired,
            updatedAt: toIso(status.updatedAt),
            ...(expiresAt === undefined ? {} : { expiresAt }),
        },
        hint: {
            registered: true,
            reauthRequired: status.reauthRequired,
            ...(expiresAt === undefined ? {} : { expiresAt }),
        },
    }
}

/**
 * 予約投稿を無効にする。
 *
 * 処理の順序:
 * 1. 実行中の予約があれば 409（ScheduleRunning）を返し、何もしない。
 * 2. 待機中と失敗の予約を一括で削除し、それぞれの画像を削除する（画像の削除の失敗は記録だけする）。
 * 3. 認可サーバーで更新用トークンを取り消す（失敗しても続ける）。
 * 4. 認証情報を削除し、取り消した待機中の件数と削除した失敗の件数を返す。
 *    登録が無くても成功を返す（冪等）。
 *
 * Input: `did`（要求したアカウント）
 * Output: 成功は `{ cancelled, deletedHistory }`。失敗は 409（ScheduleRunning）
 *
 * Example: `await disableScheduling({ did })` → `{ ok: true, value: { cancelled: 2, deletedHistory: 1 } }`
 */
export const disableScheduling = async (input: {
    did: string
}): Promise<Outcome<{ cancelled: number; deletedHistory: number }>> => {
    const env = await getScheduleEnv()
    const running = await listSchedules(env.DB, input.did, {
        status: "running",
        limit: 1,
    })
    if (running.items.length > 0) {
        return { ok: false, status: 409, code: "ScheduleRunning" }
    }

    const deleted = await deleteSchedulesExceptRunning(env.DB, input.did)
    for (const row of deleted) {
        await removeImages(env.SCHEDULE_IMAGES, parseKeys(row.imageKeys)).catch(
            err => {
                console.error(
                    `schedule credential DELETE: removeImages failed id=${row.id}`,
                    err,
                )
            },
        )
    }

    const stored = await loadCredential(
        env.DB,
        env.SCHEDULE_ENC_KEY,
        input.did,
    ).catch(() => null)
    const credential = stored ? parseCredential(stored.token) : null
    if (credential) {
        await revokeCredential(env, credential, Math.floor(Date.now() / 1000))
    }

    await deleteCredential(env.DB, input.did)
    return {
        ok: true,
        value: {
            cancelled: deleted.filter(r => r.status === "pending").length,
            deletedHistory: deleted.filter(r => r.status === "failed").length,
        },
    }
}
