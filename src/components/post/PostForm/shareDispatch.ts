/**
 * PostForm の投稿成功後の共有ディスパッチ（ポップアップ/WebShareAPIの実行判断と
 * 実行、テキストボックス保持内容・ステータスメッセージの決定）を担うモジュール。
 *
 * 責務と処理概要:
 * - `spec.submitButton.md` に定義された、共有系トグルの組み合わせに応じた
 *   自動ポップアップ/WebShareAPIの分岐ロジックを集約する。
 * - Reactのstateには一切触れず、実行結果を `ShareDispatchResult` として返すのみ。
 *   呼び出し側（`index.tsx`）がその内容に応じて state を更新する。
 */
import type { ImageEntry } from "@/components/image/ImagePicker"
import {
    buildMastodonIntentText,
    openMastodonIntentPopup,
} from "@/util/share/mastodonIntent"
import {
    buildTaittsuuIntentText,
    openTaittsuuIntentPopup,
} from "@/util/share/taittsuuIntent"
import {
    canShareWithWebApi,
    shareWithWebApi,
    toShareFile,
} from "@/util/share/webShare"
import { buildXIntentText, openXIntentPopup } from "@/util/share/xIntent"

export type ShareDispatchParams = {
    text: string
    skyshareUri: string
    imageEntry: ImageEntry | null
    manualImageAttach: boolean
    crosspostToTaittsuu: boolean
    crosspostToMastodon: boolean
    mastodonInstanceDomain: string
    popupIntentInsteadOfWebshare: boolean
    noAutoPopupAfterPost: boolean
    /**
     * 呼び出し側が投稿API呼び出し（await）より前に`preOpenPopupWindow`で
     * 事前に開いておいたポップアップウィンドウ。自動ポップアップ対象になった
     * targetの遷移先として使う（詳細は`openIntentPopup`を参照）。未使用に
     * 終わった場合はこの関数側で閉じる。
     */
    popupWindow: Window | null
}

export type ShareDispatchResult = {
    status: string
    statusColor: string
    /** null なら呼び出し側で resetInputFields() する合図。非nullならこのテキストを textbox に保持する。 */
    textToKeep: string | null
    /** true なら呼び出し側で forceNoAutoPopupAfterPostOn() を呼ぶ必要がある。 */
    forcedNoAutoPopupOn: boolean
    /**
     * true なら呼び出し側で ShowXIntentButton を強制ONにする必要がある
     * （Xターゲットの自動ポップアップ失敗時のみ。ボタン表示がNoAutoPopupAfterPostに
     * 連動するため、これをしないと再試行手段が無くなる）。
     */
    forcedShowXIntentButtonOn: boolean
    /**
     * true なら呼び出し側で onPopupIntentInsteadOfWebshareChange(true) を呼ぶ必要がある
     * （WebShareAPIが非対応、または実際に試行して失敗した場合。以後はWebShareAPIを
     * 試さずポップアップ経由の共有に切り替えるフォールバック）。
     */
    forcedPopupIntentInsteadOfWebshareOn: boolean
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
 * 処理の趣旨（spec.submitButton.md準拠）:
 * - NoAutoPopupAfterPost がONの場合、自動ポップアップ・WebShareAPIともに行わず、
 *   共有用テキスト（skyshare entry作成時はURL付き）をtextboxに保持する。
 * - OFFの場合、CrosspostToTaittsuu ON なら Taittsu、そうでなくCrosspostToMastodon ON なら
 *   Mastodon、そうでなくPopupIntentInsteadOfWebshare ON なら X をターゲットに自動ポップアップ
 *   する（優先順位: タイッツー > Mastodon > X）。失敗時はその旨を伝えたうえで
 *   NoAutoPopupAfterPost をONへフォールバックし、テキストも保持する。
 * - どちらのポップアップ系トグルもOFFならWebShareAPIを試行する。非対応環境、または
 *   対応環境で実際に試行したが失敗した場合（ユーザーによる共有シートのキャンセルを
 *   除く）は、いずれもPopupIntentInsteadOfWebshareをONへフォールバックし、以後は
 *   WebShareAPIを試さずポップアップ経由の共有に切り替える。あわせてその場でXポップアップ
 *   も即時に試行し、それも失敗した場合は同様にNoAutoPopupAfterPostをONへフォールバック
 *   する。
 * - ボタン表示はNoAutoPopupAfterPostに連動するため、Xターゲットの自動ポップアップが
 *   失敗した場合はShowXIntentButtonも強制ONにし、再試行用ボタンを必ず提示する
 *   （Taittsu/Mastodonターゲットの場合はCrosspostToTaittsuu/CrosspostToMastodonが
 *   既にONのため不要）。
 *
 * Input:
 * - `params`: 投稿本文・skyshare URI・共有系トグルの現在値
 *
 * Output:
 * - 表示すべきステータス・textboxに保持すべきテキスト・トグル強制変更の要否
 *
 * 例:
 * - 入力: `{ noAutoPopupAfterPost: true, ... }`
 * - 出力: `{ textToKeep: "本文\nURL", forcedNoAutoPopupOn: false, ... }`
 */
export const runShareDispatch = async (
    params: ShareDispatchParams,
): Promise<ShareDispatchResult> => {
    const {
        text,
        skyshareUri,
        imageEntry,
        manualImageAttach,
        crosspostToTaittsuu,
        crosspostToMastodon,
        mastodonInstanceDomain,
        popupIntentInsteadOfWebshare,
        noAutoPopupAfterPost,
        popupWindow,
    } = params

    // 「画像を自分で添付する」有効時は skyshare エントリを作らないため、
    // ポップアップ/テキストボックス/WebShareAPI のいずれにも URL を含めない。
    const effectiveSkyshareUri = manualImageAttach ? "" : skyshareUri
    const shareText = buildXIntentText(text, effectiveSkyshareUri)
    const taittsuuIntentText = buildTaittsuuIntentText(
        text,
        effectiveSkyshareUri,
    )
    const mastodonIntentText = buildMastodonIntentText(
        text,
        effectiveSkyshareUri,
    )

    if (noAutoPopupAfterPost) {
        popupWindow?.close()
        return {
            status: "Blueskyへの投稿に成功しました。クロスポストを行うには他SNS向け投稿ボタンを押してください。",
            statusColor: "green",
            textToKeep: shareText,
            forcedNoAutoPopupOn: false,
            forcedShowXIntentButtonOn: false,
            forcedPopupIntentInsteadOfWebshareOn: false,
        }
    }
    // 不変条件: NoAutoPopupAfterPostがOFFの間、crosspostToTaittsuu/crosspostToMastodonが
    // 同時にONになることはない（reconcileShareTogglesが両方ONにする際に必ず
    // noAutoPopupAfterPostも強制ONにするため）。ただし将来の変更で不変条件が崩れた場合に
    // 備え、優先順位を明示的に定義しておく: タイッツー > Mastodon > X。
    const target: "taittsuu" | "mastodon" | "x" = crosspostToTaittsuu
        ? "taittsuu"
        : crosspostToMastodon
          ? "mastodon"
          : "x"
    const serviceLabel =
        target === "taittsuu"
            ? "タイッツー"
            : target === "mastodon"
              ? "Mastodon"
              : "x.com"

    if (
        crosspostToTaittsuu ||
        crosspostToMastodon ||
        popupIntentInsteadOfWebshare
    ) {
        const opened =
            target === "taittsuu"
                ? openTaittsuuIntentPopup(taittsuuIntentText, popupWindow)
                : target === "mastodon"
                  ? openMastodonIntentPopup(
                        mastodonInstanceDomain,
                        mastodonIntentText,
                        popupWindow,
                    )
                  : openXIntentPopup(shareText, popupWindow)

        if (opened) {
            return {
                status: `Blueskyへの投稿に成功しました。${serviceLabel} 投稿画面を開きました。`,
                statusColor: "green",
                textToKeep: null,
                forcedNoAutoPopupOn: false,
                forcedShowXIntentButtonOn: false,
                forcedPopupIntentInsteadOfWebshareOn: false,
            }
        }

        return {
            status: `Blueskyへの投稿に成功しました。${serviceLabel} 投稿画面を開けませんでした。ポップアップブロックを確認してください。自動ポップアップオプションをOFFにしました。`,
            statusColor: "green",
            textToKeep: shareText,
            forcedNoAutoPopupOn: true,
            // Taittsu/Mastodonターゲットの場合は CrosspostToTaittsuu/CrosspostToMastodon が
            // 既にONのため、NoAutoPopupAfterPost連動ルールで対応するボタンが自動的に表示される。
            // Xターゲットの場合のみ、再試行用のボタンを出すために明示的な強制が必要。
            forcedShowXIntentButtonOn: target === "x",
            forcedPopupIntentInsteadOfWebshareOn: false,
        }
    }

    // ここに到達する時点でpopupWindowは未使用（このパスの対象はWebShareAPI、
    // 失敗時のフォールバックのみ改めてXポップアップを新規に開く）。呼び出し側が
    // 事前に開いていた場合に取り残さないよう閉じる。
    popupWindow?.close()

    const webShareData = buildWebShareData({
        text: shareText,
        imageEntry,
        manualImageAttach,
    })

    let webShareUnavailableReason: "unsupported" | "failed" | null = null

    if (canShareWithWebApi(webShareData)) {
        const shareResult = await shareWithWebApi(webShareData)
        if (shareResult.ok) {
            return {
                status: "Blueskyへの投稿に成功しました。WebShareAPIに投稿内容を転送しました。",
                statusColor: "green",
                textToKeep: null,
                forcedNoAutoPopupOn: false,
                forcedShowXIntentButtonOn: false,
                forcedPopupIntentInsteadOfWebshareOn: false,
            }
        }
        if (shareResult.reason === "aborted") {
            return {
                status: "Blueskyへの投稿に成功しました。WebShareAPIでの共有操作はキャンセルされました。",
                statusColor: "green",
                textToKeep: null,
                forcedNoAutoPopupOn: false,
                forcedShowXIntentButtonOn: false,
                forcedPopupIntentInsteadOfWebshareOn: false,
            }
        }
        webShareUnavailableReason = "failed"
    } else {
        webShareUnavailableReason = "unsupported"
    }

    // WebShareAPIが非対応、または対応環境で実際に試行したが失敗した場合の
    // Xポップアップ即時フォールバック。ここもXターゲットの自動実行であるため、
    // 失敗時は上のX分岐と同様にShowXIntentButtonを強制ONにする。WebShareAPIが
    // 使えなかったこと自体が「うまくいかなかった」ケースのため、ポップアップの
    // 開閉の成否に関わらず以後はWebShareAPIを試さずポップアップ経由にするよう
    // PopupIntentInsteadOfWebshareをONへフォールバックする。
    const unavailableLabel =
        webShareUnavailableReason === "unsupported"
            ? "ブラウザがWebShareAPI非対応のため"
            : "WebShareAPI での共有に失敗したため"

    const opened = openXIntentPopup(shareText)
    if (opened) {
        return {
            status: `Blueskyへの投稿に成功し、投稿画面を開きました。${unavailableLabel}、ポップアップを開くオプションをONにしました。`,
            statusColor: "green",
            textToKeep: null,
            forcedNoAutoPopupOn: false,
            forcedShowXIntentButtonOn: false,
            forcedPopupIntentInsteadOfWebshareOn: true,
        }
    }

    return {
        status: "Blueskyへの投稿に成功しましたが、投稿画面を開けませんでした。ポップアップブロックを確認してください。自動ポップアップオプションをOFFにしました。",
        statusColor: "green",
        textToKeep: shareText,
        forcedNoAutoPopupOn: true,
        forcedShowXIntentButtonOn: true,
        forcedPopupIntentInsteadOfWebshareOn: true,
    }
}
