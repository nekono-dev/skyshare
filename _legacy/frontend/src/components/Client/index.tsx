import { useState, useEffect } from "react"
import ReactDOM from "react-dom"
import { posturl } from "@/env/envs"

import {
    Session_context,
    type Session_info,
    Profile_context,
    clickedButtonContext,
} from "./common/contexts"
import { type msgInfo } from "./common/types"
import AppForm from "./AppForm"
import InfoLabel from "./common/InfoLabel"
import ProcButton from "./common/ProcButton"

import LogoutButton from "./bsky/buttons/LogoutButton"
import LoadSession from "./bsky/unique/LoadSession"
import PageControllerForm from "./pagedb/PageControllerForm"
import type model_getProfile from "@/utils/atproto_api/models/getProfile.json"
import { link } from "./common/tailwindVariants"
import { buttonID } from "./bsky/types"
import InfoOverlay from "./bsky/unique/InfoOverlay"

const Component = ({ portalonly = false }: { portalonly?: boolean }) => {
    const [isLoaded, setIsLoad] = useState<boolean>(false)
    const [isProcessing, setProcessing] = useState<boolean>(false)
    const [session, setSession] = useState<Session_info>({
        did: "",
        accessJwt: "",
        refreshJwt: null,
        handle: null,
    })
    const [profile, setProfile] = useState<typeof model_getProfile | null>(null)
    const buttonstyle = ["font-medium", "rounded-full", "focus:outline-none"]
    const [msgInfo, setMsgInfo] = useState<msgInfo>({ msg: "", isError: false })
    const [clickedButtonID, setClickedButtonID] = useState<buttonID>("")

    const handleClick = () => {
        location.href = posturl
    }
    const appElem = document.getElementById("app")
    const pageElem = document.getElementById("page")
    const handleLoaded = () => {
        const loadElem = document.getElementById("bload")
        const headerElem = document.getElementById("hload")
        const pageElem = document.getElementById("pload")
        if (isLoaded) {
            if (loadElem !== null) {
                loadElem.style.display = "none"
            }
            if (headerElem !== null) {
                headerElem.style.display = "none"
            }
            if (pageElem !== null) {
                pageElem.style.display = "none"
            }
        }
    }
    useEffect(() => {
        handleLoaded()
    }, [isLoaded])
    return (
        <Session_context.Provider value={{ session, setSession }}>
            <clickedButtonContext.Provider
                value={{ clickedButtonID, setClickedButtonID }}
            >
                <Profile_context.Provider value={{ profile, setProfile }}>
                    {/* Appページ向けコンポーネント */}
                    {!isLoaded && (
                        <>
                            <LoadSession
                                setMsgInfo={setMsgInfo}
                                setIsLoad={setIsLoad}
                            />
                        </>
                    )}
                    {appElem !== null &&
                        (isLoaded
                            ? ReactDOM.createPortal(
                                  <>
                                      <AppForm
                                          isProcessing={isProcessing}
                                          setProcessing={setProcessing}
                                          session={session}
                                          setMsgInfo={setMsgInfo}
                                      />
                                      <InfoOverlay
                                          msgInfo={msgInfo}
                                          hide={!isProcessing}
                                      />
                                      <InfoLabel msgInfo={msgInfo} />
                                      <div
                                          className={
                                              session.accessJwt === ""
                                                  ? "mb-16"
                                                  : ""
                                          }
                                      ></div>
                                  </>,
                                  appElem,
                              )
                            : //* 未ロード時はラベルのみ表示する（くるくるは親コンポーネントに埋め込まれている）
                              ReactDOM.createPortal(
                                  <>
                                      <InfoLabel msgInfo={msgInfo} />
                                  </>,
                                  appElem,
                              ))}
                </Profile_context.Provider>
                {/* 各OGPページ向けのコンポーネント */}
                {pageElem !== null &&
                    isLoaded &&
                    ReactDOM.createPortal(
                        <>
                            <PageControllerForm
                                pageId={pageElem.getAttribute("pageid")!}
                                session={session}
                                setMsgInfo={setMsgInfo}
                            />
                            <InfoLabel msgInfo={msgInfo} />
                        </>,
                        pageElem,
                    )}
                {/* 本体のコンポーネント */}
                {!portalonly &&
                    isLoaded &&
                    (session.accessJwt !== "" ? (
                        <>
                            <a
                                className={link({ class: ["mx-2"] })}
                                href={posturl}
                            >
                                PostForm
                            </a>
                            <LogoutButton
                                className={buttonstyle}
                                reload={true}
                                isProcessing={isProcessing}
                                setProcessing={setIsLoad}
                            />
                        </>
                    ) : (
                        <ProcButton
                            handler={handleClick}
                            isProcessing={isProcessing}
                            disabled={isProcessing}
                            showAnimation={false}
                            context="ログイン"
                            className={buttonstyle}
                        />
                    ))}
            </clickedButtonContext.Provider>
        </Session_context.Provider>
    )
}
export default Component
