![](./astro/public/materials/longlogo.svg)

[Skyshare](https://skyshare.nekono.dev/) is web application that BlueSky user saves their time of boring SNS X.com(Twitter).

## How works

Skyshare post your post to Bluesky with AT Protocol.  
for twitter, because of X taxes, Skyshare present Post Link: [Like that](https://twitter.com/intent/tweet?text=This&nbsp;is&nbsp;tweet&nbsp;sample.&url=https://skyshare.nekono.dev/posts/nlla.bsky.social_3kk7qzpffl22n/), can only with media by OGP image.

## AT Protocol

Because of bluesky official typescript client seems not available works on React, Skyshare uses REST API directry by fetch API like that...  

```ts:src/utils/atproto_api/createSession.ts
import endpoint_url, { com_atproto } from "./base"
import mtype from "./models/createSession.json"
import etype from "./models/error.json"
const endpoint = endpoint_url(com_atproto.server.createSession)

export const api = async ({
    identifier,
    password,
}:{
    identifier: string,
    password: string,
}): Promise<typeof mtype & typeof etype> => fetch(endpoint,
    {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
            {
                identifier: identifier,
                password: password,
            })
    }).then((response) => response.json()
    ).catch(() => {})

export default api
```

## more info

[Zenn article: for japanese developer](https://zenn.dev/nkte8/articles/2024-02-03-r01)
