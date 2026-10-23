/**
 * 予約の作成（POST /v2/schedules）と置き換え（PUT /v2/schedules/{id}）に共通の受け付け処理。
 *
 * 責務と処理概要:
 * - multipart の入力を作成と同じスキーマで解析し、投稿の作成と同じ規則で内容を検証する。
 * - 実行時刻 → 認証情報の登録 → 待機中の件数（作成のときだけ）→ 画像の保管 → 認証情報の使用時刻の更新
 *   の順に処理し、保存に使う本文と画像のキーを返す。保存そのものは呼び出し側が行う。
 *
 * 実装上の制約:
 * - `@atproto/*` を静的にも動的にも読み込まない（無料枠の CPU 時間を守るため）。
 */
import { formDataToObject } from "@/util/formData"
import { isMultipartFormData } from "@/util/http"
import { validateFacets } from "@/lib/atproto/facet"
import { validateImageMetadata } from "@/lib/atproto/embed"
import { isReplyRefOwnedBySelf } from "@/lib/atproto/post"
import * as PostSchema from "@/lib/api/schema/v2/schedules/post"
import type { ScheduleEnv } from "./cfTypes"
import { newImageGeneration, putImages } from "./imageStaging"
import type { ScheduleErrorCode } from "./scheduleResponse"
import { MAX_PENDING_PER_ACCOUNT } from "./scheduleLimits"
import { countPending, getCredentialStatus, touchCredential } from "./store"
import { MAX_IMAGE_BYTES_PER_SCHEDULE } from "./types"
import { toStoredPayload, validateRunAt } from "./validateSchedule"

export type ScheduleRequestBody = PostSchema.RequestBodyType

/**
 * multipart の入力を予約の作成の入力スキーマで解析し、内容を検証する。
 *
 * 期待する入力: `multipart/form-data`（`posts[n].*` と `runAt` ほか）。
 * 空白だけの本文は「本文なし」として扱う（投稿の作成と同じ）。
 *
 * Input:
 * - `request`: リクエスト
 * - `did`: セッションのアカウント（返信先の所有の確認に使う）
 *
 * Output: 検証済みの入力。形式や内容が不正なら null（呼び出し側が 400 を返す）
 *
 * Example: `const body = await parseScheduleBody(request, session.did)`
 */
export const parseScheduleBody = async (
    request: Request,
    did: string,
): Promise<ScheduleRequestBody | null> => {
    if (!isMultipartFormData(request.headers.get("content-type"))) return null
    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return null
    }

    const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
    if (Array.isArray(raw.posts)) {
        for (const item of raw.posts as Record<string, unknown>[]) {
            if (typeof item.text === "string" && item.text.trim().length === 0) {
                delete item.text
            }
        }
    }
    const body = PostSchema.RequestBodySchema.safeParse(raw)
    if (!body.success) return null

    // 投稿内容の検証（投稿の作成と同じ規則）
    if (!isReplyRefOwnedBySelf(body.data.reply, did)) return null
    if (body.data.createEntry === true && !body.data.visual) return null
    for (const item of body.data.posts) {
        const images = "images" in item ? item.images : undefined
        const imagesMeta = "imagesMeta" in item ? item.imagesMeta : undefined
        try {
            validateImageMetadata(images, imagesMeta)
            validateFacets(item.text ?? "", item.facets)
        } catch {
            return null
        }
    }
    return body.data
}

export type StageResult =
    | { ok: true; runAt: number; payload: string; imageKeys: string[] }
    | { ok: false; status: 400 | 409 | 429 | 500; error?: ScheduleErrorCode }

/**
 * 検証済みの入力を、保存できる形（実行時刻・本文・保管した画像のキー）にする。
 *
 * Input:
 * - `env`: D1・R2 のバインディング
 * - `did` `id`: 所有アカウントと予約の識別子（画像のキーに使う）
 * - `body`: `parseScheduleBody` の結果
 * - `nowSeconds`: 現在時刻（UNIX 秒）
 * - `opts.countPending`: 待機中の件数の上限を確かめるか（作成は真、置き換えは偽）
 *
 * Output:
 * - 成功: `{ ok: true, runAt, payload, imageKeys }`。保存に失敗したら呼び出し側が画像を消す
 * - 失敗: 範囲外・容量超過は 400、未登録は 409（ScheduleCredentialRequired）、
 *   再度の許可が必要なら 409（ScheduleReauthRequired）、上限は 429、保管の失敗は 500
 *
 * Example: `await stageSchedule(env, did, id, body, now, { countPending: true })`
 */
export const stageSchedule = async (
    env: ScheduleEnv,
    did: string,
    id: string,
    body: ScheduleRequestBody,
    nowSeconds: number,
    opts: { countPending: boolean },
): Promise<StageResult> => {
    const runAt = validateRunAt(body.runAt, nowSeconds)
    if (!runAt.ok) return { ok: false, status: 400 }

    const credential = await getCredentialStatus(env.DB, did)
    if (!credential.registered) {
        return { ok: false, status: 409, error: "ScheduleCredentialRequired" }
    }
    if (credential.reauthRequired) {
        return { ok: false, status: 409, error: "ScheduleReauthRequired" }
    }
    // 件数は予約の行数で数える（スレッドも1件）
    if (
        opts.countPending &&
        (await countPending(env.DB, did)) >= MAX_PENDING_PER_ACCOUNT
    ) {
        return { ok: false, status: 429 }
    }

    const { payload, images } = await toStoredPayload(body)
    const total = images.reduce((sum, img) => sum + img.bytes.byteLength, 0)
    if (total > MAX_IMAGE_BYTES_PER_SCHEDULE) return { ok: false, status: 400 }

    let imageKeys: string[]
    try {
        imageKeys = await putImages(
            env.SCHEDULE_IMAGES,
            did,
            id,
            newImageGeneration(),
            images,
        )
    } catch (err) {
        console.error(`stageSchedule: putImages failed id=${id}`, err)
        return { ok: false, status: 500 }
    }
    // 予約の作成と置き換えを「認証情報の使用」とみなし、未使用の削除から外す
    await touchCredential(env.DB, did, nowSeconds)
    return {
        ok: true,
        runAt: runAt.epoch,
        payload: JSON.stringify(payload),
        imageKeys,
    }
}
