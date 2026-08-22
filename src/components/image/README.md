# image

画像添付・クロップ・OGPプレビューまわりの部品。`post`カテゴリ(`PostForm`)から利用される。

```mermaid
graph TD
  ImagePicker --> ImageCropDialog
  ImageCropDialog --> CropSlot
  ImagePreview -. type only .-> ImagePicker
  OgpPreview -. type only .-> OgpFetchButton

  ImageCropDialog --> commonExt
  ImagePicker --> commonExt

  commonExt["common (外部)"]

  classDef external stroke-dasharray: 4 3,fill:transparent;
  class commonExt external;
```

外部カテゴリへの依存の内訳: `common`: ImageCropDialog(Overlay・Loading)、ImagePicker(Loading)
