import { describe, it, expect } from 'vitest';

import { AtpAgent } from '@atproto/api';
import { atpService } from '@/common/environments';
import { logger } from '@/common/logger';
import { extractImagesFromPost, getThreadPost } from '@/lib/bsky';
import { RedisClient } from '@/lib/redis';
import { S3ClientWrapper } from '@/lib/s3';

describe('Legacy DB Operation test', async () => {
    const endpoint = process.env.BACKEND_ENDPOINT || 'http://localhost:3000';
    const launchEnv = process.env.LAUNCH_ENV || 'local';
    const legacyDbEndpoint =
        process.env.LEGACY_DB_ENDPOINT || 'redis://localhost:6379';
    const legacyStorageEndpoint =
        process.env.LEGACY_OBJ_STORAGE_ENDPOINT || 'http://localhost:9000/';
    const legacyStorageViewurl =
        process.env.LEGACY_OBJ_STORAGE_VIEWURL ||
        'http://localhost:9000/skyshare';
    const legacyStorageBucket =
        process.env.LEGACY_OBJ_STORAGE_BUCKET || 'skyshare';
    const legacyStorageRegion =
        process.env.LEGACY_OBJ_STORAGE_REGION || 'us-east-1';
    const legacyStorageCredential =
        process.env.LEGACY_OBJ_STORAGE_CREDENTIAL || 'minioadmin:minioadmin';

    logger.info(`Backend endpoint: ${endpoint}`);
    logger.info(`Launch Env: ${launchEnv}`);

    const agent = new AtpAgent({ service: atpService });
    const loginResult = await agent.login({
        identifier: process.env.AT_SERVICE_ID!,
        password: process.env.AT_SERVICE_PASSWORD!,
    });
    const handle = loginResult.data.handle;
    const did = loginResult.data.did;
    const accessJwt = loginResult.data.accessJwt;

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
    const postIdHash = postId.split('/')[4];
    const postOgpUrl = `${handle}/${postIdHash}`;

    const s3Client = new S3ClientWrapper({
        endpoint: legacyStorageEndpoint,
        bucket: legacyStorageBucket,
        viewUrl: legacyStorageViewurl,
        region: legacyStorageRegion,
        credential: legacyStorageCredential,
    });
    await s3Client.uploadToS3({
        key: postOgpUrl,
        body: Buffer.from('dummy image data'),
        contentType: 'image/jpeg',
    });

    const dbIndex = 'legacy'; // legacy DB指定
    const redisClient = new RedisClient({ endpoint: legacyDbEndpoint });

    const ogpUrl = `${legacyStorageViewurl}/${postOgpUrl}`;
    const regacyData = {
        ogp: ogpUrl,
        imgs: [
            {
                thumb: 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:quimkpbfh6mdasxs426v6ogy/bafkreifprzn26nliu7gk6rjk63q4k3po6apgydkkxhnzaj4cqab5o7vgxm@jpeg',
                alt: '',
            },
        ],
    };
    await redisClient.addPage(`${handle}@${postIdHash}`, regacyData);

    describe('API test', async () => {
        const deleteOgpRequest = {
            pageId: `${dbIndex}/${handle}@${postIdHash}`,
            accessJwt: accessJwt,
            did: did,
        };

        it('🟢[Positive] GET ogp resource', async () => {
            const url =
                endpoint +
                `/api/v1/page/${dbIndex}/${encodeURIComponent(
                    handle + '@' + postIdHash
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
                    `${legacyStorageViewurl}/${postOgpUrl}`
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
