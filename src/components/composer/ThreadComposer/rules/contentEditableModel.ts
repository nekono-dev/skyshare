/**
 * 投稿本文のcontenteditableの平文モデルを再エクスポートする入口。
 *
 * 実体は次の3ファイルに分かれる。呼び出し側は、このパスを参照する。
 * - `contentEditableModelParts.ts`: 純粋な平文モデル（TextPart・CARET_ANCHOR・組み立てと解決）
 * - `contentEditableModelDom.ts`: DOM の走査・平文の抽出・選択・キャレット
 * - `contentEditableModelEdit.ts`: 削除の判定・画素位置の測定
 */

export type { TextPart } from "./contentEditableModelParts"
export {
    CARET_ANCHOR,
    partsToPlainText,
    resolvePartOffset,
} from "./contentEditableModelParts"
export {
    extractPlainText,
    resolveIndexToNodeOffset,
    getPlainTextSelection,
    setPlainTextCaret,
    findCaretAnchorNode,
} from "./contentEditableModelDom"
export {
    resolveAnchorAwareDeleteText,
    measureIndexPixelPosition,
} from "./contentEditableModelEdit"
