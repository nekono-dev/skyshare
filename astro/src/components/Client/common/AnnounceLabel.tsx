import { readAnnounceClosed, setAnnounceClosed } from "@/utils/useLocalStorage"
import { useState } from "react"
import { button_base } from "./tailwindVariants"
import Marquee from "react-fast-marquee";
import { changeurl } from "@/env/envs";

export const Component = () => {
    const refreshDate = new Date("2026-01-02").getTime()
    const [closed, setClosed] = useState(
        readAnnounceClosed(refreshDate).getTime() > refreshDate,
    )
    const handleClose = () => {
        setClosed(true)
        setAnnounceClosed(new Date().getTime())
    }
    return (
        <>
            {!closed && (
                <>
                    <div className="mx-auto max-w-xl my-1">
                        <div
                            className={[
                                "bg-sky-200",
                                "px-5",
                                "py-1",
                                "rounded-xl",
                                "w-full",
                                "flex",
                            ].join(" ")}
                        >
                            <div className="flex-1">
                                <Marquee delay={3}>
                                <span className="bg-white rounded-lg py-0.5 px-2 mr-2">お知らせ</span>
                                2026年もよろしくおねがいします。v1.6.0アップデートしました。詳しくは<a href={changeurl}>CHANGELOG</a>でﾖﾛ。blueskyにいっぱい人が来て嬉しくてつい...</Marquee>
                            </div>
                            <button
                                className={button_base({
                                    className: [
                                        "p-0.5",
                                        "px-2",
                                        "rounded-full",
                                        "text-xs",
                                        "align-middle",
                                        "flex-none",
                                    ],
                                })}
                                onClick={handleClose}
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
export default Component
