namespace embed {
    export type images = {
        $type: "app.bsky.embed.images"
        images: Array<{
            image: {
                $type: "blob"
                ref: {
                    $link: string
                }
                mimeType: string
                size: number
            }
            alt: string
            aspectRatio?: {
                width: number
                height: number
            }
        }>
    }
    export type external = {
        $type: "app.bsky.embed.external"
        external: {
            uri: string
            title: string
            description: string
            thumb?: {
                ref: {
                    $link: string
                }
                mimeType: string
                size: number
            }
        }
    }
}
export default embed
