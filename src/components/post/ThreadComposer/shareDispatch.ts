/**
 * PostForm の投稿成功後の共有ディスパッチ（ポップアップ/WebShareAPIの実行判断と
 * 実行、投稿先選択ダイアログの要否・ステータスメッセージの決定）を担うモジュール。
 *
 * 責務と処理概要:
 * - `specs/auto-popup` に定義された、共有系設定（WebShareの代わりにポップアップを開く・
 *   自動ポップアップするSNS・画像を自分で添付・長文を省略して共有）の組み合わせに応じた
 *   自動ポップアップ/WebShareAPI/投稿先選択ダイアログの分岐ロジックを集約する。
 * - Reactのstateには一切触れず、実行結果を `ShareDispatchResult` として返すのみ。
 *   呼び出し側（`index.tsx`）がその内容に応じて state を更新する。
 */
import type { ImageEntry } from "@/components/image/ImagePicker"
import type { MessageFormatter } from "@/lib/i18n/translate"
import {
    resolveMastodonInstanceDomain,
    type AutoPopupTarget,
} from "@/lib/settings/shareSettings"
import {
    IntentTarget,
    buildIntentText,
    openIntentPopupFor,
    resolveTruncateLimit,
} from "@/util/share/intent"
import { resolveIntentMeasure } from "@/util/share/intentLength"
import {
    canShareWithWebApi,
    shareWithWebApi,
    toShareFile,
} from "@/util/share/webShare"

export type ShareDispatchParams = {
    text: string
    skyshareUri: string
    /**
     * 投稿に添付されたリンクカードの元URL（無ければ空文字）。
     * Blueskyはリンクカードを埋め込みとして添付するため本文にURLが無くても
     * 投稿できるが、他SNSのintentは本文のみで共有するため、本文にこのURLが
     * 含まれていない場合はintent本文の末尾へ補完する必要がある。
     */
    linkCardUrl: string
    imageEntry: ImageEntry | null
    manualImageAttach: boolean
    /**
     * X/タイッツー向け共有文の長文省略設定。WebShareAPIに渡す共有文には適用しない。
     */
    truncateIntentText: boolean
    popupIntentInsteadOfWebshare: boolean
    /** 自動ポップアップするSNS。`popupIntentInsteadOfWebshare` がtrueの場合のみ参照する。 */
    autoPopupTarget: AutoPopupTarget
    /** Mastodonインスタンスドメインの保存値そのまま（未設定は空文字） */
    mastodonInstanceDomain: string
    /**
     * 呼び出し側が投稿API呼び出し（await）より前に`preOpenPopupWindow`で
     * 事前に開いておいたポップアップウィンドウ。自動ポップアップ対象になった
     * targetの遷移先として使う（詳細は`openIntentPopup`を参照）。未使用に
     * 終わった場合はこの関数側で閉じる。
     */
    popupWindow: Window | null
    /**
     * ログイン不要のゲスト表示。Blueskyへの投稿自体は行っていないため、
     * ステータス文言を「投稿に成功しました」ではなく「投稿はスキップしました」に
     * 差し替える。ポップアップ/WebShareAPIの分岐ロジック自体は通常時と同じ。
     */
    guestMode?: boolean
}

export type ShareDispatchResult = {
    /** 表示するステータス文言。言語は描画時に決まるため、文字列ではなく組み立て関数で返す。 */
    status: MessageFormatter
    statusColor: string
    /**
     * true なら呼び出し側で投稿先選択ダイアログ（本文・skyshare URL・リンクカードURLを保持）を開く。
     * 投稿フォームの入力欄は結果に関わらず呼び出し側で常にクリアする。
     */
    openShareDialog: boolean
    /**
     * true なら呼び出し側で onPopupIntentInsteadOfWebshareChange(true) を呼ぶ必要がある
     * （WebShareAPIが非対応、または実際に試行して失敗した場合。以後はWebShareAPIを
     * 試さずポップアップ経由の共有に切り替えるフォールバック）。
     */
    forcedPopupIntentInsteadOfWebshareOn: boolean
    /**
     * 非null なら呼び出し側で onAutoPopupTargetChange(この値) を呼ぶ必要がある
     * （自動ポップアップが開けなかった場合は "ask"、WebShareAPIの代わりにXポップアップを
     * 開けた場合は "x"）。
     */
    forcedAutoPopupTarget: AutoPopupTarget | null
}

/**
 * WebShareAPI へ渡す ShareData を組み立てる。
 *
 * 処理の趣旨:
 * - 「画像を自分で添付する」有効時のみ、選択済み画像を `files` として同梱する。
 *   skyshare entry を作らない代わりに、共有シート経由で画像添付先アプリへ
 *   画像そのものを渡せるようにする。
 *
 * Input:
 * - `text`: 共有テキスト
 * - `imageEntry`: 選択中の画像エントリ
 * - `manualImageAttach`: 「画像を自分で添付する」設定
 *
 * Output:
 * - `navigator.share` に渡せる `ShareData`
 *
 * 例:
 * - 入力: `{ text: "hello", imageEntry: null, manualImageAttach: false }`
 * - 出力: `{ text: "hello" }`
 */
const buildWebShareData = ({
    text,
    imageEntry,
    manualImageAttach,
}: {
    text: string
    imageEntry: ImageEntry | null
    manualImageAttach: boolean
}): ShareData => {
    if (
        !manualImageAttach ||
        !imageEntry ||
        imageEntry.originalBlobs.length === 0
    ) {
        return { text }
    }

    return {
        text,
        files: imageEntry.originalBlobs.map((blob, index) =>
            toShareFile(blob, index),
        ),
    }
}

/**
 * 投稿成功後の共有ディスパッチを実行する。
 *
 * 処理の趣旨（`specs/auto-popup` 準拠）:
 * - PopupIntentInsteadOfWebshare がONの場合、AutoPopupTarget に従う。
 *   "ask"、または "mastodon" でインスタンスドメインが不正な場合は、ポップアップを開かず
 *   投稿先選択ダイアログを開く。X/タイッツー/Mastodon が選ばれていれば、そのSNSの
 *   ポップアップを自動で開く。開けなかった場合は投稿先選択ダイアログを開き、
 *   AutoPopupTarget を "ask" へ変更させる。
 * - OFFの場合はWebShareAPIを試行する。非対応環境、または対応環境で実際に試行したが
 *   失敗した場合（ユーザーによる共有シートのキャンセルを除く）は、その場でXポップアップを
 *   即時に試行し、PopupIntentInsteadOfWebshare をONへフォールバックする。開けた場合は
 *   AutoPopupTarget を "x"、開けなかった場合は "ask" にして投稿先選択ダイアログを開く。
 * - X/タイッツー向けの共有文は、truncateIntentText がONの場合に本文を省略する。WebShareAPIに渡す共有文は省略しない。
 *
 * Input:
 * - `params`: 投稿本文・skyshare URL・共有系設定の現在値
 *
 * Output:
 * - 表示すべきステータス・投稿先選択ダイアログの要否・設定の強制変更の要否
 *
 * 例:
 * - 入力: `{ popupIntentInsteadOfWebshare: true, autoPopupTarget: "ask", ... }`
 * - 出力: `{ openShareDialog: true, forcedAutoPopupTarget: null, ... }`
 */
export const runShareDispatch = async (
    params: ShareDispatchParams,
): Promise<ShareDispatchResult> => {
    const {
        text,
        skyshareUri,
        linkCardUrl,
        imageEntry,
        manualImageAttach,
        truncateIntentText,
        popupIntentInsteadOfWebshare,
        autoPopupTarget,
        mastodonInstanceDomain,
        popupWindow,
        guestMode = false,
    } = params

    // 「画像を自分で添付する」有効時は skyshare エントリを作らないため、
    // ポップアップ/ダイアログ/WebShareAPI のいずれにも URL を含めない。
    const effectiveSkyshareUri = manualImageAttach ? "" : skyshareUri
    // WebShareAPIは共有先SNSを特定できないため、省略しない共有文を使う。
    const webShareText = buildIntentText(
        text,
        effectiveSkyshareUri,
        linkCardUrl,
    )
    // intent（ポップアップ）は宛先ごとに省略要否が決まるため、宛先を受けて組み立てる。
    const buildTextFor = (intentTarget: IntentTarget) =>
        buildIntentText(text, effectiveSkyshareUri, linkCardUrl, {
            truncateLimit: resolveTruncateLimit(
                intentTarget,
                truncateIntentText,
            ),
            // 字数換算は宛先ごとに異なる（タイッツーはURLも全文字を数える）
            measure: resolveIntentMeasure(
                intentTarget === "taittsuu" ? "taittsuu" : "x",
            ),
        })
    const mastodonDomain = resolveMastodonInstanceDomain(mastodonInstanceDomain)
    // 各ステータスの先頭に付ける、投稿結果の文（文末の句点は各文言側で付ける）
    const resultKey = guestMode
        ? "post.share.resultGuest"
        : "post.share.resultSuccess"

    if (popupIntentInsteadOfWebshare) {
        // 自動ポップアップ先を決められない（投稿時に選択する、またはMastodonの
        // ドメインが不正）場合は、ポップアップを開かず投稿先選択ダイアログに委ねる。
        if (
            autoPopupTarget === "ask" ||
            (autoPopupTarget === "mastodon" && mastodonDomain === null)
        ) {
            popupWindow?.close()
            return {
                status: tr =>
                    tr.t("post.share.chooseTarget", {
                        result: tr.t(resultKey),
                    }),
                statusColor: "green",
                openShareDialog: true,
                forcedPopupIntentInsteadOfWebshareOn: false,
                forcedAutoPopupTarget: null,
            }
        }

        const serviceKey =
            autoPopupTarget === "taittsuu"
                ? "post.share.service.taittsuu"
                : autoPopupTarget === "mastodon"
                  ? "post.share.service.mastodon"
                  : "post.share.service.x"
        const opened = openIntentPopupFor(
            autoPopupTarget,
            buildTextFor(autoPopupTarget),
            {
                instanceDomain: mastodonDomain ?? undefined,
                preOpenedWindow: popupWindow,
            },
        )

        if (opened) {
            return {
                status: tr =>
                    tr.t("post.share.popupOpened", {
                        result: tr.t(resultKey),
                        service: tr.t(serviceKey),
                    }),
                statusColor: "green",
                openShareDialog: false,
                forcedPopupIntentInsteadOfWebshareOn: false,
                forcedAutoPopupTarget: null,
            }
        }

        return {
            status: tr =>
                tr.t("post.share.popupBlocked", {
                    result: tr.t(resultKey),
                    service: tr.t(serviceKey),
                }),
            statusColor: "green",
            // ポップアップがブロックされたため、ユーザー操作（ダイアログ内のクリック）で
            // 再試行できるよう投稿先選択ダイアログを開き、以後も同じ失敗を繰り返さないよう
            // 自動ポップアップ先を「投稿時に選択する」へ変更する。
            openShareDialog: true,
            forcedPopupIntentInsteadOfWebshareOn: false,
            forcedAutoPopupTarget: "ask",
        }
    }

    // ここに到達する時点でpopupWindowは未使用（このパスの対象はWebShareAPI、
    // 失敗時のフォールバックのみ改めてXポップアップを新規に開く）。呼び出し側が
    // 事前に開いていた場合に取り残さないよう閉じる。
    popupWindow?.close()

    const webShareData = buildWebShareData({
        text: webShareText,
        imageEntry,
        manualImageAttach,
    })

    let webShareUnavailableReason: "unsupported" | "failed" | null = null

    if (canShareWithWebApi(webShareData)) {
        const shareResult = await shareWithWebApi(webShareData)
        if (shareResult.ok) {
            return {
                status: tr =>
                    tr.t("post.share.webShareDone", {
                        result: tr.t(resultKey),
                    }),
                statusColor: "green",
                openShareDialog: false,
                forcedPopupIntentInsteadOfWebshareOn: false,
                forcedAutoPopupTarget: null,
            }
        }
        if (shareResult.reason === "aborted") {
            return {
                status: tr =>
                    tr.t("post.share.webShareCancelled", {
                        result: tr.t(resultKey),
                    }),
                statusColor: "green",
                openShareDialog: false,
                forcedPopupIntentInsteadOfWebshareOn: false,
                forcedAutoPopupTarget: null,
            }
        }
        webShareUnavailableReason = "failed"
    } else {
        webShareUnavailableReason = "unsupported"
    }

    // WebShareAPIが非対応、または対応環境で実際に試行したが失敗した場合の
    // Xポップアップ即時フォールバック。WebShareAPIが使えなかったこと自体が
    // 「うまくいかなかった」ケースのため、ポップアップの開閉の成否に関わらず以後は
    // WebShareAPIを試さずポップアップ経由にするよう PopupIntentInsteadOfWebshare を
    // ONへフォールバックする。
    const unavailableReasonKey =
        webShareUnavailableReason === "unsupported"
            ? "post.share.reason.unsupported"
            : "post.share.reason.failed"

    const opened = openIntentPopupFor("x", buildTextFor("x"))
    if (opened) {
        return {
            status: tr =>
                tr.t("post.share.fallbackOpened", {
                    result: tr.t(resultKey),
                    reason: tr.t(unavailableReasonKey),
                }),
            statusColor: "green",
            openShareDialog: false,
            forcedPopupIntentInsteadOfWebshareOn: true,
            forcedAutoPopupTarget: "x",
        }
    }

    return {
        status: tr =>
            tr.t("post.share.fallbackBlocked", { result: tr.t(resultKey) }),
        statusColor: "green",
        openShareDialog: true,
        forcedPopupIntentInsteadOfWebshareOn: true,
        forcedAutoPopupTarget: "ask",
    }
}
