/**
 * 外部SNSの投稿intentページをポップアップで開く共通処理。
 *
 * 責務と処理概要:
 * - 各SNS向けintent機構（`@/util/share/intent`）から共通で呼び出す、
 *   window.open実行と成功判定・opener切り離しのみを担う。
 * - intent URLの組み立て（テキスト整形・ドメイン検証など）は呼び出し側の責務とする。
 * - 投稿API呼び出しなど非同期処理を挟んでからintent URLが確定するケース向けに、
 *   ユーザー操作の直後（同期的なコールスタック内）で繋ぎページ（`/jump/`）の
 *   ポップアップを先に開いておき、URL確定後にそこへ遷移させる`preOpenPopupWindow`
 *   も提供する。
 */

/**
 * ユーザー操作に応じて、繋ぎページ（`/jump/`）を表示するポップアップウィンドウを
 * 同期的に開いておく。
 *
 * 処理の趣旨:
 * - iOS Safariは、`window.open`が「ユーザー操作と同期的なコールスタック内」で
 *   呼ばれたかどうかでユーザーアクティベーションの有効性を判定する。投稿API呼び出し等の
 *   awaitを挟んでから`window.open(url)`を呼ぶと、アクティベーションが失効気味の
 *   状態になり、実際にはポップアップが開いているにもかかわらず戻り値だけ`null`に
 *   なることがある（Safariの既知の不整合。この場合は成否をアプリ側から正しく
 *   検知できない）。
 * - そのため、URLが未確定でも構わないタイミング（ユーザー操作の直後、await前）で
 *   ポップアップを先に開いておき、URL確定後は`openIntentPopup`の第2引数に渡して
 *   そのウィンドウへ遷移させることで、`window.open`自体は常にユーザー操作と同期的な
 *   コールスタック内で呼ばれる状態を保つ。
 * - 空白（about:blank）のまま数秒待たせるとユーザーが不安になるため、遷移中である
 *   ことを示す簡易な待機画面（`src/pages/jump.astro`）を開く。
 *
 * Output:
 * - 開いたポップアップウィンドウ（ブロックされた場合は`null`）
 */
export const preOpenPopupWindow = (): Window | null => {
    if (typeof window === "undefined") {
        return null
    }

    try {
        return window.open("/jump/", "_blank")
    } catch (error) {
        return null
    }
}

/**
 * intent URLをポップアップで開く。
 *
 * 処理の趣旨:
 * - windowFeaturesで`noopener`を指定すると戻り値が常に`null`になり成功判定が
 *   できなくなるため、`noopener`は使わず、開いた後にopenerを手動で切り離す。
 * - ただし`window.open`が返した直後（またはpreOpenedWindowへの遷移直後）は、
 *   ポップアップ先（別オリジン）へのナビゲーションがブラウザ内部でキューイング
 *   されたばかりの状態であり、同じタスク内で同期的にopenerを書き換えると、
 *   そのナビゲーションがSafariで中断され、ポップアップ側に「ページを開けません。
 *   アドレスが無効です。」というエラーが表示されることがある（window.openの
 *   戻り値自体はnullにならないため、この失敗はアプリ側から検知できない）。
 *   ポップアップ先は別オリジンのため、遷移完了を`load`イベントで検知することは
 *   同一オリジンポリシー上できない。そのため、1マクロタスク遅延させることで
 *   ナビゲーションの開始処理を先に進めてからopenerを切り離す。
 *
 * Input:
 * - `url`: 開くintent URL（文字列化済み）
 * - `preOpenedWindow`: `preOpenPopupWindow`で事前に開いておいたウィンドウ。
 *   渡された場合はこのウィンドウへ`url`を遷移させる（新規に`window.open`しない）。
 *   投稿API呼び出し等のawaitを挟むフロー向けで、省略時は従来どおり新規に開く。
 *
 * Output:
 * - ウィンドウオープン（または遷移）に成功したら `true`
 *
 * 例:
 * - 入力: "https://x.com/intent/post?text=hello"
 * - 出力: `true`
 */
export const openIntentPopup = (
    url: string,
    preOpenedWindow?: Window | null,
): boolean => {
    if (typeof window === "undefined") {
        return false
    }

    try {
        if (preOpenedWindow) {
            if (preOpenedWindow.closed) {
                return false
            }
            preOpenedWindow.location.href = url

            setTimeout(() => {
                try {
                    preOpenedWindow.opener = null
                } catch (error) {
                    // 稀にタイミング次第でこの代入自体が失敗しても、
                    // opener解放は防御的な後処理のため実害はなく無視してよい。
                }
            }, 0)

            return true
        }

        const popupWindow = window.open(url, "_blank")
        if (popupWindow === null) {
            return false
        }

        setTimeout(() => {
            try {
                popupWindow.opener = null
            } catch (error) {
                // 稀にタイミング次第でこの代入自体が失敗しても、
                // opener解放は防御的な後処理のため実害はなく無視してよい。
            }
        }, 0)

        return true
    } catch (error) {
        return false
    }
}
