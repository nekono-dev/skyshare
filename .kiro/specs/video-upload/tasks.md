# Implementation Plan

- [x] 1. トークン
- [x] 1.1 `videoAuth.ts` とトークン発行のハンドラ・スキーマを実装し、テストを追加する。
  - 検証: `npx vitest run tests/lib/atproto/videoAuth.test.ts tests/pages/v2/bsky/video/uploadToken.test.ts`
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. アップロード
- [x] 2.1 `videoUploader.ts`・`videoUploadToken.ts`・`videoErrors.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/video/videoUploader.test.ts tests/lib/video/videoErrors.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1_

- [x] 3. 投稿への埋め込み
- [x] 3.1 投稿のスキーマに動画の分岐を追加し、`createVideoEmbed` をハンドラで使う。
  - _Requirements: 4.1, 4.2, 4.3_
- [x] 3.2 動画の投稿のハンドラテストを追加する。
  - 検証: `npx vitest run tests/pages/v2/entry.test.ts tests/lib/atproto/embed.test.ts`
  - _Requirements: 4.1, 4.2, 4.3_
