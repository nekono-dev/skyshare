import { labels } from "./labels"
import facet from "./facets"
import embed from "./embeds"

export type record = {
    text: string
    createdAt: Date
    $type: "app.bsky.feed.post"
    langs: Array<string>
    labels?: labels
    facets?: Array<facet.link | facet.mention | facet.hashtag>
    embed?: embed.images | embed.external
    via?: string
}
export default record
