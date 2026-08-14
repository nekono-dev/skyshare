import { Dispatch, SetStateAction } from "react"
import SelectList from "../../common/SelectList"
import { label } from "@/utils/atproto_api/labels"
import pic from "@/images/warn.svg"

const labellist: Array<{ label: string; code: label.value | null }> = [
    {
        label: "-",
        code: null,
    },
    {
        label: "きわどい",
        code: {
            val: "sexual",
        },
    },
    {
        label: "ヌード",
        code: {
            val: "nudity",
        },
    },
    {
        label: "ポルノ",
        code: {
            val: "porn",
        },
    },
    {
        label: "ネタバレ",
        code: {
            val: "spoiler",
        },
    },
    {
        label: "警告表示",
        code: {
            val: "!warn",
        },
    },
]
export const Component = ({
    disabled,
    setSelfLabel,
    selectedLabel,
}: {
    disabled: boolean
    setSelfLabel: Dispatch<SetStateAction<label.value | null>>
    selectedLabel: label.value | null
}) => {
    return (
        <div className="flex my-auto mx-2">
            <svg
                className={[
                    "w-6 h-6",
                    "p-0.5",
                    "inline-block",
                    "align-middle",
                    "my-auto",
                    "mr-1",
                    `${selectedLabel !== null ? "fill-sky-400" : "fill-gray-400"}`,
                ].join(" ")}
            >
                <use xlinkHref={pic.src + "#warn"} height="100%" width="100%" />
            </svg>
            <SelectList
                disabled={disabled}
                setCode={setSelfLabel}
                codeMap={labellist}
            />
        </div>
    )
}
export default Component
