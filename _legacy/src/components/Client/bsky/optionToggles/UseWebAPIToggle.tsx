// utils
import { Dispatch, ReactNode, SetStateAction } from "react"

// components
import ToggleSwitch from "../../common/ToggleSwitch"

// service
import { readUseWebShareAPI, setUseWebShareAPI } from "@/utils/useLocalStorage"
import { type msgInfo } from "../../common/types"
import { isShareEnable } from "../lib/webshareApi"

const Component = ({
    labeltext,
    prop,
    setProp,
    setMsgInfo,
}: {
    labeltext: ReactNode
    prop: boolean
    setProp: Dispatch<SetStateAction<boolean>>
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
}) => {
    const callbackIsShareEnable = (checked: boolean) => {
        if (checked === true) {
            return isShareEnable({ setMsgInfo })
        }
        return false
    }
    return (
        <ToggleSwitch
            prop={prop}
            setProp={setProp}
            initialValue={readUseWebShareAPI(false)}
            setPropConfig={setUseWebShareAPI}
            labeltext={labeltext}
            isLocked={false}
            callback={callbackIsShareEnable}
        />
    )
}
export default Component
