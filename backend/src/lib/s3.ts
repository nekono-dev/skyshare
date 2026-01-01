import {
    objStorageBucket,
    objStorageCredential,
    objStorageEndpoint,
    objStorageRegion,
    objStorageViewURL,
} from '../common/environments.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

type UploadParams = {
    key: string;
    body: Buffer;
    contentType?: string;
    forcePathStyle?: boolean;
};

export const uploadToS3 = async (params: UploadParams): Promise<string> => {
    const { key, body, contentType, forcePathStyle = true } = params;

    const bucket = objStorageBucket;
    const region = objStorageRegion;
    const endpoint = objStorageEndpoint;
    const accessKeyId = objStorageCredential.split(':')[0];
    const secretAccessKey = objStorageCredential.split(':')[1];

    const client = new S3Client({
        region,
        endpoint,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        forcePathStyle,
    });

    const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
    });

    await client.send(cmd);
    return new URL(`${objStorageViewURL}/${key}`).toString();
};

export default uploadToS3;
