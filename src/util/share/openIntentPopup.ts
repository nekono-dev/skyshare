/**
 * 外部SNSの投稿intentページをポップアップで開く共通処理。
 *
 * 責務と処理概要:
 * - 各SNS向けintentユーティリティ（xIntent/taittsuuIntent/mastodonIntent）から
 *   共通で呼び出す、window.open実行と成功判定・opener切り離しのみを担う。
 * - intent URLの組み立て（テキスト整形・ドメイン検証など）は呼び出し側の責務とする。
 */

/**
 * intent URLをポップアップで開く。
 *
 * 処理の趣旨:
 * - windowFeaturesで`noopener`を指定すると戻り値が常に`null`になり成功判定が
 *   できなくなるため、`noopener`は使わず、開いた後にopenerを手動で切り離す。
 * - ただし`window.open`が返した直後は、ポップアップ先（別オリジン）への
 *   ナビゲーションがブラウザ内部でキューイングされたばかりの状態であり、
 *   同じタスク内で同期的にopenerを書き換えると、そのナビゲーションがSafariで
 *   中断され、ポップアップ側に「ページを開けません。アドレスが無効です。」という
 *   エラーが表示されることがある（window.openの戻り値自体はnullにならないため、
 *   この失敗はアプリ側から検知できない）。
 *   ポップアップ先は別オリジンのため、遷移完了を`load`イベントで検知することは
 *   同一オリジンポリシー上できない。そのため、1マクロタスク遅延させることで
 *   ナビゲーションの開始処理を先に進めてからopenerを切り離す。
 *
 * Input:
 * - `url`: 開くintent URL（文字列化済み）
 *
 * Output:
 * - ウィンドウオープンに成功したら `true`
 *
 * 例:
 * - 入力: "https://x.com/intent/post?text=hello"
 * - 出力: `true`
 */
export const openIntentPopup = (url: string): boolean => {
    if (typeof window === "undefined") {
        return false
    }

    try {
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
