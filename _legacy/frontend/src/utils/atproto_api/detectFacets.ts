import resolveHandle from "./resolveHandle"
import facets from "./facets"
// atproto.detectFacets
// 本家はinputは RichText型であるが、text型でなんとかする

type regexResult = {
    encoded: string
    index: {
        byteStart: number
        byteEnd: number
    }
}
const regexSearch = ({
    array,
    regex,
    encoded,
    cursor = 0,
}: {
    array: Array<regexResult>
    regex: RegExp
    encoded: string
    cursor?: number
}) => {
    // 文字を取得するために使用
    const regexedText = regex.exec(encoded)
    // バイト数を数えるために使用
    const replacedText = regex.exec(encoded.replace(/%../g, "*"))
    if (regexedText === null || replacedText === null) {
        return
    }
    const regexedStart = replacedText.index
    const linkref = decodeURI(regexedText[1])
    const regexedEnd = regexedStart + replacedText[1].length
    const sliceEnd = regexedText.index + regexedText[1].length
    const Item = {
        encoded: linkref,
        index: {
            byteStart: cursor + regexedStart,
            byteEnd: cursor + regexedEnd,
        },
    }
    array.push(Item)
    regexSearch({
        array,
        regex,
        encoded: encoded.slice(sliceEnd),
        cursor: cursor + regexedEnd,
    })
}

const createLinkFacet = ({
    encoded,
}: {
    encoded: string
}): Array<facets.link> => {
    const Regex = /(https?:\/\/[^ \r\n]+)( |\r\n|\n|\r)?/i
    const result: Array<facets.link> = []
    const regexResult: Array<regexResult> = []
    regexSearch({
        array: regexResult,
        regex: Regex,
        encoded: encoded,
    })
    for (const link of regexResult) {
        result.push({
            index: link.index,
            features: [
                {
                    $type: "app.bsky.richtext.facet#link",
                    uri: link.encoded,
                },
            ],
        })
    }
    return result
}

const createMentionFacet = async ({
    encoded,
}: {
    encoded: string
}): Promise<Array<facets.mention>> => {
    const Regex = /(@[^\s\r\n]+)\s?/i
    const result: Array<facets.mention> = []
    const regexResult: Array<regexResult> = []
    regexSearch({
        array: regexResult,
        regex: Regex,
        encoded: encoded,
    })
    for (const link of regexResult) {
        try {
            const resResolve = await resolveHandle({
                handle: link.encoded.slice(1),
            })
            result.push({
                index: link.index,
                features: [
                    {
                        $type: "app.bsky.richtext.facet#mention",
                        did: resResolve.did,
                    },
                ],
            })
        } catch (_: unknown) {
            continue
        }
    }
    return result
}

const createHashtagFacet = ({
    encoded,
}: {
    encoded: string
}): Array<facets.hashtag> => {
    const Regex = /((#|#️⃣)[^ \r\n]*)( |\r\n|\n|\r)?/i
    const result: Array<facets.hashtag> = []
    const regexResult: Array<regexResult> = []
    regexSearch({
        array: regexResult,
        regex: Regex,
        encoded: encoded,
    })
    for (const tag of regexResult) {
        result.push({
            index: tag.index,
            features: [
                {
                    $type: "app.bsky.richtext.facet#tag",
                    tag: tag.encoded.slice(1),
                },
            ],
        })
    }
    return result
}

const detectFacets = async ({
    text,
}: {
    text: string
}): Promise<Array<facets.link | facets.mention | facets.hashtag>> => {
    let facets: Array<facets.link | facets.mention | facets.hashtag> = []
    const encoded = encodeURI(text).replace(/%(20|0A)/g, " ")
    facets = facets.concat(createLinkFacet({ encoded }))
    facets = facets.concat(await createMentionFacet({ encoded }))
    facets = facets.concat(createHashtagFacet({ encoded }))
    return facets
}

export default detectFacets
