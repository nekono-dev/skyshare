import sharp from 'sharp';

/**
 * OPGの合成する
 *
 * @param {Array<Buffer>} 合成するイメージのarray 4枚まで対応。
 */
const compositeImages = async (images: Array<Buffer>): Promise<Buffer> => {
    const margin_half = 5;
    const ogp_size = {
        width: 1200,
        height: 630,
    };
    const ogp: sharp.Sharp = sharp({
        create: {
            background: { alpha: 1, b: 255, g: 255, r: 255 } as sharp.Color,
            channels: 4,
            width: ogp_size.width,
            height: ogp_size.height,
        },
    });
    let result: sharp.Sharp | null = null;
    let compositeImgs: Array<sharp.Sharp> = [];
    let compositeOptions: Array<{
        input: Buffer;
        top?: number;
        left?: number;
    }> = [];
    images.forEach((value) => {
        compositeImgs.push(sharp(value));
    });
    if (compositeImgs.length > 4) {
        throw new Error('Cannot composite more than 4 images');
    }
    for (let index = 0; index < compositeImgs.length; index++) {
        let height: number = ogp_size.height;
        let width: number = ogp_size.width;
        let top: number = 0;
        let left: number = 0;

        // indexが奇数の場合必ず 右側にある
        if (index % 2 === 1) {
            left = ogp_size.width / 2 + margin_half;
        }
        // indexが2以上の場合必ず 下にある
        if (index >= 2) {
            top = ogp_size.height / 2 + margin_half;
        }
        // 画像が2枚以上ある場合必ず 横幅は半分
        if (compositeImgs.length >= 2) {
            width = ogp_size.width / 2 - margin_half;
        }
        // 画像が3枚以上ある場合は必ず 縦幅は半分
        if (compositeImgs.length >= 3) {
            height = ogp_size.height / 2 - margin_half;
        }
        // 3枚のみ例外的な処理を実施
        if (compositeImgs.length === 3) {
            // 1枚目は大きく表示
            if (index === 0) {
                height = ogp_size.height;
            }
            // 2枚目以降は高さ半分
            if (index >= 1) {
                height = ogp_size.height / 2 - margin_half;
            }
            // 3枚目の横位置は右側である
            if (index === 2) {
                left = ogp_size.width / 2 + margin_half;
            }
        }

        compositeOptions.push({
            input: await compositeImgs[index]
                .resize(width, height, { fit: 'cover' })
                .toBuffer(),
            top: top,
            left: left,
        });
    }
    result = ogp.composite(compositeOptions);
    result = result.jpeg({
        quality: 80,
        progressive: true,
        mozjpeg: true,
    });
    return await result.toBuffer();
};

export { compositeImages };
