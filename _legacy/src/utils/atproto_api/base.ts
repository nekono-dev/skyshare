const xrpcurl = "https://bsky.social/xrpc"
export const getEndpoint = (path: string): string => {
    return `${xrpcurl}/${path}`
}
export namespace com_atproto {
    export const url = "com.atproto"
    export namespace repo {
        export const url = `${com_atproto.url}.repo`
        export const createRecord = `${com_atproto.repo.url}.createRecord`
        export const uploadBlob = `${com_atproto.repo.url}.uploadBlob`
        export const getRecord = `${com_atproto.repo.url}.getRecord`
    }
    export namespace server {
        export const url = `${com_atproto.url}.server`
        export const createSession = `${com_atproto.server.url}.createSession`
        export const deleteSession = `${com_atproto.server.url}.deleteSession`
        export const getSession = `${com_atproto.server.url}.getSession`
        export const refreshSession = `${com_atproto.server.url}.refreshSession`
    }
    export namespace identity {
        export const url = `${com_atproto.url}.identity`
        export const resolveHandle = `${com_atproto.identity.url}.resolveHandle`
    }
}

export namespace app_bsky {
    export const url = "app.bsky"
    export namespace actor {
        export const url = `${app_bsky.url}.actor`
        export const getProfile = `${app_bsky.actor.url}.getProfile`
    }
    export namespace feed {
        export const url = `${app_bsky.url}.feed`
        export const post = `${app_bsky.feed.url}.post`
        export const getPostThread = `${app_bsky.feed.url}.getPostThread`
    }
}
export default getEndpoint
