import { Dispatch, ReactNode, SetStateAction, useEffect, useRef } from "react"

const Component = ({
    labeltext,
    prop,
    setProp,
    initialValue,
    setPropConfig,
    isLocked,
    callback,
}: {
    labeltext: ReactNode
    prop: boolean
    setProp: Dispatch<SetStateAction<boolean>>
    initialValue: boolean
    setPropConfig: (flag: boolean) => void
    isLocked: boolean
    callback?: (checked: boolean) => boolean
}) => {
    const inputRef = useRef<HTMLInputElement>(null!)
    const handleClick = () => {
        inputRef.current.click()
    }
    // callback未定義の場合は、checkedをそのまま返却する関数をいれる
    const fakeCallback = (checked: boolean) => checked
    if (typeof callback === "undefined") {
        callback = fakeCallback
    }
    const setPropAll = (checked: boolean) => {
        setProp(checked)
        setPropConfig(checked)
    }
    const handleCheck = (event: React.ChangeEvent<HTMLInputElement>) => {
        const checked = event.currentTarget.checked
        event.currentTarget.checked = callback(checked)
        // 変更された値と、callbackを実行して得た値が一致している時のみpropを更新
        if (checked === event.currentTarget.checked) {
            setPropAll(checked)
        }
    }
    const handleLoaded = () => {
        const callbackInit = callback(initialValue)
        if (initialValue === callbackInit) {
            setPropAll(initialValue)
        } else {
            setPropAll(callbackInit)
        }
    }
    useEffect(() => {
        handleLoaded()
    }, [initialValue])

    return (
        <>
            <div className="my-auto flex">
                <input
                    ref={inputRef}
                    checked={prop}
                    onChange={handleCheck}
                    disabled={isLocked}
                    type="checkbox"
                    className="peer sr-only"
                />
                <label className="text-sm">{labeltext}:&nbsp;</label>
                <span
                    onClick={handleClick}
                    className="cursor-pointer my-auto block w-8 bg-gray-500 rounded-full p-[1px] 
                        after:block after:h-4 after:w-4 after:rounded-full 
                        after:bg-white after:transition 
                        peer-checked:bg-blue-500 
                        peer-checked:after:translate-x-[calc(100%-2px)]"
                ></span>
            </div>
        </>
    )
}
export default Component
