// utils
import { Dispatch, ReactNode, SetStateAction } from "react"

// components
import ToggleSwitch from "../../common/ToggleSwitch"

// service
import { readNoGenerate, setNoGenerate } from "@/utils/useLocalStorage"

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
            initialValue={readNoGenerate(false)}
            setPropConfig={setNoGenerate}
            labeltext={labeltext}
            isLocked={isLocked}
        />
    )
}
export default Component
