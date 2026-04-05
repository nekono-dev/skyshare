export const bskyPostUrlgen = (handle: string, rkey: string) => {
    return `https://bsky.app/profile/${handle}/post/${rkey}`
}

export const bskyCdnUrlgen = (repoDid: string, ref: string) => {
    return `https://cdn.bsky.app/img/feed_fullsize/plain/${encodeURIComponent(
        repoDid,
    )}/${encodeURIComponent(ref)}`
}

export const skyshareEntryUrlgen = (handle: string, rkey: string) => {
    return `${import.meta.env.SITE}/entries/${handle}@${rkey}`
}

export const parseAtUri = (
    uri: string,
): { repo: string; collection: string; rkey: string } | undefined => {
    const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/?#]+)$/)
    if (!match) return
    return { repo: match[1], collection: match[2], rkey: match[3] }
}
