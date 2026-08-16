export namespace label {
    export type value = {
        val: "sexual" | "nudity" | "porn" | "spoiler" | "!warn"
    }
}
export type labels = {
    $type: "com.atproto.label.defs#selfLabels"
    values: Array<label.value>
}
