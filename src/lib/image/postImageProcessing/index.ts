/**
 * postImageProcessing の公開の入口。分割後の各ファイルから、元の公開の名前だけを再エクスポートする（元の import パスを保つ）。
 *
 * 内部の定数・ヘルパー（圧縮の予算・CanvasRenderer など）はここからは出さない。
 */
export type { CropArea, SlotCropState, SlotDef } from "./geometry"
export {
    TARGET_WIDTH,
    TARGET_HEIGHT,
    getSlotDefs,
    computeInitialCrop,
    computeCropAroundCenter,
} from "./geometry"
export { loadImage, loadImageSize } from "./source"
export { canUsePostImageAsIs } from "./encode"
export type { CompositeOverlay } from "./compose"
export {
    createOgpThumbnailFromBlob,
    createProcessedImages,
    createCroppedThumbnail,
    createDefaultThumbnail,
} from "./compose"
