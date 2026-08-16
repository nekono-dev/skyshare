import { useEffect, useState } from "react"
import { type msgInfo } from "../../common/types"
import Circle from "../../common/LoadingCircle"
// const sleep = (msec: number) =>
//     new Promise(resolve => setTimeout(resolve, msec))

const Component = ({ msgInfo, hide }: { msgInfo: msgInfo; hide: boolean }) => {
    const [hidden, setHidden] = useState<boolean>(false)
    const showOverlay = (willHide: boolean) => {
        const body = document.getElementById("root")!
        const overlay = [
            "after:fixed",
            "after:w-screen",
            "after:h-screen",
            "after:bg-black/25",
            "after:top-0",
            "after:left-0",
        ]
        if (willHide !== true) {
            body.classList.add(...overlay)
            setHidden(willHide)
        } else {
            // await sleep(1000)
            setHidden(willHide)
            body.classList.remove(...overlay)
        }
    }
    useEffect(() => {
        showOverlay(hide) //.catch(() => {})
    }, [hide])

    return (
        <div className={hidden === true ? "hidden" : undefined}>
            <div
                className={[
                    "absolute",
                    "m-auto",
                    "top-24",
                    "left-0",
                    "right-0",
                    "h-32",
                    "min-h-32",
                    "min-w-32",
                    "max-w-96",
                    "bg-white",
                    "rounded-xl",
                    "z-30",
                    "flex",
                    "flex-col",
                    "items-center",
                ].join(" ")}
            >
                <div className="my-auto">
                    <Circle size="m" />
                    {msgInfo.msg !== "" && (
                        <div className="mx-auto w-fit my-1">
                            <div
                                className={
                                    msgInfo.isError
                                        ? "bg-red-300 px-5 py-1 text-white rounded-xl"
                                        : "bg-sky-200 px-5 py-1 rounded-xl w-fit"
                                }
                            >
                                {msgInfo.msg}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
export default Component
