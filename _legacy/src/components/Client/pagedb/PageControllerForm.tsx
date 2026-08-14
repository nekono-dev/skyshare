import { Dispatch, SetStateAction } from "react"
import { posturl } from "@/env/envs"
import { type Session_info } from "../common/contexts"
import { type msgInfo } from "../common/types"
import PageDeleteButton from "./PageDeleteButton"
import ProcButton from "../common/ProcButton"

const Component = ({
    pageId,
    session,
    setMsgInfo,
}: {
    pageId: string
    session: Session_info
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
}) => {
    const handleClick = () => {
        location.href = posturl
    }
    return (
        <div className="justify-center">
            {session.accessJwt !== "" ? (
                <>
                    <PageDeleteButton
                        pageId={pageId}
                        session={session}
                        setMsgInfo={setMsgInfo}
                    />
                </>
            ) : (
                <ProcButton
                    handler={handleClick}
                    isProcessing={false}
                    showAnimation={false}
                    context="ログイン"
                />
            )}
        </div>
    )
}
export default Component
