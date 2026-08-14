import { readForceIntent } from "@/utils/useLocalStorage"
import { Intents } from "./intents"
import { popupOptions } from "./types"

const callPopup = (popupOptions: popupOptions): void => {
    const ua = window.navigator.userAgent.toLowerCase()
    const tweetext = encodeURIComponent(popupOptions.postText)
    const intent = new Intents(popupOptions.kind)
    if (typeof intent.intentAppPreset !== "undefined") {
        let intentDefine: string = intent.intentAppPreset.default
        // Intent forceフラグが付いた場合、強制的にハードウェア依存のintentURLを使用する
        if (readForceIntent(false) === true) {
            intent.intentAppPreset.intents.forEach(value => {
                if (ua.indexOf(value.hardware) > 0) {
                    intentDefine = value.url
                }
            })
        }
        window.open(
            `${intentDefine.replace("CONTENT", tweetext)}`,
            "_blank",
            "",
        )
    } else {
        const e: Error = new Error(
            "intentInfoへ対応していないサービスが指定されました。",
        )
        e.name = "popup.ts"
        throw e
    }
}

export default callPopup
