/**
 * 対応しているintent種別
 */
export type intentKinds = "xcom" | "taittsuu"

/**
 * intentを呼び出すために最低限必要な情報プリセット
 * @param intent.url intentの呼び出しURL
 * @param intent.hardware intent呼び出しURLが有効なハードウェア
 */
export type intentPreset = {
    hardware: string
    url: string
}

/**
 * PopupPreviewFormが要求するオプション
 * @param mediaObjectURL OGP画像、またはOGP画像のObjectURL
 * @param postText ポスト内容
 */
export type popupPreviewOptions = {
    mediaObjectURL: string | undefined
    ogpTitle: string | undefined
    postText: string
}

/**
 * Popupに必要なオプション
 * @param kind popupアプリケーション識別子
 * @param postText ポスト内容
 */
export type popupOptions = {
    kind: intentKinds
    postText: string
}
