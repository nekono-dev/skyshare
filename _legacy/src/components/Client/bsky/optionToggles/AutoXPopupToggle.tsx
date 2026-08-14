// utils
import { Dispatch, ReactNode, SetStateAction } from "react"

// components
import ToggleSwitch from "../../common/ToggleSwitch"

// service
import { readAutoXPopup, setAutoXPopup } from "@/utils/useLocalStorage"

const Component = ({
    labeltext,
    prop,
    setProp,
    isLocked,
}: {
    labeltext: ReactNode
    prop: boolean
    setProp: Dispatch<SetStateAction<boolean>>
    isLocked: boolean
}) => {
    return (
        <ToggleSwitch
            prop={prop}
            setProp={setProp}
            initialValue={readAutoXPopup(false)}
            setPropConfig={setAutoXPopup}
            labeltext={labeltext}
            isLocked={isLocked}
        />
    )
}
export default Component
