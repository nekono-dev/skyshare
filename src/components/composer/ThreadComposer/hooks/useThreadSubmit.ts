/**
 * 投稿・予約の送信状態、結果表示、成功後の後処理を管理する。
 * リクエスト本文の組み立てと共有先の分岐は純粋な判断関数へ委ねる。
 */
import { type Dispatch, type SetStateAction, useRef, useState } from "react"
import { RichText } from "@atproto/api"
import type { CreateScheduleBody } from "@/client/openapi/model"
import { deferMessage, type DeferredMessage } from "@/lib/i18n/translate"
import type { IntentShareRequest } from "@/components/share/IntentShareDialog"
import { detectLinkFacets, extractTagsFromFacets } from "@/lib/atproto/richtext"
import { addHashtagsToHistory } from "@/lib/settings/hashtagHistorySettings"
import {
    readPostGateDefaultSetting,
    writePostGateDefaultSetting,
} from "@/lib/settings/postGateSettings"
import { resolveInstanceDomainFor } from "@/lib/settings/shareSettings"
import { resolveShareBody } from "@/lib/share/shareBody"
import {
    openIntentPopup,
    preOpenPopupWindow,
} from "@/components/share/IntentShareDialog/openIntentPopup"
import {
    canShareWithWebApi,
    shareWithWebApi,
} from "@/components/share/IntentShareDialog/webShare"
import { submitSchedule } from "@/lib/schedule/submitSchedule"
import type { submitTarget } from "@/lib/schedule/scheduleMode"
import type { useShareToggles } from "@/components/settings/Settings/useShareToggles"
import { buildThreadRequestBody, submitThread } from "../rules/submitThread"
import { runShareDispatch } from "../rules/shareDispatch"
import type { LoadedDraft } from "./useDraftFlow"
import type { ScheduleMode } from "@/lib/schedule/scheduleMode"
import type { SegmentState } from "../rules/segments"

export type UseThreadSubmitParams = {
    segments: SegmentState[]
    rootSegment: SegmentState
    setStatus: Dispatch<SetStateAction<DeferredMessage | null>>
    setStatusColor: Dispatch<SetStateAction<string | undefined>>
    target: ReturnType<typeof submitTarget>
    canSubmitNow: boolean
    guestMode: boolean
    accountDid: string | null | undefined
    shareToggles: ReturnType<typeof useShareToggles>
    syncGateDefaultAfterPost: boolean
    loadedDraft: LoadedDraft | null
    setLoadedDraft: Dispatch<SetStateAction<LoadedDraft | null>>
    setScheduleMode: Dispatch<SetStateAction<ScheduleMode>>
    setShareRequest: Dispatch<SetStateAction<IntentShareRequest | null>>
    onShareRequest?: (request: IntentShareRequest) => void
    onPosted?: () => void
    resetInputFields: (rootPostGate: SegmentState["postGate"]) => void
    deleteDraftSilently: (draftId: string) => Promise<void>
    deleteRestoredFailedSilently: () => void
}

/**
 * 投稿確定後、本文中のハッシュタグをローカル履歴（`hashtagHistorySettings.ts`）へ記録する。
 *
 * 処理の趣旨:
 * - 候補機能（`useSuggest`）のハッシュタグ候補は、Bluesky公開APIのグローバルなトレンドだけでは
 *   賄えないため、このブラウザで過去に自分が使ったタグを補う目的でここに記録する。
 * - facet抽出に失敗しても投稿フロー自体は継続させたいため、例外を握りつぶす。
 *
 * Input:
 * - `text`: 投稿本文
 * - `accountDid`: 履歴を分離するアカウントの識別子。未解決なら記録しない
 *
 * Output:
 * - なし
 */
const recordUsedHashtagsToHistory = (
    text: string,
    accountDid: string | null | undefined,
) => {
    try {
        const rt = new RichText({ text })
        rt.detectFacetsWithoutResolution()
        const tags = extractTagsFromFacets(rt.facets)
        addHashtagsToHistory(tags, accountDid)
    } catch (err) {
        console.warn("ThreadComposer: failed to record hashtag history", err)
    }
}

/**
 * 投稿と予約の送信（送信中の印・結果の表示・投稿後の後片付け）を持つ。
 * 送信の組み立てと共有の分岐は、判断の関数（`submitThread`・`shareDispatch`）に委ねる。
 */
export const useThreadSubmit = ({
    segments,
    rootSegment,
    setStatus,
    setStatusColor,
    target,
    canSubmitNow,
    guestMode,
    accountDid,
    shareToggles,
    syncGateDefaultAfterPost,
    loadedDraft,
    setLoadedDraft,
    setScheduleMode,
    setShareRequest,
    onShareRequest,
    onPosted,
    resetInputFields,
    deleteDraftSilently,
    deleteRestoredFailedSilently,
}: UseThreadSubmitParams) => {
    // 送信中の2回目の確定操作を、state の反映を待たずに無視するための印
    const submittingRef = useRef(false)

    const [isSubmitting, setIsSubmitting] = useState(false)

    /**
     * 予約の作成・置き換えを送信する（実行日時が設定されているときの送信ボタン）。
     *
     * 処理の趣旨:
     * - 本文は投稿の作成と同じ組み立てを使い、他の SNS への共有は行わない。
     * - 成功したら完了を表示し、ハッシュタグの履歴を記録して、フォームを初期化する
     *   （開いていた下書きは予約へ移したものとして削除する）。
     * - 置き換えの時点で予約が実行中になっていたら、取り消された後と同じ扱い（detached）にする。
     *
     * Input:
     * - `scheduleTarget`: 新規の予約か、編集中の予約と実行日時
     */
    const handleScheduleSubmit = async (
        scheduleTarget: Exclude<typeof target, { kind: "post" }>,
    ) => {
        setIsSubmitting(true)
        setStatus(deferMessage("schedule.sending"))
        setStatusColor(undefined)
        try {
            const built = await buildThreadRequestBody({
                segments,
                manualImageAttach: shareToggles.manualImageAttach,
            })
            if (!built.ok) {
                setStatus(deferMessage(built.messageKey))
                setStatusColor("#b00")
                return
            }
            const result = await submitSchedule(
                scheduleTarget,
                built.body as unknown as Omit<CreateScheduleBody, "runAt">,
            )
            if (!result.ok) {
                if (
                    scheduleTarget.kind === "update" &&
                    result.messageKey === "schedule.error.running"
                ) {
                    setScheduleMode({ kind: "detached" })
                }
                setStatus(deferMessage(result.messageKey))
                setStatusColor("#b00")
                return
            }
            segments.forEach(segment =>
                recordUsedHashtagsToHistory(segment.text, accountDid),
            )
            if (loadedDraft) void deleteDraftSilently(loadedDraft.id)
            deleteRestoredFailedSilently()
            let nextRootPostGate = rootSegment.postGate
            if (syncGateDefaultAfterPost) {
                writePostGateDefaultSetting(rootSegment.postGate)
            } else {
                nextRootPostGate = readPostGateDefaultSetting()
            }
            resetInputFields(nextRootPostGate)
            setStatus(
                deferMessage(
                    scheduleTarget.kind === "create"
                        ? "schedule.created"
                        : "schedule.updated",
                ),
            )
            setStatusColor("green")
        } catch (err) {
            console.error(err)
            setStatus(deferMessage("error.network"))
            setStatusColor("#b00")
        } finally {
            setIsSubmitting(false)
        }
    }

    /**
     * 投稿フォームの内容を API 契約に合わせて送信する。
     *
     * Input:
     * - `e`: フォーム送信イベント
     *
     * Output:
     * - なし
     */
    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        // Enterキー等によるフォーム送信でもボタンと同じ投稿条件でブロックする
        if (isSubmitting || submittingRef.current || !canSubmitNow) return

        // 実行日時が設定されていれば予約として送信する（共有のポップアップは開かない）
        if (target.kind !== "post") {
            submittingRef.current = true
            try {
                await handleScheduleSubmit(target)
            } finally {
                submittingRef.current = false
            }
            return
        }

        // 投稿API呼び出し（下のawait）を挟んでからwindow.openすると、iOS Safariでは
        // ユーザーアクティベーションが失効気味になり、実際にはポップアップが開いて
        // いるのに戻り値だけ`false`扱いになりフォールバック（ボタン表示）が誤って
        // 走ることがある。そのため自動ポップアップが行われる設定の場合は、ここ
        // （ユーザー操作と同期的なコールスタック内）で先に空のポップアップを開いて
        // おき、URL確定後にrunShareDispatch内でそこへ遷移させる。
        // 自動ポップアップ先を決められない場合（投稿時に選択する、またはMastodon/Misskeyの
        // ドメインが不正）は、ポップアップを開かず投稿先選択ダイアログに委ねるため開かない。
        const willAutoPopup =
            shareToggles.popupIntentInsteadOfWebshare &&
            shareToggles.autoPopupTarget !== "ask" &&
            resolveInstanceDomainFor(
                shareToggles.autoPopupTarget,
                shareToggles,
            ) !== null
        const popupWindow = willAutoPopup ? preOpenPopupWindow() : null

        setIsSubmitting(true)
        setStatus(
            deferMessage(
                guestMode
                    ? "post.composer.guestProcessing"
                    : "post.composer.sending",
            ),
        )
        setStatusColor(undefined)

        try {
            // ゲスト表示ではBluesky認証セッションが無いため、実際の投稿(submitThread)は
            // 行わずスキップする。ただしポップアップ/WebShareAPI等の後続処理は通常時と
            // 同じフローで実行し、見た目を体験できるようにする。
            let skyshareUri = ""
            // 「投稿後にデフォルト値を更新する」がONなら今回使った（先頭セグメントの）設定を
            // 維持し、OFFなら保存済みのデフォルト値へ都度リセットする。投稿成功後、下の
            // textToKeep/resetInputFields分岐でまとめて`segments`へ反映する（`segments`への
            // 更新を複数回に分けてsetSegmentsすると、後発の呼び出しが先発の変更を
            // 古いクロージャの値で上書きしてしまうため、ここでは値の算出のみに留める）。
            let nextRootPostGate = rootSegment.postGate

            if (!guestMode) {
                const result = await submitThread({
                    segments,
                    manualImageAttach: shareToggles.manualImageAttach,
                })

                if (!result.ok) {
                    popupWindow?.close()
                    setStatusColor("#b00")
                    setStatus(deferMessage(result.messageKey))
                    return
                }

                skyshareUri = result.skyshareUri

                if (syncGateDefaultAfterPost) {
                    writePostGateDefaultSetting(rootSegment.postGate)
                } else {
                    nextRootPostGate = readPostGateDefaultSetting()
                }

                if (loadedDraft) {
                    void deleteDraftSilently(loadedDraft.id)
                    setLoadedDraft(null)
                }
                deleteRestoredFailedSilently()
            }

            segments.forEach(segment =>
                recordUsedHashtagsToHistory(segment.text, accountDid),
            )

            // 「Skyshareのリンクカードを優先表示」が有効で skyshare URL を共有する場合は、
            // 本文のURLを共有文から取り除く（自動ポップアップ・WebShare・投稿先選択ダイアログ共通）。
            const shareBody = resolveShareBody({
                text: rootSegment.text,
                facets:
                    skyshareUri === ""
                        ? []
                        : detectLinkFacets(rootSegment.text),
                entryUrl: skyshareUri,
                linkCardUrl: rootSegment.ogpResult?.sourceUrl ?? "",
                preferSkyshareLinkCard:
                    shareToggles.effectivePreferSkyshareLinkCard,
            })

            const dispatch = await runShareDispatch({
                browser: {
                    openIntentPopup,
                    canShareWithWebApi,
                    shareWithWebApi,
                },
                text: shareBody.text,
                skyshareUri,
                linkCardUrl: shareBody.linkCardUrl,
                imageEntry: rootSegment.imageEntry,
                manualImageAttach: shareToggles.manualImageAttach,
                truncateIntentText: shareToggles.truncateIntentText,
                popupIntentInsteadOfWebshare:
                    shareToggles.popupIntentInsteadOfWebshare,
                autoPopupTarget: shareToggles.autoPopupTarget,
                mastodonInstanceDomain: shareToggles.mastodonInstanceDomain,
                misskeyInstanceDomain: shareToggles.misskeyInstanceDomain,
                popupWindow,
                guestMode,
            })

            onPosted?.()

            if (dispatch.forcedPopupIntentInsteadOfWebshareOn) {
                shareToggles.onPopupIntentInsteadOfWebshareChange(true)
            }
            if (dispatch.forcedAutoPopupTarget !== null) {
                shareToggles.onAutoPopupTargetChange(
                    dispatch.forcedAutoPopupTarget,
                )
            }
            // 投稿先選択ダイアログは入力欄の内容に依存しないよう、本文・URLをここで確定させる。
            // 入力欄は結果に関わらず常にクリアする（skyshare URLはダイアログ側が保持する）。
            if (dispatch.openShareDialog) {
                const request: IntentShareRequest = {
                    postText: shareBody.text,
                    entryUrl: skyshareUri === "" ? null : skyshareUri,
                    linkCardUrl: shareBody.linkCardUrl,
                }
                if (onShareRequest) {
                    onShareRequest(request)
                } else {
                    setShareRequest(request)
                }
            }
            resetInputFields(nextRootPostGate)
            setStatus({ format: dispatch.status })
            setStatusColor(dispatch.statusColor)
        } catch (err) {
            popupWindow?.close()
            console.error(err)
            setStatusColor("#b00")
            setStatus(deferMessage("error.network"))
        } finally {
            setIsSubmitting(false)
        }
    }

    return { isSubmitting, handleScheduleSubmit, handleSubmit }
}
