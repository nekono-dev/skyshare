// utils
import { Dispatch, ReactNode, SetStateAction, useEffect, useState } from "react"

// components
import DeleteItemButton from "./DeleteItemButton"
import AltDialog from "./AltDialog"
import MetaView from "./MetaView"

// service
import { tv } from "tailwind-variants"
import { MediaData } from "../../common/types"

const view = tv({
    base: "object-cover border-2 border-white w-full h-full m-0 p-0",
    variants: {
        size: {
            w_half: "w-1/2 h-full",
            h_half: "h-1/2 w-full",
            half: "w-1/2 h-1/2",
        },
    },
})

const Component = ({
    mediaData,
    setMediaData,
}: {
    mediaData: MediaData
    // 配列を操作するだけなのでArray型さえ担保されていれば良い
    setMediaData: Dispatch<SetStateAction<MediaData>>
}) => {
    // プレビューを構成するコンポーネント
    const PreviewNode = ({
        index,
        classNameImage,
        className,
    }: {
        index: number
        classNameImage?: string
        className?: string
    }) => {
        const mediaBlob: Blob | undefined =
            typeof mediaData !== "undefined"
                ? mediaData.images[index].blob
                : undefined

        const alt: string | undefined =
            typeof mediaData !== "undefined" && mediaData.type === "images"
                ? mediaData.images[index].alt
                : undefined
        return (
            <div className={"relative " + className}>
                <DeleteItemButton
                    itemId={index}
                    mediaData={mediaData}
                    setMediaData={setMediaData}
                />
                {typeof mediaData !== "undefined" &&
                    mediaData.type === "images" && (
                        <AltDialog itemId={index} mediaData={mediaData} />
                    )}
                {typeof mediaBlob !== "undefined" ? (
                    <img
                        src={URL.createObjectURL(mediaBlob)}
                        alt={alt}
                        className={classNameImage}
                    />
                ) : (
                    <div className={classNameImage}>
                        リンクカード画像を取得できませんでした。
                    </div>
                )}
            </div>
        )
    }
    const PreviewLayout = (index: number): ReactNode => {
        switch (index) {
            case 0:
                return (
                    <div className="h-fit w-fit m-auto align-middle absolute top-0 bottom-0 right-0 left-0">
                        プレビューが表示されます
                    </div>
                )
            case 1:
                return (
                    <div className="w-full h-full m-0">
                        {PreviewNode({
                            index: 0,
                            className: view({ class: "inline-block" }),
                            classNameImage: view({ class: "rounded-2xl" }),
                        })}
                    </div>
                )
            case 2:
                return (
                    <div className="w-full h-full m-0">
                        {PreviewNode({
                            index: 0,
                            className: view({
                                class: "inline-block",
                                size: "w_half",
                            }),
                            classNameImage: view({ class: "rounded-l-2xl" }),
                        })}
                        {PreviewNode({
                            index: 1,
                            className: view({
                                class: "inline-block",
                                size: "w_half",
                            }),
                            classNameImage: view({ class: "rounded-r-2xl" }),
                        })}
                    </div>
                )
            case 3:
                return (
                    <div className={["h-full", "m-0"].join(" ")}>
                        {PreviewNode({
                            index: 0,
                            className: view({
                                class: "inline-block",
                                size: "w_half",
                            }),
                            classNameImage: view({ class: "rounded-l-2xl" }),
                        })}
                        <div className="w-1/2 h-full m-0 inline-block">
                            {PreviewNode({
                                index: 1,
                                className: view({ size: "h_half" }),
                                classNameImage: view({
                                    class: "rounded-tr-2xl",
                                }),
                            })}
                            {PreviewNode({
                                index: 2,
                                className: view({ size: "h_half" }),
                                classNameImage: view({
                                    class: "rounded-br-2xl",
                                }),
                            })}
                        </div>
                    </div>
                )
            case 4:
                return (
                    <div className={["h-full", "m-0"].join(" ")}>
                        <div className="w-1/2 h-full m-0 inline-block">
                            {PreviewNode({
                                index: 0,
                                className: view({ size: "h_half" }),
                                classNameImage: view({
                                    class: "rounded-tl-2xl",
                                }),
                            })}
                            {PreviewNode({
                                index: 2,
                                className: view({ size: "h_half" }),
                                classNameImage: view({
                                    class: "rounded-bl-2xl",
                                }),
                            })}
                        </div>
                        <div className="w-1/2 h-full m-0 inline-block">
                            {PreviewNode({
                                index: 1,
                                className: view({ size: "h_half" }),
                                classNameImage: view({
                                    class: "rounded-tr-2xl",
                                }),
                            })}
                            {PreviewNode({
                                index: 3,
                                className: view({ size: "h_half" }),
                                classNameImage: view({
                                    class: "rounded-br-2xl",
                                }),
                            })}
                        </div>
                    </div>
                )
            default:
                break
        }
    }
    const [PreviewForm, setPreviewForm] = useState<ReactNode>(PreviewLayout(-1))

    useEffect(() => {
        if (typeof mediaData !== "undefined") {
            if (mediaData.type === "external") {
                setPreviewForm(PreviewLayout(mediaData.images !== null ? 1 : 0))
            }
            if (mediaData.type === "images") {
                setPreviewForm(PreviewLayout(mediaData.images.length))
            }
        } else {
            setPreviewForm(PreviewLayout(0))
        }
    }, [mediaData])

    return (
        <div className={["border-2", "rounded-2xl", "p-2"].join(" ")}>
            <div className="aspect-[1.91/1] relative m-0">{PreviewForm}</div>
            {typeof mediaData !== "undefined" &&
                mediaData.type === "external" && (
                    <MetaView mediaData={mediaData} />
                )}
        </div>
    )
}
export default Component
