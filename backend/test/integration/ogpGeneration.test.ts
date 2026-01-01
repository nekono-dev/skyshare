import { describe, it, expect } from 'vitest';
import postOgp from '@/api/ogp/post.service.js';

import { AtpAgent } from '@atproto/api';
import { atpService } from '@/common/environments';

describe('OGP Generation test', async () => {
    const endpoint = process.env.BACKEND_ENDPOINT || 'http://localhost:3000';
    const agent = new AtpAgent({ service: atpService });
    const accessJwt = await agent
        .login({
            identifier: process.env.AT_SERVICE_ID!,
            password: process.env.AT_SERVICE_PASSWORD!,
        })
        .then((loginResult) => loginResult.data.accessJwt);

    const postOgpRequest = {
        accessJwt: accessJwt,
        uri: 'at://did:plc:quimkpbfh6mdasxs426v6ogy/app.bsky.feed.post/3mbd4tgm7qx24',
        handle: 'nekono-dev.bsky.social',
    };

    it('🟢[Positive] exec postOgp', async () => {
        const res = await postOgp(postOgpRequest);
        expect(res).toEqual({
            success: true,
            data: { uri: 'nekono-dev.bsky.social/3mbd4tgm7qx24.jpg' },
        });
    });

    it('🟢[Positive] POST /api/ogp', async () => {
        const response = await fetch(endpoint + '/api/ogp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postOgpRequest),
        });
        expect(await response.json()).toEqual({
            uri: 'nekono-dev.bsky.social/3mbd4tgm7qx24.jpg',
        });
    });
});
