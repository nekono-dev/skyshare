/**
 * PostForm の共有系トグル（PopupIntentInsteadOfWebshare / CrosspostToTaittsuu / ShowXIntentButton /
 * NoAutoPopupAfterPost）間の連動ルールを純粋関数として実装するモジュール。
 *
 * 責務と処理概要:
 * - `spec.submitButton.md`「複合した際の挙動」に定義された、あるトグルの変更が
 *   他のトグルを強制的にON/OFFにするルールを `reconcileShareToggles` に集約する。
 * - React/localStorageに一切依存しない値変換のみを行うため、`useShareToggles`
 *   （Reactフック側）から分離してNode環境で単体テストできる。
 * - ManualImageAttach/PinnedFormDisabledは他トグルと連動しないため対象外。
 */

export type ShareTogglesState = {
    crosspostToTaittsuu: boolean
    popupIntentInsteadOfWebshare: boolean
    showXWhenCrosspost: boolean
    noAutoPopupAfterPost: boolean
}

export type ShareToggleField = keyof ShareTogglesState

export type ShareTogglesAction = {
    field: ShareToggleField
    next: boolean
}

/**
 * 共有系トグルの状態を、1つのトグル変更操作に基づいて次の状態へ変換する。
 *
 * 想定する入力形状:
 * - `state`: 変更前の4トグルの状態
 * - `action.field`: 操作対象のトグル名
 * - `action.next`: 操作後にそのトグルへ設定したい値
 *
 * 処理の趣旨（spec.submitButton.md「複合した際の挙動」準拠）:
 * - popupIntentInsteadOfWebshare を OFF にすると、WebShareAPIより優先度の高い
 *   crosspostToTaittsuu/showXWhenCrosspost/noAutoPopupAfterPost は前提が崩れるため
 *   すべて強制OFFにする。
 * - crosspostToTaittsuu を ON にすると popupIntentInsteadOfWebshare を強制ONにし、
 *   showXWhenCrosspost が既にONならnoAutoPopupAfterPostも強制ONにする
 *   （両サービスへ手動投稿する意図と解釈するため）。OFFにした場合、
 *   showXWhenCrosspostも既にOFFなら（＝両方OFFになったら）
 *   ボタン表示手段が失われるためnoAutoPopupAfterPostを強制OFFにする。
 * - showXWhenCrosspost を ON にすると popupIntentInsteadOfWebshare と noAutoPopupAfterPost を
 *   強制ONにする（Xの手動投稿ボタンを表示する時点で自動ポップアップは不要と
 *   判断するため）。OFFにした場合、crosspostToTaittsuuも既にOFFなら
 *   同様の理由でnoAutoPopupAfterPostを強制OFFにする。
 * - noAutoPopupAfterPost を ON にすると、crosspostToTaittsuu/showXWhenCrosspostが
 *   いずれもOFFの場合のみ、デフォルトのインテントであるshowXWhenCrosspost
 *   （とpopupIntentInsteadOfWebshare）を強制ONにする（手動投稿ボタンが一つも表示されず
 *   操作不能になることを避けるため）。OFFにした場合、showXWhenCrosspostが
 *   既にONだと自動ポップアップと手動ボタンが同時に存在する矛盾状態になるため
 *   強制OFFにする。
 *
 * Input:
 * - `state`: 変更前の状態
 * - `action`: 操作対象トグルと変更後の値
 *
 * Output:
 * - 連動ルール適用後の次の状態
 *
 * 例:
 * - 入力: `state = { crosspostToTaittsuu: false, popupIntentInsteadOfWebshare: false, showXWhenCrosspost: false, noAutoPopupAfterPost: false }`,
 *   `action = { field: "showXWhenCrosspost", next: true }`
 * - 出力: `{ crosspostToTaittsuu: false, popupIntentInsteadOfWebshare: true, showXWhenCrosspost: true, noAutoPopupAfterPost: true }`
 */
export const reconcileShareToggles = (
    state: ShareTogglesState,
    action: ShareTogglesAction,
): ShareTogglesState => {
    switch (action.field) {
        case "popupIntentInsteadOfWebshare": {
            if (action.next) {
                return { ...state, popupIntentInsteadOfWebshare: true }
            }
            return {
                ...state,
                popupIntentInsteadOfWebshare: false,
                crosspostToTaittsuu: false,
                showXWhenCrosspost: false,
                noAutoPopupAfterPost: false,
            }
        }

        case "crosspostToTaittsuu": {
            if (action.next) {
                return {
                    ...state,
                    crosspostToTaittsuu: true,
                    popupIntentInsteadOfWebshare: true,
                    noAutoPopupAfterPost: state.showXWhenCrosspost
                        ? true
                        : state.noAutoPopupAfterPost,
                }
            }
            return {
                ...state,
                crosspostToTaittsuu: false,
                noAutoPopupAfterPost: state.showXWhenCrosspost
                    ? state.noAutoPopupAfterPost
                    : false,
            }
        }

        case "showXWhenCrosspost": {
            if (action.next) {
                return {
                    ...state,
                    showXWhenCrosspost: true,
                    popupIntentInsteadOfWebshare: true,
                    noAutoPopupAfterPost: true,
                }
            }
            return {
                ...state,
                showXWhenCrosspost: false,
                noAutoPopupAfterPost: state.crosspostToTaittsuu
                    ? state.noAutoPopupAfterPost
                    : false,
            }
        }

        case "noAutoPopupAfterPost": {
            if (action.next) {
                if (!state.crosspostToTaittsuu && !state.showXWhenCrosspost) {
                    return {
                        ...state,
                        noAutoPopupAfterPost: true,
                        showXWhenCrosspost: true,
                        popupIntentInsteadOfWebshare: true,
                    }
                }
                return { ...state, noAutoPopupAfterPost: true }
            }
            return {
                ...state,
                noAutoPopupAfterPost: false,
                showXWhenCrosspost: false,
            }
        }
    }
}
