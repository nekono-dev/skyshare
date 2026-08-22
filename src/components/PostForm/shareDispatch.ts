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
import type { ImageEntry } from "@/components/ImagePicker"
import {
    buildTaittsuuIntentText,
    openTaittsuuIntentPopup,
} from "@/util/share/taittsuuIntent"
import { canShareWithWebApi, shareWithWebApi } from "@/util/share/webShare"
import { buildXIntentText, openXIntentPopup } from "@/util/share/xIntent"

export type ShareDispatchParams = {
    text: string
    skyshareUri: string
    imageEntry: ImageEntry | null
    manualImageAttach: boolean
    crosspostToTaittsuu: boolean
    popupIntentInsteadOfWebshare: boolean
    noAutoPopupAfterPost: boolean
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
}

/**
 * Blob を WebShareAPI が要求する File へ変換する。
 *
 * Input:
 * - `blob`: 画像 Blob
 * - `index`: ファイル名採番用のインデックス
 *
 * Output:
 * - MIME タイプから拡張子を推定した `File`
 *
 * 例:
 * - 入力: `image/png` の Blob, `0`
 * - 出力: ファイル名 `image-0.png` の `File`
 */
const toShareFile = (blob: Blob, index: number) => {
    const extension = blob.type.split("/")[1] ?? "png"
    return new File([blob], `image-${index}.${extension}`, {
        type: blob.type,
    })
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
 * - OFFの場合、CrosspostToTaittsuu ON なら Taittsu、そうでなくPopupIntentInsteadOfWebshare ON
 *   なら X をターゲットに自動ポップアップする。失敗時はその旨を伝えたうえで
 *   NoAutoPopupAfterPost をONへフォールバックし、テキストも保持する。
 * - どちらのポップアップ系トグルもOFFならWebShareAPIを試行し、非対応環境では
 *   Xポップアップにフォールバックする（このフォールバックの失敗時も同様に
 *   NoAutoPopupAfterPostをONへフォールバックする）。
 * - ボタン表示はNoAutoPopupAfterPostに連動するため、Xターゲットの自動ポップアップが
 *   失敗した場合はShowXIntentButtonも強制ONにし、再試行用ボタンを必ず提示する
 *   （Taittsuターゲットの場合はCrosspostToTaittsuuが既にONのため不要）。
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
        popupIntentInsteadOfWebshare,
        noAutoPopupAfterPost,
    } = params

    // 「画像を自分で添付する」有効時は skyshare エントリを作らないため、
    // ポップアップ/テキストボックス/WebShareAPI のいずれにも URL を含めない。
    const effectiveSkyshareUri = manualImageAttach ? "" : skyshareUri
    const shareText = buildXIntentText(text, effectiveSkyshareUri)
    const taittsuuIntentText = buildTaittsuuIntentText(
        text,
        effectiveSkyshareUri,
    )

    if (noAutoPopupAfterPost) {
        return {
            status: "投稿に成功しました。共有用のテキストを入力欄に保持しました。",
            statusColor: "green",
            textToKeep: shareText,
            forcedNoAutoPopupOn: false,
            forcedShowXIntentButtonOn: false,
        }
    }

    if (crosspostToTaittsuu || popupIntentInsteadOfWebshare) {
        const target = crosspostToTaittsuu ? "taittsuu" : "x"
        const opened =
            target === "taittsuu"
                ? openTaittsuuIntentPopup(taittsuuIntentText)
                : openXIntentPopup(shareText)

        if (opened) {
            return {
                status: "投稿に成功しました。",
                statusColor: "green",
                textToKeep: null,
                forcedNoAutoPopupOn: false,
                forcedShowXIntentButtonOn: false,
            }
        }

        const serviceLabel = target === "taittsuu" ? "タイッツー" : "x.com"
        return {
            status: `投稿に成功しました。${serviceLabel} 投稿画面を開けませんでした。ポップアップブロックを確認してください。以後は自動ポップアップをOFFにしました。`,
            statusColor: "green",
            textToKeep: shareText,
            forcedNoAutoPopupOn: true,
            // Taittsuターゲットの場合は CrosspostToTaittsuu が既にONのため、
            // NoAutoPopupAfterPost連動ルールでタイッツーボタンが自動的に表示される。
            // Xターゲットの場合のみ、再試行用のボタンを出すために明示的な強制が必要。
            forcedShowXIntentButtonOn: target === "x",
        }
    }

    const webShareData = buildWebShareData({
        text: shareText,
        imageEntry,
        manualImageAttach,
    })

    if (canShareWithWebApi(webShareData)) {
        const shareResult = await shareWithWebApi(webShareData)
        if (shareResult.ok) {
            return {
                status: "投稿に成功しました。",
                statusColor: "green",
                textToKeep: null,
                forcedNoAutoPopupOn: false,
                forcedShowXIntentButtonOn: false,
            }
        }
        if (shareResult.reason === "aborted") {
            return {
                status: "投稿に成功しました。共有はキャンセルされました。",
                statusColor: "green",
                textToKeep: null,
                forcedNoAutoPopupOn: false,
                forcedShowXIntentButtonOn: false,
            }
        }
        return {
            status: "投稿に成功しました。WebShareAPI での共有に失敗しました。",
            statusColor: "green",
            textToKeep: null,
            forcedNoAutoPopupOn: false,
            forcedShowXIntentButtonOn: false,
        }
    }

    // WebShareAPI非対応環境でのXポップアップフォールバック。ここもXターゲットの
    // 自動実行であるため、失敗時は上のX分岐と同様にShowXIntentButtonを強制ONにする。
    const opened = openXIntentPopup(shareText)
    if (opened) {
        return {
            status: "投稿に成功しました。WebShareAPI 非対応のため x.com 投稿画面を開きました。",
            statusColor: "green",
            textToKeep: null,
            forcedNoAutoPopupOn: false,
            forcedShowXIntentButtonOn: false,
        }
    }

    return {
        status: "投稿に成功しました。x.com 投稿画面を開けませんでした。ポップアップブロックを確認してください。以後は自動ポップアップをOFFにしました。",
        statusColor: "green",
        textToKeep: shareText,
        forcedNoAutoPopupOn: true,
        forcedShowXIntentButtonOn: true,
    }
}
