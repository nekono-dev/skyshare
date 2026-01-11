import { describe, it, expect, vi } from 'vitest';
import postOgp from '@/api/v1.6/page/post.service';
import deleteOgp from '@/api/v1.6/page/delete.service';
import getPage from '@/api/v1.6/page/get.service';

import { AtpAgent } from '@atproto/api';
import { atpService } from '@/common/environments';
import { logger } from '@/common/logger';
import { extractImagesFromPost, getThreadPost } from '@/lib/bsky';
import { UpstashRateLimitError, RedisClient } from '@/lib/redis';

describe('OGP Generation test', async () => {
    const endpoint = process.env.BACKEND_ENDPOINT || 'http://localhost:3000';
    const launchEnv = process.env.LAUNCH_ENV || 'local';
    const storageViewUrl =
        process.env.OBJ_STORAGE_VIEW_URL || 'http://127.0.0.1:9000/skyshare';

    logger.info(`Backend endpoint: ${endpoint}`);
    logger.info(`Launch Env: ${launchEnv}`);

    const agent = new AtpAgent({ service: atpService });

    const handle = 'nekono-dev.bsky.social';
    const postId =
        'at://did:plc:quimkpbfh6mdasxs426v6ogy/app.bsky.feed.post/3mbd4tgm7qx24';

    const accessJwt = await agent
        .login({
            identifier: process.env.AT_SERVICE_ID!,
            password: process.env.AT_SERVICE_PASSWORD!,
        })
        .then((loginResult) => loginResult.data.accessJwt);

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
        handle: handle,
    };

    describe('Function test', async () => {
        let dbIndex = 0; // postOgpResult

        it('🟢[Positive] exec postOgp', async () => {
            const res = await postOgp(postOgpRequest);
            // dbIndex値はランダムに選出されるため、テストでは考慮しない
            if (res.success) {
                dbIndex = res.data.dbIndex;
                logger.debug(`postOgp selected dbIndex: ${dbIndex}`);
            }
            expect(res).toEqual({
                success: true,
                data: {
                    uri: `${postIdDid}@${postIdHash}`,
                    dbIndex: dbIndex,
                },
            });
        });
        it('🟢[Positive] exec getPage', async () => {
            logger.debug(`getPage using dbIndex: ${dbIndex}`);
            const res = await getPage({
                dbKey: `${postIdDid}@${postIdHash}`,
                dbIndex: dbIndex.toString(),
            });
            expect(res).toEqual({
                success: true,
                data: {
                    handle: 'nekono-dev.bsky.social',
                    ogp: new URL(
                        `${storageViewUrl}/${postIdDid}/${postIdHash}.jpg`,
                    ).toString(),
                    imgs: postImages,
                },
            });
        });

        it('🔴[Negative] exec deleteOgp wrong did', async () => {
            const wrongDeleteOgpRequest = {
                pageId: `${dbIndex}/did:plc:wrongdidvalue@${postIdHash}`,
                accessJwt: accessJwt,
            };
            logger.debug(
                `deleteOgp using wrongDeleteOgpRequest: ${JSON.stringify(
                    wrongDeleteOgpRequest,
                )}`,
            );
            const res = await deleteOgp(wrongDeleteOgpRequest);
            expect(res).toEqual({
                success: false,
                error: 'BadRequest',
            });
        });
        it('🔴[Negative] getPage returns RateLimitError when redis rate-limited', async () => {
            const spy = vi
                .spyOn(RedisClient.prototype, 'getPage')
                .mockRejectedValue(
                    new UpstashRateLimitError(
                        'ERR max daily request limit exceeded',
                    ),
                );

            const res = await getPage({
                dbKey: `${postIdDid}@${postIdHash}`,
                dbIndex: '0',
            });
            expect(res).toEqual({ success: false, error: 'RateLimitExceeded' });

            spy.mockRestore();
        });
        it('🟢[Positive] exec deleteOgp', async () => {
            const deleteOgpRequest = {
                pageId: `${dbIndex}/${postIdDid}@${postIdHash}`,
                accessJwt: accessJwt,
            };
            logger.debug(
                `deleteOgp using deleteOgpRequest: ${JSON.stringify(
                    deleteOgpRequest,
                )}`,
            );
            const res = await deleteOgp(deleteOgpRequest);
            expect(res).toEqual({
                success: true,
                data: { result: 'ok' },
            });
        });
    });

    describe('API test', async () => {
        let dbIndex = 0; // postOgpResult

        it('🟢[Positive] POST ogp resource', async () => {
            const response = await fetch(endpoint + '/page', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(postOgpRequest),
            });
            const body = await response.json();
            // update dbIndex and pageId for next test
            dbIndex = body.dbIndex;
            expect(body.uri).toEqual(`${postIdDid}@${postIdHash}`);
        });

        it('🟢[Positive] GET ogp resource', async () => {
            const url =
                endpoint +
                `/page/${dbIndex}/${encodeURIComponent(
                    postIdDid + '@' + postIdHash,
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
                    `${storageViewUrl}/${postIdDid}/${postIdHash}.jpg`,
                ).toString(),
                handle: handle,
                imgs: postImages,
            });
        });
        it('🟢[Positive] DELETE page resource', async () => {
            const deleteOgpRequest = {
                pageId: `${dbIndex}/${postIdDid}@${postIdHash}`,
                accessJwt: accessJwt,
            };
            const response = await fetch(endpoint + '/page', {
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
