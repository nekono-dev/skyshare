/**
 * text -> richtextに変換を行うparserコンストラクタ
 */
class richTextFacetParser {
    private regexSearch = ({
        regex,
        text,
        result = [],
    }: {
        regex: RegExp
        text: string
        result: Array<string>
    }): void => {
        // regexした結果
        const regexResult = regex.exec(text)
        // マッチがない場合はresultを返却
        if (regexResult === null) {
            return
        }
        const matchIndex = regexResult.index
        const matchText = regexResult[1]
        // マッチ結果を格納
        result.push(matchText)
        // 本文からマッチ分を取り除いて、再起検索
        this.regexSearch({
            regex,
            text: text.slice(matchIndex + matchText.length),
            result,
        })
    }
    type: richTextFacetType
    regex: RegExp
    constructor(type: richTextFacetType) {
        this.type = type
        // typeが定まったらregexパターンも定まる
        switch (type) {
            case "link":
                this.regex = /(https?:\/\/[^ \r\n]+)( |\r\n|\n|\r)?/i
                break
            case "tag":
                this.regex = /((#|#️⃣)[^ \r\n]*)( |\r\n|\n|\r)?/i
                break
            case "mention":
                this.regex = /(@[^\s\r\n]+)\s?/i
                break
        }
    }
    getFacet = (text: string) => {
        const result: Array<string> = []
        this.regexSearch({
            regex: this.regex,
            text,
            result,
        })
        return result
    }
}

type richTextFacetType = "link" | "tag" | "mention"

// 現在どこからも参照されていないため、今後使うことなさそうであれば削除するコード
type parsedText = {
    type: richTextFacetType
    content: Array<string>
}
const parseText = ({ text }: { text: string }): Array<parsedText> => {
    let result: Array<parsedText> = []
    // link用Parser
    const facetLink = new richTextFacetParser("link")
    const facetTag = new richTextFacetParser("tag")
    const facetMention = new richTextFacetParser("mention")
    // Parse結果をresultに格納
    result = result.concat({
        type: facetLink.type,
        content: facetLink.getFacet(text),
    })
    result = result.concat({
        type: facetTag.type,
        content: facetTag.getFacet(text),
    })
    result = result.concat({
        type: facetTag.type,
        content: facetMention.getFacet(text),
    })
    return result
}

export default parseText
export { type parsedText, richTextFacetParser }
