import type { Area } from "react-easy-crop"

export type SlotCropState = {
    crop: { x: number; y: number }
    zoom: number
    cropPixels: Area | null
}

export type SlotDef = {
    x: number
    y: number
    w: number
    h: number
    aspect: number
}

export const TARGET_WIDTH = 1200
export const TARGET_HEIGHT = 630
const MAX_SIDE = 4096
const MAX_BYTES = 1024 * 1024

export const loadImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () =>
            reject(new Error("画像の読み込みに失敗しました。"))
        image.src = url
    })

export const loadImageSize = async (url: string) => {
    const image = await loadImage(url)
    return { width: image.naturalWidth, height: image.naturalHeight }
}

export const getSlotDefs = (count: number): SlotDef[] => {
    if (count <= 1) {
        return [
            {
                x: 0,
                y: 0,
                w: TARGET_WIDTH,
                h: TARGET_HEIGHT,
                aspect: TARGET_WIDTH / TARGET_HEIGHT,
            },
        ]
    }

    if (count === 2) {
        return [
            {
                x: 0,
                y: 0,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT,
                aspect: TARGET_WIDTH / 2 / TARGET_HEIGHT,
            },
            {
                x: TARGET_WIDTH / 2,
                y: 0,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT,
                aspect: TARGET_WIDTH / 2 / TARGET_HEIGHT,
            },
        ]
    }

    if (count === 3) {
        return [
            {
                x: 0,
                y: 0,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT,
                aspect: TARGET_WIDTH / 2 / TARGET_HEIGHT,
            },
            {
                x: TARGET_WIDTH / 2,
                y: 0,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT / 2,
                aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
            },
            {
                x: TARGET_WIDTH / 2,
                y: TARGET_HEIGHT / 2,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT / 2,
                aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
            },
        ]
    }

    return [
        {
            x: 0,
            y: 0,
            w: TARGET_WIDTH / 2,
            h: TARGET_HEIGHT / 2,
            aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
        },
        {
            x: TARGET_WIDTH / 2,
            y: 0,
            w: TARGET_WIDTH / 2,
            h: TARGET_HEIGHT / 2,
            aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
        },
        {
            x: 0,
            y: TARGET_HEIGHT / 2,
            w: TARGET_WIDTH / 2,
            h: TARGET_HEIGHT / 2,
            aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
        },
        {
            x: TARGET_WIDTH / 2,
            y: TARGET_HEIGHT / 2,
            w: TARGET_WIDTH / 2,
            h: TARGET_HEIGHT / 2,
            aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
        },
    ]
}

export const computeInitialCrop = (
    naturalWidth: number,
    naturalHeight: number,
    targetWidth: number,
    targetHeight: number,
): Area => {
    return computeCropAroundCenter(
        naturalWidth,
        naturalHeight,
        targetWidth,
        targetHeight,
    )
}

export const computeCropAroundCenter = (
    naturalWidth: number,
    naturalHeight: number,
    targetWidth: number,
    targetHeight: number,
    centerX: number = naturalWidth / 2,
    centerY: number = naturalHeight / 2,
): Area => {
    const targetAspect = targetWidth / targetHeight
    const sourceAspect = naturalWidth / naturalHeight

    let width = naturalWidth
    let height = naturalHeight

    if (sourceAspect > targetAspect) {
        height = naturalHeight
        width = Math.round(targetAspect * height)
    } else {
        width = naturalWidth
        height = Math.round(width / targetAspect)
    }

    const clampedCenterX = Math.min(
        Math.max(centerX, width / 2),
        naturalWidth - width / 2,
    )
    const clampedCenterY = Math.min(
        Math.max(centerY, height / 2),
        naturalHeight - height / 2,
    )

    return {
        x: Math.round(clampedCenterX - width / 2),
        y: Math.round(clampedCenterY - height / 2),
        width,
        height,
    }
}

const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number) =>
    new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (!blob) {
                    reject(new Error("画像の変換に失敗しました。"))
                    return
                }
                resolve(blob)
            },
            "image/jpeg",
            quality,
        )
    })

const resizeCanvas = (
    source: HTMLCanvasElement,
    width: number,
    height: number,
) => {
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const context = canvas.getContext("2d")

    if (!context) {
        throw new Error("キャンバスの初期化に失敗しました。")
    }

    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas
}

export const compressToJpegUnder1MB = async (
    sourceCanvas: HTMLCanvasElement,
) => {
    let canvas = sourceCanvas

    while (true) {
        let quality = 0.92
        let blob = await canvasToJpegBlob(canvas, quality)

        while (blob.size > MAX_BYTES && quality > 0.05) {
            quality = Math.max(0.05, quality - 0.05)
            blob = await canvasToJpegBlob(canvas, quality)
        }

        if (blob.size <= MAX_BYTES) {
            return blob
        }

        if (Math.max(canvas.width, canvas.height) <= 512) {
            return blob
        }

        const ratio = Math.sqrt(MAX_BYTES / blob.size) * 0.95
        const scale = Math.min(0.95, Math.max(0.5, ratio))
        canvas = resizeCanvas(
            canvas,
            canvas.width * scale,
            canvas.height * scale,
        )
    }
}

export const createResizedCanvas = (image: HTMLImageElement) => {
    const maxLength = Math.max(image.naturalWidth, image.naturalHeight)
    const ratio = maxLength > MAX_SIDE ? MAX_SIDE / maxLength : 1
    const width = Math.round(image.naturalWidth * ratio)
    const height = Math.round(image.naturalHeight * ratio)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")

    if (!context) {
        throw new Error("キャンバスの初期化に失敗しました。")
    }

    context.drawImage(image, 0, 0, width, height)
    return canvas
}

export const createProcessedImages = async (
    imageUrls: string[],
    cropStates: SlotCropState[],
) => {
    const slotDefs = getSlotDefs(Math.min(4, Math.max(1, imageUrls.length)))
    const images = await Promise.all(
        imageUrls.slice(0, slotDefs.length).map(loadImage),
    )

    const composite = document.createElement("canvas")
    composite.width = TARGET_WIDTH
    composite.height = TARGET_HEIGHT
    const context = composite.getContext("2d")

    if (!context) {
        throw new Error("キャンバスの初期化に失敗しました。")
    }

    for (let index = 0; index < slotDefs.length; index += 1) {
        const slotDef = slotDefs[index]
        const crop = cropStates[index]?.cropPixels
        const image = images[index]

        if (!crop || !image) {
            throw new Error("画像の切り抜き範囲が不正です。")
        }

        context.drawImage(
            image,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            slotDef.x,
            slotDef.y,
            slotDef.w,
            slotDef.h,
        )
    }

    const thumbnailBlob = await compressToJpegUnder1MB(composite)
    const originalBlobs = await Promise.all(
        images.map(async image =>
            compressToJpegUnder1MB(createResizedCanvas(image)),
        ),
    )

    return { originalBlobs, thumbnailBlob }
}
