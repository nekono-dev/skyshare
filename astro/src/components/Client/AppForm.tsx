import { useState, Dispatch, SetStateAction } from "react"
import { type Session_info } from "./common/contexts"
import { type msgInfo, type modes } from "./common/types"
import LoginForm from "./bsky/LoginForm"
import PostForm from "./bsky/PostForm"
// import PageViewForm from "./pagedb/PageViewForm"
import ModeSelectButton from "./common/ModeSelectButton"
import LogoutButton from "./bsky/buttons/LogoutButton"
import PopupPreviewForm from "./intents/PopupPreviewForm"
import { MediaData } from "./common/types"
import { popupPreviewOptions } from "./intents/types"

const Component = ({
    session,
    isProcessing,
    setProcessing,
    setMsgInfo,
}: {
    session: Session_info
    isProcessing: boolean
    setProcessing: Dispatch<SetStateAction<boolean>>
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
}) => {
    // メディアのプレビューに関するStateコンストラクタ
    const [mediaData, setMediaData] = useState<MediaData>(undefined)
    const [popupPreviewOptions, setPopupPreviewOptions] =
        useState<popupPreviewOptions>(null!)
    const Forms = ({ mode }: { mode: modes }) => {
        switch (mode) {
            case "bsky":
                return (
                    <PostForm
                        setMode={setMode}
                        setMsgInfo={setMsgInfo}
                        isProcessing={isProcessing}
                        setProcessing={setProcessing}
                        mediaData={mediaData}
                        setMediaData={setMediaData}
                        setPopupPreviewOptions={setPopupPreviewOptions}
                    />
                )
            // case "pagedb":
            //     return <PageViewForm setMsgInfo={setMsgInfo} />
            case "xcom":
                return (
                    <PopupPreviewForm
                        popupPreviewOptions={popupPreviewOptions}
                    />
                )
        }
    }

    const [mode, setMode] = useState<modes>("bsky")
    return (
        <>
            {session.accessJwt !== "" ? (
                <>
                    {/* <AnnouceLabel /> */}
                    {Forms({ mode })}
                    <div
                        className={["flex", "justify-center", "my-1"].join(" ")}
                    >
                        {mode !== "bsky" && (
                            <ModeSelectButton
                                mode={mode}
                                setMode={setMode}
                                isProcessing={isProcessing}
                            />
                        )}
                        <LogoutButton
                            setMsgInfo={setMsgInfo}
                            reload={false}
                            isProcessing={isProcessing}
                            setProcessing={setProcessing}
                        />
                    </div>
                </>
            ) : (
                <LoginForm setMsgInfo={setMsgInfo} />
            )}
        </>
    )
}
export default Component
