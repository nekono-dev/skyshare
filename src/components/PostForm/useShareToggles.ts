/**
 * PostForm の共有系トグル（PopupIntentInsteadOfWebshare / CrosspostToTaittsuu / ShowXIntentButton /
 * NoAutoPopupAfterPost / ManualImageAttach）の state・永続化を管理するフック。
 *
 * 責務と処理概要:
 * - 各トグルの初期値を localStorage から読み込み、変更のたびに書き込む。
 * - トグル間の連動ルール（あるトグルをONにすると別のトグルが強制的にON/OFFになる）
 *   自体は `shareTogglesReducer.ts` の純粋関数 `reconcileShareToggles` に委譲し、
 *   ここでは React state 化と永続化という副作用のみを担う
 *   （連動ルールをReact/localStorageから切り離すことで単体テストしやすくするため）。
 * - `index.tsx` 側の JSX ハンドラを単純な `checked`/`onCheckedChange` の受け渡しだけに保つ。
 */
import { useEffect, useReducer, useState } from "react"
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

export type UseShareTogglesResult = ShareTogglesState & {
    manualImageAttach: boolean
    onCrosspostToTaittsuuChange: (next: boolean) => void
    onPopupIntentInsteadOfWebshareChange: (next: boolean) => void
    onShowXWhenCrosspostChange: (next: boolean) => void
    onNoAutoPopupAfterPostChange: (next: boolean) => void
    onManualImageAttachChange: (next: boolean) => void
}

/**
 * 共有系トグル一式の state と変更ハンドラを提供する。
 *
 * Input:
 * - なし
 *
 * Output:
 * - 現在値と、連動ルール適用後の状態を反映する各トグルの変更ハンドラ
 */
export const useShareToggles = (): UseShareTogglesResult => {
    const [state, dispatch] = useReducer(
        reconcileShareToggles,
        undefined,
        () => ({
            crosspostToTaittsuu: readCrosspostToTaittsuuSetting(false),
            popupIntentInsteadOfWebshare:
                readPopupIntentInsteadOfWebshareSetting(false),
            showXWhenCrosspost: readShowCrosspostXButtonSetting(false),
            noAutoPopupAfterPost: readNoAutoPopupAfterPostSetting(false),
        }),
    )
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
        dispatch({ field: "crosspostToTaittsuu", next })
    }

    const onPopupIntentInsteadOfWebshareChange = (next: boolean) => {
        dispatch({ field: "popupIntentInsteadOfWebshare", next })
    }

    const onShowXWhenCrosspostChange = (next: boolean) => {
        dispatch({ field: "showXWhenCrosspost", next })
    }

    const onNoAutoPopupAfterPostChange = (next: boolean) => {
        dispatch({ field: "noAutoPopupAfterPost", next })
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

    return {
        ...state,
        manualImageAttach,
        onCrosspostToTaittsuuChange,
        onPopupIntentInsteadOfWebshareChange,
        onShowXWhenCrosspostChange,
        onNoAutoPopupAfterPostChange,
        onManualImageAttachChange,
    }
}
