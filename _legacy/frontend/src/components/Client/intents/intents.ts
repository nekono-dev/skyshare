import { intentPreset, intentKinds } from "./types"

type intentAppsPreset = {
    kind: intentKinds
    intents: Array<intentPreset>
    default: string
}

class Intents {
    intentKind: string
    intentAppPreset: intentAppsPreset | undefined
    private intentAppsPreset: Array<intentAppsPreset> = [
        {
            kind: "xcom",
            intents: [
                {
                    hardware: "android",
                    url: "intent://post?message=CONTENT#Intent;scheme=twitter;package=com.twitter.android;end;",
                },
                {
                    hardware: "iphone",
                    url: "twitter://post?message=CONTENT",
                },
                {
                    hardware: "ipad",
                    url: "twitter://post?message=CONTENT",
                },
            ],
            default: "https://twitter.com/intent/tweet?text=CONTENT",
        },
        {
            kind: "taittsuu",
            intents: [],
            default: "https://taittsuu.com/share?text=CONTENT",
        },
    ]
    constructor(intentKind: intentKinds) {
        this.intentKind = intentKind
        this.intentAppPreset = this.intentAppsPreset.find(
            value => value.kind === intentKind,
        )
    }
}
export { Intents }
