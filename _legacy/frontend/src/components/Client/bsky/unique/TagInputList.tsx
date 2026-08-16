// utils
import { Dispatch, SetStateAction } from "react"

// service
import { button_base } from "../../common/tailwindVariants"
import { readSavedTags } from "@/utils/useLocalStorage"

export const Component = ({
    disabled,
    postText,
    setPostText,
}: {
    disabled: boolean
    postText: string
    setPostText: Dispatch<SetStateAction<string>>
}) => {
    const handleClick = (tag: string) => {
        let outputText = postText
        // 内容がない場合の初回のtag挿入の場合は前スペースで挿入
        if (postText === "") {
            outputText = [tag + " "].join("")
        } else {
            // 末尾が改行文字か、半角文字の場合は区切り記号を挿入しない
            // console.log(`last : "${postText.slice(-1)}"`)
            outputText = [
                postText,
                new RegExp(/[ \n\r]/).test(postText.slice(-1)) ? "" : " ",
                tag,
            ].join("")
        }
        setPostText(outputText)
    }
    const TagButton = ({ tag }: { tag: string }) => {
        return (
            <button
                onClick={() => {
                    handleClick(tag)
                }}
                className={button_base({
                    disabled: disabled,
                    class: [
                        "rounded-lg",
                        "my-auto",
                        "text-sm",
                        "py-0",
                        "px-3",
                        "w-fit",
                        "inline-block",
                        "whitespace-nowrap",
                    ],
                    noshadow: true,
                })}
            >
                {tag}
            </button>
        )
    }
    return (
        <div className="my-auto overflow-x-scroll flex w-fit minimum-scrollbars">
            {readSavedTags().map(value => {
                return <TagButton key={`tag-${value}`} tag={value} />
            })}
        </div>
    )
}
export default Component
