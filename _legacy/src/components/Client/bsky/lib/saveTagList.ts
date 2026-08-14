// service
import { setSavedTags, readSavedTags } from "@/utils/useLocalStorage"
import { richTextFacetParser } from "@/utils/richTextParser"

const saveTagToSavedTags = ({ postText }: { postText: string }): void => {
    // 保存できるタグの上限
    const maxTagCount = 8

    // Hashtagが含まれている場合はブラウザに保存
    const richTextLinkParser = new richTextFacetParser("tag")
    const parseResult = richTextLinkParser.getFacet(postText)

    const savedTag = readSavedTags()

    const taglist: string[] = savedTag !== null ? savedTag : []
    parseResult.forEach(value => {
        const tagName = value
        const tagIndex = taglist.indexOf(tagName)
        if (tagIndex < 0) {
            // タグが存在しない場合は先頭に追加
            taglist.unshift(tagName)
        } else {
            // タグが存在する場合は先頭に移動
            taglist.splice(tagIndex, 1)
            taglist.unshift(tagName)
        }
    })
    setSavedTags(taglist.slice(0, maxTagCount))
}

export default saveTagToSavedTags
