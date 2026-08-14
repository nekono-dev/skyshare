import dotenv from 'dotenv';
import { z } from 'zod';
import {
    type DbEndpointRule,
    DbEndpointRuleSchema,
} from './dbEndpoint.schema.js';
if (process.env.LAUNCH_ENV === undefined) {
    dotenv.config();
}

const launchEnv = process.env.LAUNCH_ENV;
const atpService = process.env.ATP_SERVICE_URL || 'https://bsky.social';

const dbEndpoints: string[] = z
    .array(z.string().min(1))
    .min(1)
    .parse(JSON.parse(process.env.DB_ENDPOINTS || '[]'));

const dbEndpointRule: DbEndpointRule = DbEndpointRuleSchema.parse(
    JSON.parse(process.env.DB_ENDPOINT_RULE || '{}'),
);

const objStorageRegion = process.env.OBJ_STORAGE_REGION || 'minio';
const objStorageBucket = process.env.OBJ_STORAGE_BUCKET || 'skyshare';
const objStorageEndpoint =
    process.env.OBJ_STORAGE_ENDPOINT || 'http://localhost:9000';
const objStorageCredential =
    process.env.OBJ_STORAGE_CREDENTIAL || 'minioadmin:minioadmin';

const objStorageViewURL = (
    process.env.OBJ_STORAGE_VIEW_URL || 'http://127.0.0.1:9000'
).replace(/(.+)\/$/, '$1');

const legacyDbEndpoint = process.env.LEGACY_DB_ENDPOINT;

const serviceUrl = 'https://skyshare.nekono.dev';

export {
    launchEnv,
    atpService,
    dbEndpoints,
    objStorageBucket,
    objStorageRegion,
    objStorageEndpoint,
    objStorageCredential,
    objStorageViewURL,
    legacyDbEndpoint,
    serviceUrl,
    dbEndpointRule,
};
