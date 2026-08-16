// utils
import { Dispatch, ReactNode, SetStateAction } from "react"

// components
import ToggleSwitch from "../../common/ToggleSwitch"

// service
import { readShowTaittsuu, setShowTaittsuu } from "@/utils/useLocalStorage"

const Component = ({
    labeltext,
    prop,
    setProp,
}: {
    labeltext: ReactNode
    prop: boolean
    setProp: Dispatch<SetStateAction<boolean>>
}) => {
    return (
        <ToggleSwitch
            prop={prop}
            setProp={setProp}
            initialValue={readShowTaittsuu(false)}
            setPropConfig={setShowTaittsuu}
            labeltext={labeltext}
            isLocked={false}
        />
    )
}
export default Component
