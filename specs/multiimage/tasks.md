# 複数画像（5枚以上）添付 タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[FE]` フロントエンド / `[BE]` バックエンド / `[TEST]` テスト

## Phase 1: 前提の更新と定数

- [x] `atproto` サブモジュールを `@atproto/lexicon@0.7.16`（`a7c8604d8`）に合わせ、`.gitmodules` の `branch` を同タグへ更新する（design.md §2。`branch` の更新は完了済み）。
- [x] `package.json` の `@atproto/api` を `^0.23.0` へ更新し、`npm install` 後に `tsc` が通ることを確認する。
- [x] `src/lib/image/postImageLimits.ts` を新設し、`MAX_POST_IMAGES`/`MAX_IMAGES_EMBED`/`VISUAL_IMAGE_COUNT` を定義する（design.md §3）。
- [x] 検証: `npx tsc --noEmit` と既存 `vitest` が通る。

## Phase 2: バックエンド

- [x] `[BE]` `src/lib/api/schema/v2/entry/post.ts` の `images`/`imagesMeta` に `.max(MAX_POST_IMAGES)` を付与し、`npm run codegen` を実行する（design.md §4.1）。
- [x] `[BE]` `src/lib/atproto/embed.ts` の `createImageEmbed` を枚数分岐（images/gallery）にし、`validateImageMetadata` に上限検証を追加する（§4.2）。
- [x] `[BE]` `src/lib/entry/entry.ts` に `extractEmbedImages` を実装し、`extractSourceImages`・`posts.ts` の `extractTimelinePostImages` をその呼び出しに置き換える（§4.4）。
- [x] `[TEST]` `tests/lib/atproto/embed.test.ts`: 4枚→images、5・10枚→gallery（`$type`、alt、aspectRatio、順序）、11枚で throw。
- [x] `[TEST]` `tests/lib/entry/posts.test.ts`・`tests/lib/entry/entry.test.ts`: images/gallery 両方の抽出、未知 `$type` の除外。
- [x] `[TEST]` `tests/lib/api/schema/entryPost.test.ts`: 10枚成功・11枚失敗。
- [x] `[TEST]` `tests/pages/v2/entry.test.ts`: 5枚投稿の embed が gallery、4枚が images、11枚が400。
- [x] 検証: 上記テストと `npm run codegen` 後の `tsc` が通る。

## Phase 3: 画像処理（visual は先頭4枚）

- [x] `[FE]` `postImageProcessing.ts` の `createProcessedImages` を全画像の `originalBlobs` + 先頭4枚の `thumbnailBlob` に変更する（design.md §5.1）。`getSlotDefs` 等のリテラル `4` を `VISUAL_IMAGE_COUNT` に置換する。
- [x] `[TEST]` `tests/lib/image/postImageProcessing.test.ts`: 5枚入力で `originalBlobs` が5件、`composeThumbnailBlob` に渡る URL・cropState が先頭4件、6枚目以降を差し替えても `thumbnailBlob` が不変。
- [x] 検証: 上記テストが通る。

## Phase 4: 投稿フォームUI

- [x] `[FE]` `ImagePicker` の上限を `MAX_POST_IMAGES` に変更し、idx ≥ 4 の `def` 未定義ガード、超過通知、「Visual対象外」ラベルを実装する（design.md §5.2）。`index.module.css` に `slot-excluded-badge` を追加。
- [x] `[FE]` `ImageCropDialog` に先頭4枚のみ渡し、確定結果を先頭4スロットへのみ反映する（§5.3）。
- [x] `[FE]` `submitThread.ts` が5枚以上でも全画像を `images` に載せ、visual が先頭4枚由来であることを確認する（§5.4、コード変更が不要なら確認のみ）。
- [x] `[TEST]` Playwright（`tests/e2e/multiImage.spec.ts`）:
  1. 投稿フォームで11枚のファイルを選択 → プレビューが10枚、上限超過の通知が表示される。
  2. 5枚追加 → 5枚目のプレビューに「Visual対象外」ラベルがあり、1〜4枚目には無い。
  3. クロップ調整ダイアログを開く → クロップ領域が4つだけ表示される。
  4. 1枚目を削除 → 旧5枚目のラベルが消え、旧6枚目（存在すれば）にラベルが付く。
  5. `/v2/entry` をモックし、送信FormDataの `images` が追加枚数と一致し、`visual` が1つであること。
- [ ] 手動確認（実アカウントが必要なため自動化不可）: 5枚で投稿し、Bluesky公式アプリで gallery として表示されること、entry の visual が先頭4枚であること。

## Phase 5: 既存投稿の表示・entry事後作成

- [x] `[FE]` `useSkyshareEntryStatus.ts` で取得対象を先頭4枚に限定する（design.md §5.5）。
- [x] `[FE]` `PostCard` のフォールバックサムネイルを先頭4枚＋`+N`にし、`index.module.css` に `thumbnail-more` を追加する（§5.6）。
- [x] `[FE]` `guestDummyPosts.ts` に5枚以上の画像を持つ投稿のフィクスチャを追加する。
- [x] `[FE]` `EntryDetailView`/`EntryThreadView` が10枚をそのまま描画できることを確認し、不足があれば修正する（§5.7）。
- [x] `[TEST]` Playwright（`tests/e2e/multiImage.spec.ts`に追記、`/?guest`）: 5枚以上のフィクスチャ投稿のカードに先頭4枚のサムネイルと `+N` が表示される。（ゲスト表示では事後entry作成ボタンが無効のため、`GET /v2/bsky/images` の取得枚数の検証はE2E対象外。）
- [x] 検証: `tsc`・`vitest`・Playwright が全て通る。
