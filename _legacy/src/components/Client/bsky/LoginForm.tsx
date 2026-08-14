import {
    useState,
    useEffect,
    useContext,
    Dispatch,
    SetStateAction,
} from "react"
import { inputtext_base, link } from "../common/tailwindVariants"
import { Session_context, Profile_context } from "../common/contexts"
import { type msgInfo } from "../common/types"
import createSession from "@/utils/atproto_api/createSession"
import loadProfile from "./lib/loadProfile"

import ProcButton from "../common/ProcButton"
import Tooltip from "../common/Tooltip"
import SavePasswordToggle from "./optionToggles/SavePasswordToggle"
import { writeJwt, readLogininfo, setLogininfo } from "@/utils/useLocalStorage"
import { servicename } from "@/env/vars"

export const Component = ({
    setMsgInfo,
}: {
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
}) => {
    const [loading, setLoad] = useState<boolean>(false)
    const [savePassword, setSavePassword] = useState<boolean>(false)
    const [identifier, setIdentifier] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const { setSession } = useContext(Session_context)
    const { setProfile } = useContext(Profile_context)

    const handleLogin = async (id?: string, pw?: string) => {
        setLoad(true)
        try {
            if (typeof id === "undefined" || typeof pw === "undefined") {
                id = identifier
                pw = password
            }
            const res = await createSession({
                identifier: id,
                password: pw,
            })
            if ("error" in res) {
                const e: Error = new Error(res.message)
                e.name = res.error
                throw e
            } else {
                setSession(res)
                // セッションをlocalstorageへ保存
                writeJwt(res.refreshJwt)
                setMsgInfo({
                    msg: "セッションを開始しました!",
                    isError: false,
                })
                // savePasswordフラグにより、ブラウザへID/PWを保存
                if (savePassword === true) {
                    setLogininfo({
                        id: identifier,
                        pw: password,
                    })
                }
                // プロフィールを読み込み
                await loadProfile({
                    session: res,
                    setProfile: setProfile,
                })
            }
        } catch (error: unknown) {
            let msg: string = "Unexpected Unknown Error"
            if (error instanceof Error) {
                msg = error.name + ": " + error.message
            }
            setMsgInfo({
                msg: msg,
                isError: true,
            })
        }
        setLoad(false)
    }
    const handleOnLoad = async () => {
        const loginInfo = readLogininfo()
        if (loginInfo !== null) {
            setMsgInfo({
                msg: "ブラウザに保存されたID/APWでログイン中...",
                isError: false,
            })
            await handleLogin(loginInfo.id, loginInfo.pw)
        }
    }
    useEffect(() => {
        void handleOnLoad()
    }, [])

    return (
        <div>
            <div className="mt-16">
                <div className="align-middle mb-0">
                    <label className="w-32 inline-block my-auto">
                        Email or ID:
                    </label>
                    <input
                        onChange={event => setIdentifier(event.target.value)}
                        placeholder="example.bsky.social"
                        disabled={loading}
                        className={inputtext_base({
                            class: "max-w-52 w-full px-2",
                            kind: "outbound",
                            disabled: loading,
                        })}
                        type="text"
                    />
                </div>
                <div className="align-middle">
                    <label className="w-32 inline-block my-auto">
                        AppPassword※:
                    </label>
                    <input
                        onChange={event => setPassword(event.target.value)}
                        placeholder="this-isex-ampl-epwd"
                        disabled={loading}
                        className={inputtext_base({
                            class: "max-w-52 w-full px-2",
                            kind: "outbound",
                            disabled: loading,
                        })}
                        type="password"
                    />
                </div>
                <div className="my-2">
                    <ProcButton
                        handler={handleLogin}
                        isProcessing={loading}
                        context="Blueskyアカウントへログイン"
                        disabled={
                            !(identifier.length > 0 && password.length > 0)
                        }
                        showAnimation={true}
                    />
                </div>
                <div className="mx-auto w-fit">
                    <SavePasswordToggle
                        labeltext={"ID/AppPasswordをブラウザへ保存する"}
                        prop={savePassword}
                        setProp={setSavePassword}
                    />
                </div>
                <Tooltip
                    tooltip={
                        <div className="flex flex-col sm:flex-row">
                            <div className="inline-block px-4 py-2 text-left">
                                {`（${servicename}に限らず）非公式のアプリを使う際はAppPasswordの利用が推奨されています。`}
                                <a
                                    className={link()}
                                    target="_blank"
                                    href="https://bsky.app/settings/app-passwords"
                                    rel="noopener noreferrer"
                                >
                                    <b>bsky.appの⚙設定</b>→
                                    <b>🔒高度な設定(新規タブが開きます)</b>
                                </a>
                                から生成してください。
                            </div>
                        </div>
                    }
                >
                    <span className="text-sky-400">
                        ※AppPasswordとは？(タップで説明を表示)
                    </span>
                </Tooltip>
            </div>
        </div>
    )
}

export default Component
