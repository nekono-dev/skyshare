import {
    objStorageBucket,
    objStorageCredential,
    objStorageEndpoint,
    objStorageRegion,
    objStorageViewURL,
} from '../common/environments.js';
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';

type UploadParams = {
    key: string;
    body: Buffer;
    contentType?: string;
    forcePathStyle?: boolean;
};

class S3ClientWrapper {
    private bucket: string;
    private viewUrl: string;
    private client: S3Client;

    constructor(
        opt: {
            bucket: string;
            viewUrl: string;
            endpoint: string;
            region: string;
            credential: string;
        } = {
            bucket: objStorageBucket,
            viewUrl: objStorageViewURL,
            endpoint: objStorageEndpoint,
            region: objStorageRegion,
            credential: objStorageCredential,
        },
    ) {
        this.bucket = opt.bucket;
        this.viewUrl = opt.viewUrl;

        const region = opt.region;
        const endpoint = opt.endpoint;
        const accessKeyId = opt.credential.split(':')[0];
        const secretAccessKey = opt.credential.split(':')[1];

        this.client = new S3Client({
            region,
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: true,
        } as any);
    }

    public async uploadToS3(params: UploadParams): Promise<string> {
        const { key, body, contentType } = params;

        const cmd = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        });

        await this.client.send(cmd);
        return new URL(`${this.viewUrl}/${key}`).toString();
    }

    public async deleteFromS3(key: string): Promise<void> {
        const cmd = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        await this.client.send(cmd);
    }
}

export { S3ClientWrapper };
