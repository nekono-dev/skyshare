import { dbEndpointWithCredential } from '../common/environments.js';
import Redis from 'ioredis';

const redis = new Redis.default(dbEndpointWithCredential);
const dbTTL = 60 * 60 * 24 * 365; // 365日

/**
 * upstashに登録する情報
 * @param {string} ogp OGPイメージのリンク
 * @param {Array<object>} imgs イメージ情報のリスト
 * @param {string} imgs.thumb イメージのサムネイル情報
 * @param {string} imgs.alt イメージのalt情報
 */
type PageDb = {
    ogp: string;
    imgs: Array<{
        thumb: string;
        alt: string;
    }>;
};

const addPage = async (key: string, raw: PageDb) => {
    const body = Buffer.from(JSON.stringify(raw)).toString('base64');
    await redis.set(key, body, 'EX', dbTTL);
    return;
};

export { addPage };
