import { Fragment, useContext } from "react"
import { Profile_context } from "../common/contexts"
import ShareButton from "./ShareButton"
import Tweetbox from "../common/Tweetbox"
import { readShowTaittsuu } from "@/utils/useLocalStorage"
import { popupPreviewOptions } from "./types"

export const Component = ({
    popupPreviewOptions,
}: {
    popupPreviewOptions: popupPreviewOptions
}) => {
    // プロフィール情報
    const { profile } = useContext(Profile_context)
    return (
        <>
            <div className="text-lg font-medium">Xへの投稿プレビュー画面</div>
            <Tweetbox>
                {/* 本文 */}
                <div className="flex m-2">
                    <div className="flex-none w-fit">
                        <img
                            src={profile?.avatar}
                            className="w-12 h-12 inline-block rounded-full"
                        />
                    </div>
                    <div className="text-left ml-3 break-all">
                        {popupPreviewOptions.postText
                            .split(/(\n)/)
                            .map(value => {
                                return (
                                    <Fragment key={`preview-text-${value}`}>
                                        {value.match(/\n/) ? <br /> : value}
                                    </Fragment>
                                )
                            })}
                    </div>
                </div>
                {/* プレビュー画像 */}
                <div className="block relative h-auto max-w-full">
                    {typeof popupPreviewOptions.mediaObjectURL !==
                        "undefined" && (
                        <>
                            {/* 画像 */}
                            {popupPreviewOptions.mediaObjectURL !== "" ? (
                                <img
                                    src={popupPreviewOptions.mediaObjectURL}
                                    className={[
                                        "w-full",
                                        "rounded-3xl",
                                        "aspect-[1.91/1]",
                                        "object-cover",
                                        "border-2",
                                    ].join(" ")}
                                />
                            ) : (
                                <div
                                    className={[
                                        "w-full",
                                        "rounded-3xl",
                                        "py-10",
                                        "object-cover",
                                        "border-2",
                                        "text-gray-300",
                                    ].join(" ")}
                                >
                                    No image
                                </div>
                            )}
                            {/* 画像の左端に表示されるタイトル文字 */}
                            {typeof popupPreviewOptions.ogpTitle !==
                                "undefined" && (
                                <div className="absolute bottom-2 left-4 bg-opacity-70 rounded-md px-2 text-white bg-black">
                                    {popupPreviewOptions.ogpTitle}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Tweetbox>
            <div className="max-w-xl mx-auto text-left">
                <b>実際の投稿内容は、Xの投稿画面で再度確認お願いします。</b>
                また、文字数がTwitterの制限(140字)を超えている場合はそのまま投稿できません。
                編集により文字数を手動で調整してください。
            </div>
            <div className="mx-auto w-fit">
                <ShareButton
                    className="block mx-auto"
                    labeltext={<div className="mb-0">Xでポストする</div>}
                    clikedtext={
                        <div className="mb-0 text-xs">
                            ポップアップを実行しました
                        </div>
                    }
                    options={{
                        kind: "xcom",
                        postText: popupPreviewOptions.postText,
                    }}
                    disabled={false}
                />
                {readShowTaittsuu(false) && (
                    <ShareButton
                        className="block mx-auto mt-2"
                        labeltext={
                            <div className="mb-0">タイッツーでポストする</div>
                        }
                        clikedtext={
                            <div className="mb-0 text-xs">
                                ポップアップを実行しました
                            </div>
                        }
                        options={{
                            kind: "taittsuu",
                            postText: popupPreviewOptions.postText,
                        }}
                        disabled={false}
                    />
                )}
            </div>
        </>
    )
}
export default Component
