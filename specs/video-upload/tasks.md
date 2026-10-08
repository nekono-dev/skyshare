# 動画のアップロード タスク一覧

## Phase 1: トークン

- 対応: D-1
- [x] T-1.1: `videoAuth.ts` とトークン発行のハンドラ・スキーマを実装し、テストを追加する。
- 検証: `npx vitest run tests/lib/atproto/videoAuth.test.ts tests/pages/v2/bsky/video/uploadToken.test.ts`

## Phase 2: アップロード

- 対応: D-2, D-3
- [x] T-2.1: `videoUploader.ts`・`videoUploadToken.ts`・`videoErrors.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/video/videoUploader.test.ts tests/lib/video/videoErrors.test.ts`

## Phase 3: 投稿への埋め込み

- 対応: D-4
- [x] T-3.1: 投稿のスキーマに動画の分岐を追加し、`createVideoEmbed` をハンドラで使う。
- [x] T-3.2: 動画の投稿のハンドラテストを追加する。
- 検証: `npx vitest run tests/pages/v2/entry.test.ts tests/lib/atproto/embed.test.ts`
