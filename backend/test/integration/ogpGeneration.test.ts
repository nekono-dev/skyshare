import { describe, it, expect } from 'vitest';
import postOgp from '@/api/v1.6/ogp/post.service';
import deleteOgp from '@/api/v1.6/ogp/delete.service';
import getPage from '@/api/v1.6/page/get.service';

import { AtpAgent } from '@atproto/api';
import { atpService } from '@/common/environments';
import { logger } from '@/common/logger';
import { extractImagesFromPost, getThreadPost } from '@/lib/bsky';

describe('OGP Generation test', async () => {
    const endpoint = process.env.BACKEND_ENDPOINT || 'http://localhost:3000';
    const launchEnv = process.env.LAUNCH_ENV || 'local';
    const storageViewUrl =
        process.env.OBJ_STORAGE_VIEW_URL || 'http://127.0.0.1:9000/skyshare';

    logger.info(`Backend endpoint: ${endpoint}`);
    logger.info(`Launch Env: ${launchEnv}`);

    const agent = new AtpAgent({ service: atpService });
    const accessJwt = await agent
        .login({
            identifier: process.env.AT_SERVICE_ID!,
            password: process.env.AT_SERVICE_PASSWORD!,
        })
        .then((loginResult) => loginResult.data.accessJwt);

    const postId =
        'at://did:plc:quimkpbfh6mdasxs426v6ogy/app.bsky.feed.post/3mbd4tgm7qx24';
    const postImages = await getThreadPost(agent, postId).then((post) => {
        return extractImagesFromPost(post).map((img) => {
            return {
                thumb: img.thumb,
                alt: img.alt,
            };
        });
    });
    const postIdDid = postId.split('/')[2];
    const postIdHash = postId.split('/')[4];

    const postOgpRequest = {
        accessJwt: accessJwt,
        uri: postId,
        handle: 'nekono-dev.bsky.social',
    };

    let dbIndex = 0; // postOgpResult

    describe('Function test', async () => {
        it('🟢[Positive] exec postOgp', async () => {
            const res = await postOgp(postOgpRequest);
            // dbIndex値はランダムに選出されるため、テストでは考慮しない
            if (res.success) {
                dbIndex = res.data.dbIndex;
            }
            expect(res).toEqual({
                success: true,
                data: {
                    uri: `${postIdDid}/${postIdHash}.jpg`,
                    dbIndex: dbIndex,
                },
            });
        });
        it('🟢[Positive] exec getPage', async () => {
            const res = await getPage({
                dbKey: `${postIdDid}@${postIdHash}`,
                dbIndex: dbIndex.toString(),
            });
            expect(res).toEqual({
                success: true,
                data: {
                    ogp: new URL(
                        `${storageViewUrl}/${postIdDid}/${postIdHash}.jpg`
                    ).toString(),
                    imgs: postImages,
                },
            });
        });

        const deleteOgpRequest = {
            pageId: `${dbIndex}/${postIdDid}@${postIdHash}`,
            accessJwt: accessJwt,
        };

        it('🔴[Negative] exec deleteOgp wrong did', async () => {
            const res = await deleteOgp({
                pageId: `${dbIndex}/did:plc:wrongdidvalue@${postIdHash}`,
                accessJwt: accessJwt,
            });
            expect(res).toEqual({
                success: false,
                error: 'BadRequest',
            });
        });
        it('🟢[Positive] exec deleteOgp', async () => {
            const res = await deleteOgp(deleteOgpRequest);
            expect(res).toEqual({
                success: true,
                data: { result: 'ok' },
            });
        });
    });
    describe('API test', async () => {
        it('🟢[Positive] POST ogp resource', async () => {
            const response = await fetch(endpoint + '/api/v1/ogp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(postOgpRequest),
            });
            const body = await response.json();
            // update dbIndex and pageId for next test
            dbIndex = body.dbIndex;
            expect(body.uri).toEqual(`${postIdDid}/${postIdHash}.jpg`);
        });

        const deleteOgpRequest = {
            pageId: `${dbIndex}/${postIdDid}@${postIdHash}`,
            accessJwt: accessJwt,
        };

        it('🟢[Positive] GET ogp resource', async () => {
            const url =
                endpoint +
                `/api/v1/page/${dbIndex.toString()}/${encodeURIComponent(
                    postIdDid + '@' + postIdHash
                )}`;
            logger.debug(`GET ogp resource with params: ${url}`);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            expect(await response.json()).toEqual({
                ogp: new URL(
                    `${storageViewUrl}/${postIdDid}/${postIdHash}.jpg`
                ).toString(),
                imgs: postImages,
            });
        });
        it('🟢[Positive] DELETE page resource', async () => {
            const response = await fetch(endpoint + '/api/v1/ogp', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(deleteOgpRequest),
            });
            const body = await response.json();
            expect(body).toEqual({
                result: 'ok',
            });
        });
    });
});
