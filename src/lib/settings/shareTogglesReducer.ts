/**
 * PostForm の共有系トグル（PopupIntentInsteadOfWebshare / CrosspostToTaittsuu /
 * CrosspostToMastodon / ShowXIntentButton / NoAutoPopupAfterPost）間の連動ルールを
 * 純粋関数として実装するモジュール。
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
    crosspostToMastodon: boolean
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
 * - `state`: 変更前の5トグルの状態
 * - `action.field`: 操作対象のトグル名
 * - `action.next`: 操作後にそのトグルへ設定したい値
 *
 * 処理の趣旨（spec.submitButton.md「複合した際の挙動」準拠）:
 * - popupIntentInsteadOfWebshare を OFF にすると、WebShareAPIより優先度の高い
 *   crosspostToTaittsuu/crosspostToMastodon/showXWhenCrosspost/noAutoPopupAfterPost は
 *   前提が崩れるためすべて強制OFFにする。
 * - crosspostToTaittsuu/crosspostToMastodon は「X.com以外の連携先SNSグループ」を構成する。
 *   一方をONにすると popupIntentInsteadOfWebshare を強制ONにし、もう一方が既にONなら
 *   （＝グループ内で2つ以上ONになったら）自動ポップアップ先が一意に定まらなくなるため
 *   noAutoPopupAfterPostも強制ONにする。OFFにした場合、グループのもう一方も
 *   showXWhenCrosspostもいずれもOFFなら（＝手動投稿手段が一つも残らないなら）
 *   noAutoPopupAfterPostを強制OFFにする。
 * - showXWhenCrosspost を ON にすると popupIntentInsteadOfWebshare と noAutoPopupAfterPost を
 *   無条件に強制ONにする（X.comはデフォルトの投稿先であり、その手動投稿ボタンを
 *   表示する時点で自動ポップアップは不要と判断するため。このルールはグループの
 *   ON数に関わらず単独で発動する）。OFFにした場合、crosspostToTaittsuu/crosspostToMastodon
 *   がいずれもOFFなら同様の理由でnoAutoPopupAfterPostを強制OFFにする。
 * - noAutoPopupAfterPost を ON にすると、crosspostToTaittsuu/crosspostToMastodon/
 *   showXWhenCrosspostがいずれもOFFの場合のみ、デフォルトのインテントである
 *   showXWhenCrosspost（とpopupIntentInsteadOfWebshare）を強制ONにする
 *   （手動投稿ボタンが一つも表示されず操作不能になることを避けるため）。
 *   OFFにした場合、showXWhenCrosspostは無条件で強制OFFにする。加えて、
 *   crosspostToTaittsuu/crosspostToMastodonが両方ONのままだと自動ポップアップ先が
 *   一意に定まらないため、最優先の投稿先であるX.comへ一本化する目的で両方とも
 *   強制OFFにする。どちらか一方のみONの場合は、ユーザがX.comより優先したい投稿先を
 *   選んでいると解釈し、そのトグルには一切手を触れない。
 *
 * Input:
 * - `state`: 変更前の状態
 * - `action`: 操作対象トグルと変更後の値
 *
 * Output:
 * - 連動ルール適用後の次の状態
 *
 * 例:
 * - 入力: `state = { crosspostToTaittsuu: false, crosspostToMastodon: false, popupIntentInsteadOfWebshare: false, showXWhenCrosspost: false, noAutoPopupAfterPost: false }`,
 *   `action = { field: "showXWhenCrosspost", next: true }`
 * - 出力: `{ crosspostToTaittsuu: false, crosspostToMastodon: false, popupIntentInsteadOfWebshare: true, showXWhenCrosspost: true, noAutoPopupAfterPost: true }`
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
                crosspostToMastodon: false,
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
                    noAutoPopupAfterPost: state.crosspostToMastodon
                        ? true
                        : state.noAutoPopupAfterPost,
                }
            }
            const anyButtonRemains =
                state.crosspostToMastodon || state.showXWhenCrosspost
            return {
                ...state,
                crosspostToTaittsuu: false,
                noAutoPopupAfterPost: anyButtonRemains
                    ? state.noAutoPopupAfterPost
                    : false,
            }
        }

        case "crosspostToMastodon": {
            if (action.next) {
                return {
                    ...state,
                    crosspostToMastodon: true,
                    popupIntentInsteadOfWebshare: true,
                    noAutoPopupAfterPost: state.crosspostToTaittsuu
                        ? true
                        : state.noAutoPopupAfterPost,
                }
            }
            const anyButtonRemains =
                state.crosspostToTaittsuu || state.showXWhenCrosspost
            return {
                ...state,
                crosspostToMastodon: false,
                noAutoPopupAfterPost: anyButtonRemains
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
            const anyButtonRemains =
                state.crosspostToTaittsuu || state.crosspostToMastodon
            return {
                ...state,
                showXWhenCrosspost: false,
                noAutoPopupAfterPost: anyButtonRemains
                    ? state.noAutoPopupAfterPost
                    : false,
            }
        }

        case "noAutoPopupAfterPost": {
            if (action.next) {
                const anyOn =
                    state.crosspostToTaittsuu ||
                    state.crosspostToMastodon ||
                    state.showXWhenCrosspost
                if (!anyOn) {
                    return {
                        ...state,
                        noAutoPopupAfterPost: true,
                        showXWhenCrosspost: true,
                        popupIntentInsteadOfWebshare: true,
                    }
                }
                return { ...state, noAutoPopupAfterPost: true }
            }

            const nonXGroupOnCount =
                (state.crosspostToTaittsuu ? 1 : 0) +
                (state.crosspostToMastodon ? 1 : 0)

            if (nonXGroupOnCount >= 2) {
                // 非X連携先が2つ以上ONだと自動ポップアップ先が一意に定まらないため、
                // 最優先のX.comへ一本化し、非X連携先トグルは両方ともOFFにする。
                return {
                    ...state,
                    noAutoPopupAfterPost: false,
                    showXWhenCrosspost: false,
                    crosspostToTaittsuu: false,
                    crosspostToMastodon: false,
                }
            }

            // 非X連携先が1つ以下なら、ユーザがX.comより優先したい投稿先を
            // 選んでいると解釈し、そのトグルには触れずshowXWhenCrosspostのみ
            // 強制OFFにする。
            return {
                ...state,
                noAutoPopupAfterPost: false,
                showXWhenCrosspost: false,
            }
        }
    }
}
