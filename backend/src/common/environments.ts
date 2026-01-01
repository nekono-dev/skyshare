const launchEnv = process.env.LAUNCH_ENV || 'local';
const atpService = process.env.ATP_SERVICE_URL || 'https://bsky.social';

const dbEndpointWithCredential =
    process.env.DB_ENDPOINT_WITH_CREDENTIAL || 'redis://localhost:6379';

const objStorageRegion = process.env.OBJ_STORAGE_REGION || 'minio';
const objStorageBucket = process.env.OBJ_STORAGE_BUCKET || 'skyshare';
const objStorageEndpoint =
    process.env.OBJ_STORAGE_ENDPOINT || 'http://localhost:9000';
const objStorageCredential =
    process.env.OBJ_STORAGE_CREDENTIAL || 'minioadmin:minioadmin';

const objStorageViewURL = (
    process.env.OBJ_STORAGE_VIEW_URL || 'http://127.0.0.1:9000'
).replace(/(.+)\/$/, '$1');

export {
    launchEnv,
    atpService,
    dbEndpointWithCredential,
    objStorageBucket,
    objStorageRegion,
    objStorageEndpoint,
    objStorageCredential,
    objStorageViewURL,
};
