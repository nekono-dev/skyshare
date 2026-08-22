/**
 * 共有系トグル（PopupIntentInsteadOfWebshare / CrosspostToTaittsuu / ShowXIntentButton /
 * NoAutoPopupAfterPost / ManualImageAttach）の state・永続化を管理するフック。
 *
 * 責務と処理概要:
 * - 各トグルの初期値を localStorage から読み込み、変更のたびに書き込む。
 * - トグル間の連動ルール（あるトグルをONにすると別のトグルが強制的にON/OFFになる）
 *   自体は `shareTogglesReducer.ts` の純粋関数 `reconcileShareToggles` に委譲し、
 *   ここでは React state 化と永続化という副作用のみを担う
 *   （連動ルールをReact/localStorageから切り離すことで単体テストしやすくするため）。
 * - `PostForm`（投稿フォーム内のトグル）と `Settings`（設定ページ）の双方から利用され、
 *   どちらの画面から変更しても同じ連動ルール・永続化が適用される。
 * - 呼び出し側の JSX ハンドラを単純な `checked`/`onCheckedChange` の受け渡しだけに保つ。
 */
import { useCallback, useEffect, useState } from "react"
import {
    readCrosspostToTaittsuuSetting,
    readManualImageAttachSetting,
    readNoAutoPopupAfterPostSetting,
    readPopupIntentInsteadOfWebshareSetting,
    readShowCrosspostXButtonSetting,
    writeCrosspostToTaittsuuSetting,
    writeManualImageAttachSetting,
    writeNoAutoPopupAfterPostSetting,
    writePopupIntentInsteadOfWebshareSetting,
    writeShowCrosspostXButtonSetting,
} from "@/lib/settings/shareSettings"
import {
    reconcileShareToggles,
    type ShareTogglesState,
} from "./shareTogglesReducer"

/**
 * 4トグルの現在値を localStorage から読み直す。
 *
 * Output:
 * - localStorage 上の最新値（未保存/失敗時は全て false）
 */
const readShareTogglesState = (): ShareTogglesState => ({
    crosspostToTaittsuu: readCrosspostToTaittsuuSetting(false),
    popupIntentInsteadOfWebshare:
        readPopupIntentInsteadOfWebshareSetting(false),
    showXWhenCrosspost: readShowCrosspostXButtonSetting(false),
    noAutoPopupAfterPost: readNoAutoPopupAfterPostSetting(false),
})

export type UseShareTogglesResult = ShareTogglesState & {
    manualImageAttach: boolean
    onCrosspostToTaittsuuChange: (next: boolean) => void
    onPopupIntentInsteadOfWebshareChange: (next: boolean) => void
    onShowXWhenCrosspostChange: (next: boolean) => void
    onNoAutoPopupAfterPostChange: (next: boolean) => void
    onManualImageAttachChange: (next: boolean) => void
    /** localStorage上の最新値を読み直し、stateへ反映する（書き込みは行わない） */
    reload: () => void
}

/**
 * 共有系トグル一式の state と変更ハンドラを提供する。
 *
 * Input:
 * - なし
 *
 * Output:
 * - 現在値と、連動ルール適用後の状態を反映する各トグルの変更ハンドラ、
 *   および明示的な再読み込み用の `reload`
 */
export const useShareToggles = (): UseShareTogglesResult => {
    const [state, setState] = useState<ShareTogglesState>(readShareTogglesState)
    const [manualImageAttach, setManualImageAttach] = useState(() =>
        readManualImageAttachSetting(false),
    )

    // reconcileShareToggles が連動ルールで書き換えた分も含め、4トグルの現在値を
    // まとめて永続化する。個々のハンドラごとに書き込み対象を出し分けるより、
    // 変更のたびに全件書き込む方が連動ルールとの対応漏れが起きにくい。
    useEffect(() => {
        writeCrosspostToTaittsuuSetting(state.crosspostToTaittsuu)
        writePopupIntentInsteadOfWebshareSetting(
            state.popupIntentInsteadOfWebshare,
        )
        writeShowCrosspostXButtonSetting(state.showXWhenCrosspost)
        writeNoAutoPopupAfterPostSetting(state.noAutoPopupAfterPost)
    }, [state])

    const onCrosspostToTaittsuuChange = (next: boolean) => {
        setState(prev =>
            reconcileShareToggles(prev, { field: "crosspostToTaittsuu", next }),
        )
    }

    const onPopupIntentInsteadOfWebshareChange = (next: boolean) => {
        setState(prev =>
            reconcileShareToggles(prev, {
                field: "popupIntentInsteadOfWebshare",
                next,
            }),
        )
    }

    const onShowXWhenCrosspostChange = (next: boolean) => {
        setState(prev =>
            reconcileShareToggles(prev, { field: "showXWhenCrosspost", next }),
        )
    }

    const onNoAutoPopupAfterPostChange = (next: boolean) => {
        setState(prev =>
            reconcileShareToggles(prev, {
                field: "noAutoPopupAfterPost",
                next,
            }),
        )
    }

    /**
     * ManualImageAttach の変更を反映する。他トグルへの連動はない。
     *
     * Input:
     * - `next`: 変更後の値
     */
    const onManualImageAttachChange = (next: boolean) => {
        setManualImageAttach(next)
        writeManualImageAttachSetting(next)
    }

    /**
     * localStorage上の最新値を読み直し、stateへ反映する。
     *
     * 処理の趣旨:
     * - 他画面（PostForm/Settingsのどちらか一方）での変更や、Astroのクライアント側
     *   ページ遷移でこのフックのReactインスタンスが再マウントされずに再利用される
     *   場合に、呼び出し側（`Settings` の astro:page-load ハンドラ等）から明示的に
     *   呼び出して最新状態へ同期するために提供する。
     *
     * Output:
     * - なし（stateを最新のlocalStorage値へ置き換える）
     */
    const reload = useCallback(() => {
        setState(readShareTogglesState())
        setManualImageAttach(readManualImageAttachSetting(false))
    }, [])

    return {
        ...state,
        manualImageAttach,
        onCrosspostToTaittsuuChange,
        onPopupIntentInsteadOfWebshareChange,
        onShowXWhenCrosspostChange,
        onNoAutoPopupAfterPostChange,
        onManualImageAttachChange,
        reload,
    }
}
