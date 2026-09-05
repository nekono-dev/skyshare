/**
 * 共有系トグル（PopupIntentInsteadOfWebshare / CrosspostToTaittsuu / CrosspostToMastodon /
 * ShowXIntentButton / NoAutoPopupAfterPost / ManualImageAttach）の state・永続化を管理するフック。
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
 * - MastodonインスタンスのドメインはCrosspostToMastodonの連動ルールとは別に、
 *   常に編集可能な独立した文字列stateとして管理する（ドメインが無効な形式になった
 *   場合のみ、reconcileShareToggles経由でCrosspostToMastodonを強制OFFにする）。
 *   CrosspostToMastodonをONにする時点でドメインが未設定なら既定値
 *   `mastodon.social` を補うが、既にドメインが設定されている場合はトグルの
 *   ON/OFFで値を変更しない（ユーザの設定を尊重する）。
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
    readCrosspostToMastodonSetting,
    readCrosspostToTaittsuuSetting,
    readManualImageAttachSetting,
    readMastodonInstanceDomainSetting,
    readNoAutoPopupAfterPostSetting,
    readPopupIntentInsteadOfWebshareSetting,
    readShowCrosspostXButtonSetting,
    removeMastodonInstanceDomainSetting,
    writeCrosspostToMastodonSetting,
    writeCrosspostToTaittsuuSetting,
    writeManualImageAttachSetting,
    writeMastodonInstanceDomainSetting,
    writeNoAutoPopupAfterPostSetting,
    writePopupIntentInsteadOfWebshareSetting,
    writeShowCrosspostXButtonSetting,
} from "@/lib/settings/shareSettings"
import {
    reconcileShareToggles,
    type ShareTogglesState,
} from "./shareTogglesReducer"
import { isValidMastodonInstanceDomain } from "@/util/share/intent"

/**
 * 5トグルの現在値を localStorage から読み直す。
 *
 * Output:
 * - localStorage 上の最新値（未保存/失敗時は全て false）
 */
const readShareTogglesState = (): ShareTogglesState => ({
    crosspostToTaittsuu: readCrosspostToTaittsuuSetting(false),
    crosspostToMastodon: readCrosspostToMastodonSetting(false),
    popupIntentInsteadOfWebshare:
        readPopupIntentInsteadOfWebshareSetting(false),
    showXWhenCrosspost: readShowCrosspostXButtonSetting(false),
    noAutoPopupAfterPost: readNoAutoPopupAfterPostSetting(false),
})

/** CrosspostToMastodonをONにした時点でドメイン未設定の場合に補う既定のインスタンスドメイン。 */
const DEFAULT_MASTODON_INSTANCE_DOMAIN = "mastodon.social"

/**
 * SSR時（`window` 不在）とクライアント初回レンダーで必ず一致させるための固定初期値。
 * すべて false/空文字で、localStorage の内容には一切依存しない。
 */
const INITIAL_SHARE_TOGGLES_STATE: ShareTogglesState = {
    crosspostToTaittsuu: false,
    crosspostToMastodon: false,
    popupIntentInsteadOfWebshare: false,
    showXWhenCrosspost: false,
    noAutoPopupAfterPost: false,
}

export type UseShareTogglesResult = ShareTogglesState & {
    manualImageAttach: boolean
    /** Mastodonインスタンスのドメイン（例: "mastodon.social"）。CrosspostToMastodonのON/OFFに関係なく常に編集可能 */
    mastodonInstanceDomain: string
    onCrosspostToTaittsuuChange: (next: boolean) => void
    onCrosspostToMastodonChange: (next: boolean) => void
    onPopupIntentInsteadOfWebshareChange: (next: boolean) => void
    onShowXWhenCrosspostChange: (next: boolean) => void
    onNoAutoPopupAfterPostChange: (next: boolean) => void
    onManualImageAttachChange: (next: boolean) => void
    onMastodonInstanceDomainChange: (next: string) => void
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
    // 初期値は必ずSSR時と同じ固定値（localStorageを読まない）にする。
    // ここでlocalStorageを読んでしまうと、SSR結果（window不在のため常にfalse/空文字）と
    // クライアント初回レンダーの値が一致せず、ハイドレーション時に disabled 等の属性が
    // 「SSR側の値のまま二度と補正されない」問題が起きる
    // （React は checked/value 等ごく一部を除き、ハイドレーション不一致を自動修正しない。
    //   加えて、初期値の時点で既に実際の値が入っていると、後述の reload() での setState が
    //   同じ値への更新としてバイルアウトされ、再描画自体が起きず永久に直らない）。
    // 実際の値は、マウント後の useEffect（reload）でのみ反映する。
    const [state, setState] = useState<ShareTogglesState>(
        INITIAL_SHARE_TOGGLES_STATE,
    )
    const [manualImageAttach, setManualImageAttach] = useState(false)
    const [mastodonInstanceDomain, setMastodonInstanceDomain] = useState("")

    // reconcileShareToggles が連動ルールで書き換えた分も含め、5トグルの現在値を
    // まとめて永続化する。個々のハンドラごとに書き込み対象を出し分けるより、
    // 変更のたびに全件書き込む方が連動ルールとの対応漏れが起きにくい。
    // 初回マウント時（state がまだ上記の固定初期値のまま）は書き込みをスキップする。
    // スキップしないと、mount後のreload()が実際の値をセットするより前にこの固定初期値
    // （全false）がlocalStorageへ書き込まれ、保存済みの値を消してしまう可能性がある。
    const isFirstWriteRef = useRef(true)
    useEffect(() => {
        if (isFirstWriteRef.current) {
            isFirstWriteRef.current = false
            return
        }
        writeCrosspostToTaittsuuSetting(state.crosspostToTaittsuu)
        writeCrosspostToMastodonSetting(state.crosspostToMastodon)
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

    /**
     * 「Mastodonにクロスポスト」トグルの変更を反映する。
     *
     * 処理の趣旨:
     * - ONにする時点でMastodonインスタンスのドメインが未設定（空文字）の場合のみ、
     *   既定値 `mastodon.social` を補って保存する。ドメインが既に設定されている
     *   場合は、トグルのON/OFFに関わらず値を一切変更しない（ユーザの設定を尊重する）。
     *
     * Input:
     * - `next`: 変更後の値
     */
    const onCrosspostToMastodonChange = (next: boolean) => {
        if (next && mastodonInstanceDomain.trim() === "") {
            setMastodonInstanceDomain(DEFAULT_MASTODON_INSTANCE_DOMAIN)
            writeMastodonInstanceDomainSetting(DEFAULT_MASTODON_INSTANCE_DOMAIN)
        }
        setState(prev =>
            reconcileShareToggles(prev, { field: "crosspostToMastodon", next }),
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
     * Mastodonインスタンスのドメインの変更を反映する。
     *
     * 処理の趣旨:
     * - 入力中の表示（state）は常に更新するが、localStorageへの保存は妥当な形式
     *   （空文字・サブパス・スキーム付き等でない）の場合のみ行う。入力途中の不正な値を
     *   保存してしまわないようにするため。空文字が明示的に指定された場合は、
     *   保存済みの値そのものを削除する（空文字での上書きではなく明示的な削除）。
     * - ドメインが妥当な形式でなくなった場合、CrosspostToMastodonトグルの前提が
     *   崩れるため、他の経路と同じOFF連動ルール（reconcileShareToggles）を通して
     *   強制OFFにする。
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

        if (!isValidMastodonInstanceDomain(next)) {
            setState(prev =>
                prev.crosspostToMastodon
                    ? reconcileShareToggles(prev, {
                          field: "crosspostToMastodon",
                          next: false,
                      })
                    : prev,
            )
        }
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
        setMastodonInstanceDomain(readMastodonInstanceDomainSetting(""))
    }, [])

    // マウント直後に一度だけ実行し、固定初期値から実際のlocalStorage値へ更新する。
    // Settings側の astro:page-load 用 reload 呼び出しとは別に、ここでフック自身が
    // 呼び出すことで、reload()を明示的に呼んでいないPostForm側でも同じ修正が効く。
    useEffect(() => {
        reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        ...state,
        manualImageAttach,
        mastodonInstanceDomain,
        onCrosspostToTaittsuuChange,
        onCrosspostToMastodonChange,
        onPopupIntentInsteadOfWebshareChange,
        onShowXWhenCrosspostChange,
        onNoAutoPopupAfterPostChange,
        onManualImageAttachChange,
        onMastodonInstanceDomainChange,
        reload,
    }
}
