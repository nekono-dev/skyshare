/**
 * 共有系設定（PopupIntentInsteadOfWebshare / AutoPopupTarget / ManualImageAttach /
 * TruncateIntentText / Mastodonインスタンスドメイン）の state・永続化を管理するフック。
 *
 * 責務と処理概要:
 * - 各設定の初期値を localStorage から読み込み、変更のたびに書き込む。
 * - 設定間の連動は ManualImageAttach → TruncateIntentText のみ。ManualImageAttach が
 *   ONの間は TruncateIntentText を常にOFFとして扱い、UI表示と保存値を一致させる。
 * - `PostForm`（投稿フォーム内）と `Settings`（設定ページ）の双方から利用され、
 *   どちらの画面から変更しても同じ永続化が適用される。
 * - 初期値はSSRと同じ固定値とし、マウント後の `reload()` で実値を反映する
 *   （ハイドレーション不一致を避けるため）。
 */
import { useCallback, useEffect, useState } from "react"
import {
    DEFAULT_AUTO_POPUP_TARGET,
    readAutoPopupTargetSetting,
    readManualImageAttachSetting,
    readMastodonInstanceDomainSetting,
    readPopupIntentInsteadOfWebshareSetting,
    readTruncateIntentTextSetting,
    removeMastodonInstanceDomainSetting,
    writeAutoPopupTargetSetting,
    writeManualImageAttachSetting,
    writeMastodonInstanceDomainSetting,
    writePopupIntentInsteadOfWebshareSetting,
    writeTruncateIntentTextSetting,
    type AutoPopupTarget,
} from "@/lib/settings/shareSettings"
import { isValidMastodonInstanceDomain } from "@/util/share/intent"

export type UseShareTogglesResult = {
    popupIntentInsteadOfWebshare: boolean
    autoPopupTarget: AutoPopupTarget
    manualImageAttach: boolean
    /** X/タイッツー向け共有文の長文省略。manualImageAttachがtrueの間は常にfalse */
    truncateIntentText: boolean
    /** Mastodonインスタンスのドメイン（例: "mastodon.social"）。未設定は空文字 */
    mastodonInstanceDomain: string
    onPopupIntentInsteadOfWebshareChange: (next: boolean) => void
    onAutoPopupTargetChange: (next: AutoPopupTarget) => void
    onManualImageAttachChange: (next: boolean) => void
    onTruncateIntentTextChange: (next: boolean) => void
    onMastodonInstanceDomainChange: (next: string) => void
    /** localStorage上の最新値を読み直し、stateへ反映する（書き込みは行わない） */
    reload: () => void
}

/**
 * 共有系設定一式の state と変更ハンドラを提供する。
 *
 * Input:
 * - なし
 *
 * Output:
 * - 現在値、各設定の変更ハンドラ、および明示的な再読み込み用の `reload`
 */
export const useShareToggles = (): UseShareTogglesResult => {
    // 初期値は必ずSSR時と同じ固定値（localStorageを読まない）にする。
    // 実際の値は、マウント後の useEffect（reload）でのみ反映する。
    const [popupIntentInsteadOfWebshare, setPopupIntentInsteadOfWebshare] =
        useState(false)
    const [autoPopupTarget, setAutoPopupTarget] = useState<AutoPopupTarget>(
        DEFAULT_AUTO_POPUP_TARGET,
    )
    const [manualImageAttach, setManualImageAttach] = useState(false)
    const [truncateIntentText, setTruncateIntentText] = useState(false)
    const [mastodonInstanceDomain, setMastodonInstanceDomain] = useState("")

    const onPopupIntentInsteadOfWebshareChange = (next: boolean) => {
        setPopupIntentInsteadOfWebshare(next)
        writePopupIntentInsteadOfWebshareSetting(next)
    }

    const onAutoPopupTargetChange = (next: AutoPopupTarget) => {
        setAutoPopupTarget(next)
        writeAutoPopupTargetSetting(next)
    }

    /**
     * ManualImageAttach の変更を反映する。
     *
     * 処理の趣旨:
     * - ONにする場合のみ、skyshare URLを付けない設定と矛盾する TruncateIntentText を
     *   強制OFFにし、保存値もOFFへ更新する（UI表示と保存値の不整合を作らないため）。
     *   OFFへ戻しても TruncateIntentText は自動では復帰しない。
     *
     * Input:
     * - `next`: 変更後の値
     */
    const onManualImageAttachChange = (next: boolean) => {
        setManualImageAttach(next)
        writeManualImageAttachSetting(next)
        if (next) {
            setTruncateIntentText(false)
            writeTruncateIntentTextSetting(false)
        }
    }

    /**
     * TruncateIntentText の変更を反映する。
     *
     * 処理の趣旨:
     * - ManualImageAttach がONの間は操作を無視する（強制OFFを維持するため）。
     *
     * Input:
     * - `next`: 変更後の値
     */
    const onTruncateIntentTextChange = (next: boolean) => {
        if (manualImageAttach) {
            return
        }
        setTruncateIntentText(next)
        writeTruncateIntentTextSetting(next)
    }

    /**
     * Mastodonインスタンスのドメインの変更を反映する。
     *
     * 処理の趣旨:
     * - 入力中の表示（state）は常に更新するが、localStorageへの保存は妥当な形式の場合のみ行う。
     *   入力途中の不正な値を保存してしまわないようにするため。空文字が明示的に指定された
     *   場合は、保存済みの値そのものを削除する（空文字での上書きではなく明示的な削除）。
     *
     * Input:
     * - `next`: 変更後のドメイン文字列
     */
    const onMastodonInstanceDomainChange = (next: string) => {
        setMastodonInstanceDomain(next)

        if (isValidMastodonInstanceDomain(next)) {
            writeMastodonInstanceDomainSetting(next)
        } else if (next.trim() === "") {
            removeMastodonInstanceDomainSetting()
        }
    }

    /**
     * localStorage上の最新値を読み直し、stateへ反映する。
     *
     * 処理の趣旨:
     * - 他画面での変更や、Astroのクライアント側ページ遷移でこのフックのReactインスタンスが
     *   再マウントされずに再利用される場合に、呼び出し側から明示的に呼び出して最新状態へ
     *   同期するために提供する。
     * - ManualImageAttachがONで TruncateIntentText の保存値がtrueの場合は、保存値もOFFへ補正する。
     *
     * Output:
     * - なし（stateを最新のlocalStorage値へ置き換える）
     */
    const reload = useCallback(() => {
        setPopupIntentInsteadOfWebshare(
            readPopupIntentInsteadOfWebshareSetting(false),
        )
        setAutoPopupTarget(
            readAutoPopupTargetSetting(DEFAULT_AUTO_POPUP_TARGET),
        )
        const nextManualImageAttach = readManualImageAttachSetting(false)
        setManualImageAttach(nextManualImageAttach)
        const savedTruncate = readTruncateIntentTextSetting(false)
        if (nextManualImageAttach && savedTruncate) {
            writeTruncateIntentTextSetting(false)
        }
        setTruncateIntentText(nextManualImageAttach ? false : savedTruncate)
        setMastodonInstanceDomain(readMastodonInstanceDomainSetting(""))
    }, [])

    // マウント直後に一度だけ実行し、固定初期値から実際のlocalStorage値へ更新する。
    useEffect(() => {
        reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        popupIntentInsteadOfWebshare,
        autoPopupTarget,
        manualImageAttach,
        truncateIntentText,
        mastodonInstanceDomain,
        onPopupIntentInsteadOfWebshareChange,
        onAutoPopupTargetChange,
        onManualImageAttachChange,
        onTruncateIntentTextChange,
        onMastodonInstanceDomainChange,
        reload,
    }
}
