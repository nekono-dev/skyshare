# 動画投稿 タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[FE]` フロントエンド / `[BE]` バックエンド / `[TEST]` テスト

## Phase 1: 前提・定数・テスト資材

- [x] `hls.js` を `package.json` の dependencies に追加し、`npm install` 後に `tsc` が通ることを確認する（design.md §7.1）。
- [x] `src/lib/video/postVideoLimits.ts` を新設し、定数（`MAX_VIDEO_BYTES` ほか design.md §3 の全定数）を定義する。他モジュールを import しない。
- [x] `tests/fixtures/video-sample.mp4`（約80KB、H.264+AAC、5秒、640x360）を生成して配置する。
- [x] `tests/fixtures/video-solid.mp4`（単色 `rgb(97,95,168)` の無地、H.264、5秒、640x360）、`video-solid-square.mp4`（同色、480x480）、`video-solid-portrait.mp4`（同色、360x640）を生成して配置する（visual の色・位置検証用）。
- [x] 検証: `npx tsc --noEmit` と既存 `vitest` が通る。

## Phase 2: トークン発行 API

- [x] `[BE]` `src/lib/api/schema/v2/bsky/video/upload-token/post.ts` を作成する（design.md §4.1。`ResponseBody200Schema`・`operation`・`Common.errorResponses(["400","401","429","500"])`）。
- [x] `[BE]` `src/lib/atproto/videoAuth.ts` に `isSupportedVideoPds`・`createVideoUploadToken` を実装する（`readPdsServiceFromDidDoc`/`resolvePdsServiceForDid` を再利用）。
- [x] `[BE]` `src/pages/v2/bsky/video/upload-token.ts` を作成する（401/400/500 の分岐、`Cache-Control: no-store`、トークンをログに出さない）。
- [x] `[BE]` `npm run codegen` を実行し、`src/client/openapi/` を再生成する。
- [x] `[TEST]` `tests/lib/atproto/videoAuth.test.ts`: `isSupportedVideoPds`（`bsky.social`・`xxx.host.bsky.network` が true、独自ドメイン・`evilbsky.social`・`host.bsky.network.example.com` が false）、`createVideoUploadToken` が `aud=did:web:<PDSホスト>`・`lxm=com.atproto.repo.uploadBlob`・`exp=now+1800` で `getServiceAuth` を呼ぶこと、PDS 未解決・`getServiceAuth` 失敗で 500、対応外PDSで 400。
- [x] `[TEST]` `tests/pages/v2/bsky/video/uploadToken.test.ts`: 未認証 401、対応PDS 200（`no-store`）、対応外 400。
- [x] 検証: 上記テストと `npm run codegen` 後の `tsc` が通る。

## Phase 3: 投稿作成 API（動画 embed）

- [x] `[BE]` `src/lib/api/schema/common.ts` に `CommonVideoBlobSchema`・`CommonVideoMetaSchema` を追加する（design.md §4.2.1）。
- [x] `[BE]` `src/lib/api/schema/v2/entry/post.ts` に動画分岐を追加し、`PostItemFieldKinds` に `video`/`videoMeta` を追加する（§4.2.2）。`npm run codegen` を実行する。
- [x] `[BE]` `src/lib/atproto/embed.ts` に `createVideoEmbed` を追加する（§4.2.3）。
- [x] `[BE]` `src/pages/v2/entry.ts` の embed 作成を「動画 → 画像 → OGP」の順にし、冒頭ドキュメントコメントを更新する（§4.2.4）。
- [x] `[TEST]` `tests/lib/api/schema/entryPost.test.ts`: 動画のみ成功、`video` と `images`/`ogMeta` の併用が失敗、`size` が 300,000,001 で失敗、`mimeType` が `video/webm` で失敗、`videoMeta` 欠落で失敗。
- [x] `[TEST]` `tests/lib/atproto/embed.test.ts`: `createVideoEmbed` の `$type`・`video`・`alt`（未指定は `""`）・`aspectRatio`。
- [x] `[TEST]` `tests/pages/v2/entry.test.ts`: 動画投稿の multipart（`posts[0][video]`・`posts[0][videoMeta]` が JSON）で `app.bsky.embed.video` が作られ `uploadBlob` が呼ばれないこと、2セグメントのスレッドで各投稿に動画 embed が載ること、`createEntry`+`visual` で entry が作られること、画像併用が 400。
- [x] 検証: 上記テストと `npm run codegen` 後の `tsc` が通る。

## Phase 4: 動画投稿の抽出（表示用データ）

- [x] `[BE]` `src/lib/entry/entry.ts` に `SourceVideo`・`buildVideoUrls`・`extractEmbedVideo` を実装する（design.md §4.3）。
- [x] `[BE]` `src/lib/entry/entry.ts` に `extractUnsupportedEmbedVideo` を実装する（design.md §4.3「利用不可の動画の抽出」）。
- [x] `[BE]` `src/lib/entry/posts.ts` の `TimelinePost` に `video?: SourceVideo`・`unsupportedVideo?: SourceVideo` を追加し、変換処理で設定する。`hasEntryMedia`（`unsupportedVideo` を含めない）を追加する。
- [x] `[BE]` `src/pages/entries/[slug].astro` の `toEntryPostView` と `EntryDetailView/index.astro` の `EntryPostView` に `video`・`unsupportedVideo` を追加する。
- [x] `[TEST]` `tests/lib/entry/entry.test.ts`: `extractEmbedVideo`（動画 embed で URL・alt・aspectRatio、画像 embed・`recordWithMedia`・blob の CID 不正で `undefined`、DID の `:` が `%3A` にエンコードされること）。
- [x] `[TEST]` `tests/lib/entry/entry.test.ts`: `extractUnsupportedEmbedVideo`（`recordWithMedia` の `media` が動画のとき poster URL が得られる、`media` が画像・直接の動画 embed・media なしでは `undefined`）。
- [x] `[TEST]` `tests/lib/entry/posts.test.ts`: 動画投稿の `TimelinePost.video` と `images: []`、`recordWithMedia` 内動画の `unsupportedVideo`、`hasEntryMedia`（動画あり true、`unsupportedVideo` のみ false）。
- [x] 検証: 上記テストと `tsc` が通る。

## Phase 5: アップロードコア

- [x] `[FE]` `src/lib/video/probeVideo.ts` に `validateVideoFile`・`probeVideo` を実装する（design.md §5.1）。
- [x] `[FE]` `src/lib/video/videoUploadToken.ts` と `src/lib/video/videoUploader.ts`（`uploadVideo`・`VideoUploadError`・トークンキャッシュ）を実装する（§5.2・§5.3）。
- [x] `[FE]` `src/lib/video/videoOverlay.ts` に `VIDEO_OVERLAY_SPEC`・`formatVideoDuration`・`drawVideoOverlay` を実装する（design.md §6.5）。
- [x] `[FE]` `src/lib/image/postImageProcessing.ts` の `composeThumbnailBlob`・`createDefaultThumbnail` に任意の `overlay` 引数を追加する（§6.5.3。既存呼び出しの挙動は不変）。
- [x] `[FE]` `src/lib/video/fetchVideoDuration.ts` に `fetchVideoDurationSec` を実装する（§7.5）。
- [x] `[FE]` `src/lib/video/videoErrors.ts`（`mapVideoError`、§5.4 の対応表）と、`src/lib/i18n/messages/{ja,en}/video.ts` の `video.error.*` を追加し `index.ts` に登録する。
- [x] `[TEST]` `tests/lib/video/probeVideo.test.ts`: 形式・サイズ違反、`duration` 601秒で `tooLong`、`duration` が `NaN`/寸法0で `unreadable`、正常時に poster Blob が JPEG で返ること。
- [x] `[TEST]` `tests/lib/video/videoUploader.test.ts`（`fetch` をフェイク）:
  1. 正常系: 12MB → 3パートが順番に送られ（`partNumber` と `Content-Length` が一致）、`finishUpload` 後に `COMPLETED` で blob を返す。進捗が `uploading` 0→100、`processing` を経て通知される。
  2. `startUpload` のボディに `sizeBytes`/`mimeType`/`durationMs`/`width`/`height` が含まれる。
  3. パートが 503 → リトライして成功。4回連続失敗で `network` 系エラー。400 は再試行しない。
  4. `startUpload` の `VideoTooLarge`/`BadAspectRatio`/`DailyLimitExceeded`/`UploadForbidden`/`TooManyOpenUploads`/`ServiceOverloaded` が対応する `VideoUploadErrorCode` になる。
  5. `JOB_STATE_FAILED` → `processingFailed`、ポーリング超過 → `timeout`（フェイクタイマー）。
  6. `expiresAt` が残り5分未満のとき、次のリクエストの前に `fetchToken` が再度呼ばれる。
  7. `uploadPart` 中に `abort` → `abortUpload` が1回呼ばれ `AbortError`。`finishUpload` 後の `abort` では `abortUpload` は呼ばれない。
  8. トークン文字列が `console.*` に出力されない。
- [x] `[TEST]` `tests/lib/video/videoOverlay.test.ts`: `formatVideoDuration`（5→`0:05`、59.6→`1:00`、0→`0:01`、600→`10:00`）、`VIDEO_OVERLAY_SPEC` が design.md §6.5.1 の表の値と一致する（値のスナップショット）、`drawVideoOverlay` が `scale=1` で円（直径 139.9）・三角・バッジの描画命令を §6.5.2 の寸法で発行する（`CanvasRenderingContext2D` のフェイクで座標を検査）。
- [x] `[TEST]` `tests/lib/image/postImageProcessing.test.ts`: `overlay` を渡すと各 `renderComposite` 呼び出しで `scale` 付きで1回呼ばれ、渡さなければ従来と出力が変わらない。
- [x] `[TEST]` `tests/lib/video/fetchVideoDuration.test.ts`: マスター → 最初のバリアント → `#EXTINF` 合計（例: 4.0+4.0+2.5 → 10.5）、バリアントが相対 URL の解決、マスター 404・バリアント 404・`#EXTINF` なしで throw。
- [x] `[TEST]` `tests/lib/video/videoErrors.test.ts`: §5.4 の全コードに対応するキーが存在し、ja・en の双方に定義されている。
- [x] 検証: 上記テストと `tsc` が通る。

## Phase 6: 投稿フォームUI

- [x] `[FE]` `ThreadComposer/segments.ts` に `VideoEntry`・`SegmentState.videoEntry`・`revokeVideoEntry` を追加し、`createEmptySegment` と segment 削除・unmount の解放処理に反映する（design.md §6.1）。
- [x] `[FE]` `src/images/video.svg`（ビデオカメラ風・色 `#0085ff`。§6.2 のSVG）を作成する。
- [x] `[FE]` `src/components/video/VideoPicker/index.tsx`・`index.module.css` を実装する（§6.2。画像追加ボタンと別個の動画専用ボタン、進捗バー・alt入力・取り外し・選び直し）。
- [x] `[FE]` `ThreadSegmentForm` のツールバーで `ImagePicker` の直後に `VideoPicker` を配置し、画像・OGP・動画の排他（`disabled` とツールチップ）を実装する（§6.1）。
- [x] `[FE]` `submitThread.ts` の `buildPostItem`・entry 作成候補・visual 選択を動画対応にする（§6.3）。
- [x] `[FE]` `ThreadComposer/index.tsx` と `spec.submitButton.md` の投稿ボタン無効条件に動画アップロード状態を加える。
- [x] `[FE]` `video.picker.*`・`video.status.*`・`video.submit.waitUpload` を ja/en に追加する。
- [x] `[TEST]` `tests/components/post/ThreadComposer/segments.test.ts` に追記: 動画 segment の投稿条件（完了した動画があればテキストなしで可、実行中・失敗は不可）、`pendingVideoState`/`hasPendingVideo`（実行中は `uploading`、失敗が残れば `error`、取り外しで解消）。`VideoPicker` の状態遷移（選択→進捗→完了、違反ファイルで添付されず通知、取り外しでの中断）は、vitest が Node 環境で React の描画を持たないため、下記の Playwright で検証する。
- [x] `[TEST]` 既存の `tests/components/post/ThreadComposer/submitThread.test.ts` に追記: 動画 segment の `posts[i]` に `video`/`videoMeta` が載り `images`/`ogMeta` が載らない、entry 作成候補が動画 segment になり `visual` が `thumbnailBlob` になる、`manualImageAttach` 有効時は `createEntry` が付かない。
- [x] `[TEST]` Playwright（`tests/e2e/videoComposer.spec.ts`。`video.bsky.app` と `/v2/bsky/video/upload-token`・`/v2/entry` を `page.route` でモック）:
  1. 投稿フォームで `video-sample.mp4` を選択 → poster プレビューと進捗バーが表示され、変換完了後に「完了」表示になり、投稿ボタンが有効になる。
  2. アップロード中（`getJobStatus` を保留）は投稿ボタンが無効で、理由が表示される。
  3. mp4 以外のファイル、301MB を模したファイル（`size` を偽装した `File`）を選択 → 動画は添付されず、`tooLarge`/`notMp4` の文言が表示される。
  4. 動画添付済みの segment で画像追加・OGP取得ボタンが無効、画像添付済みの segment で動画追加ボタンが無効。
  5. 動画を取り外す → プレビューが消え、画像・OGP ボタンが有効に戻る。アップロード中の取り外しで `abortUpload` が呼ばれる。
  6. `upload-token` を 400 でモック → 動画の送信が1回も行われず、`unsupportedPds` の文言が表示される。
  7〜9. （ゲスト表示は実際の投稿を行わないため、`submitThread.test.ts` の単体テストで検証する。投稿内容の `posts[i].video`/`videoMeta`（alt を含む）、2 segment での両方への `video`、`visual` が `thumbnailBlob` になること、動画のバイト列が送られないこと（blob 参照 JSON のみ）を確認する。実アカウントでの確認は手動確認の項に含む。）
  10. 動画の完了待ち（`getJobStatus` を保留）→ 投稿ボタンが無効で `video.submit.waitUpload` が表示される。完了後に有効になる。
  11. アップロード失敗（`startUpload` を `DailyLimitExceeded` でモック）→ 投稿ボタンが無効のまま `video.submit.removeFailed` が表示される。取り外すと有効になる。別の動画を選び直した場合も、完了するまで無効のまま。
  12. アップロード中に取り外す → 完了を待たず投稿ボタンが有効になる。
  13. ツールバーで動画追加ボタン（`aria-label` が `video.picker.addAria`）が、画像追加ボタンと別個の要素として画像追加ボタンの直後に並ぶ。動画追加ボタンの `<img>` が `video.svg` で、SVGの `fill` が `#0085ff` である。
- [x] `[TEST]` Playwright（`tests/e2e/videoVisual.spec.ts`。ページ内で本実装の `probeVideo`・`createDefaultThumbnail`・`drawVideoOverlay` を実行して visual を生成する（ゲスト表示は投稿を行わないため、dev サーバーのモジュールを動的 import して呼ぶ）。`createImageBitmap` と canvas で 1200×630 にデコードし画素をサンプリングする。許容誤差は design.md §6.5.1 のとおり色 ±6）:
  1. 画像サイズが 1200×630 である。
  2. 円の内側（`(555, 315)`）が `rgb(69,68,97)`（無地背景 `rgb(97,95,168)` の上の再生ボタンの円。`0.4×背景 + 30`）。
  3. 再生記号の内側（`(598, 315)`）が白 `rgb(255,255,255)` に近い（各チャンネル 245 以上）。
  4. 円の外側（`(300, 315)`・`(900, 315)`）が `rgb(97,95,168)`。
  5. バッジの左余白部（`(38, 578)`）が `rgb(19,19,34)`（背景に黒 α0.8 を重ねた値）。バッジ矩形（`x:28〜133, y:554〜602`）内に白に近い画素（各チャンネル 200 以上）が一定数（100 画素以上）ある。
  6. バッジの外側（`(300, 600)`・`(1100, 100)`）が `rgb(97,95,168)`。
  7. 再生時間が異なる（`durationSec` が 600 と 5）場合にバッジの幅が変わり（`10:00` の幅 > `0:05` の幅）、バッジ左端の位置は変わらない。
  8. 動画の縦横比によらず位置が同じである: `video-solid-square.mp4`（480×480）と `video-solid-portrait.mp4`（360×640）を選択して同じ検証（1〜6）を行い、円の中心・再生記号・バッジの位置と色がすべて `video-solid.mp4`（横長）の場合と一致する（円の内側 `(555, 315)`、再生記号 `(598, 315)`、バッジ余白 `(38, 578)`）。
- [ ] 手動確認（実アカウントが必要なため自動化不可）: 実際の mp4 を投稿し、Bluesky 公式アプリで動画として表示されること、`alt`・縦横比が保持されること、entry の visual が poster 由来で、中央の再生ボタンと左下の再生時間バッジが X 上のカードで、design.md §6.5.1 の値に沿った見た目になること（X のカードプレビューまたは Card Validator 相当で目視）。
- [x] 検証: `tsc`・`vitest`・上記 Playwright が通る。

## Phase 7: 表示（Timeline・Entry詳細・ゲスト）

- [ ] `[FE]` `src/components/video/VideoPlayButton/`（`VIDEO_OVERLAY_SPEC` を S=1 で使用、design.md §6.5.2）・`VideoPlayer/`・`VideoThumbnail/`・`VideoUnavailable/` を実装する（§7.1・§7.2・§7.7）。
- [ ] `[FE]` `PostBody` に `video`/`unsupportedVideo`/`unsupportedVideoLinkUrl`/`videoInteractive` を追加し、`EntryDetailView` から `video`・`unsupportedVideo`・`unsupportedVideoLinkUrl` を渡す（§7.3）。
- [ ] `[FE]` `PostCard` で動画投稿・利用不可の動画のとき `galleryImages=[]` にし、`videoInteractive={false}`・`unsupportedVideoLinkUrl={item.url}` を渡す。`entryCandidate.ts` の判定を `hasEntryMedia` に置き換える（§7.4）。
- [ ] `[FE]` `guestDummyPosts.ts` と `entries/sample*.astro` に動画投稿と、利用不可の動画（`unsupportedVideo`）を持つ投稿を追加する（§7.6・§7.7）。
- [ ] `[FE]` `video.play`・`video.playError`・`video.unavailable.*` を ja/en に追加する。
- [ ] `[TEST]` 既存の `tests/components/post/ThreadCard/entryCandidate.test.ts` に `resolveEntryVisualSourcePost` のケースを追記: ルートが動画投稿ならルート、ルートがメディア無しで reply が動画ならその reply、画像と動画が混在する場合はルートに近い方。
- [ ] `[TEST]` Playwright（`tests/e2e/videoDisplay.spec.ts`。`video.bsky.app` の playlist・セグメント・サムネイルを `page.route` でモック。サンプルEntryページと `/?guest`）:
  1. ゲストの Timeline: 動画投稿のカードに poster サムネイルと再生マークが表示され、`<video>` 要素が存在せず、グレーアウトされていない。サムネイルをクリックしても再生が始まらない。
  2. サンプルEntryページ: 初期状態で poster 画像と「再生」ボタンのみがあり、`<video>` 要素が無く、`playlist.m3u8`・セグメント・`hls.js` のリクエストが発生していない。
  3. 再生ボタンをクリック → `<video>` が表示され、`hls.js` と `playlist.m3u8` のリクエストが発生し、`<video>` の `readyState >= 2`（モックのセグメントを再生できる場合）またはエラー表示でない状態になる。
  4. `playlist.m3u8` を 404 でモック → 再生失敗の文言と Bluesky 投稿へのリンクが表示される。
  5. 再生ボタンにキーボード（Tab → Enter）で到達・操作できる。
  6. 再生の前後でコンテナの高さが変わらない（`aspect-ratio` による確保）。
  7. 画像のみの投稿・テキストのみの投稿の表示が変化しない（既存の `multiImage.spec.ts`・`entryPostCards.spec.ts` が通る）。
  8. 再生ボタンの円が直径 59px（`getBoundingClientRect`）で、背景色が `rgba(47, 47, 47, 0.78)`、内側の `<polygon>` が `fill="#fff"`・`points="0,0 0,25 20,12.5"`。Timeline のサムネイルと Entry 詳細の再生ボタンで同一の値である。
  9. ゲストの Timeline の利用不可の動画の投稿: poster が表示され（`filter: brightness` が適用されている）、「Skyshareでは再生できません」の文言と Bluesky へのリンク（`target=_blank`）が表示され、再生ボタンと `<button>` が無く、カードがグレーアウトされ、entry 作成ボタンが無効。
  10. サンプルEntryページの利用不可の動画: 同様に poster の暗表示・文言・リンクが表示され、再生ボタンが無い。
- [ ] 検証: `tsc`・`vitest`・上記および既存 Playwright が通る。

## Phase 8: 既存動画投稿からの entry 事後作成

- [ ] `[FE]` `useSkyshareEntryStatus.ts` の `hasImages` を `hasEntryMedia` に変更し、`visualSource.video` の poster 取得（`fetch(thumbnailUrl)` と `type` 補正）・`fetchVideoDurationSec`（並行）→ `createDefaultThumbnail([url], drawVideoOverlay(durationSec))` の経路を追加する（design.md §7.5）。
- [ ] `[TEST]` `tests/components/post/PostCard/useSkyshareEntryStatus.test.ts`（新規）: 動画投稿で `display.kind === "creatable"`、`createEntryFromPost` が `thumbnailUrl` と `playlist.m3u8` を `fetch` し `createDefaultThumbnail` に `overlay` が渡され `createEntry({ uri, visual })` を呼ぶ、`fetchVideoDurationSec` が throw したとき `createEntry` を呼ばず `createError="post.entry.createFailed"`、Blob の `type` が空でも `image/jpeg` で `createDefaultThumbnail` に渡る、`fetch` 失敗で `createError="post.entry.createFailed"`。
- [ ] `[TEST]` Playwright（`tests/e2e/videoDisplay.spec.ts` に追記。`/?guest` ではentry作成ボタンが無効のため、タイムラインAPIと `thumbnail.jpg`・`/v2/entry` をモックしたログイン状態で実施）: 動画投稿のカードに entry 作成ボタンが有効で表示され、押下すると `thumbnail.jpg`・`playlist.m3u8` の取得と `/v2/entry` の `uri`+`visual` 送信が行われる。`playlist.m3u8` を 404 でモックした場合は `/v2/entry` が呼ばれず、作成失敗の通知が表示される。送信された `visual` は `tests/e2e/videoVisual.spec.ts` と同じ方法で再生ボタンとバッジを検査する。
- [ ] 手動確認（実アカウント）: 既存の自分の動画投稿から entry を作成し、詳細ページで visual が poster 由来であること、動画が再生できること。
- [ ] 検証: `tsc`・`vitest`・Playwright が通る。

## Phase 9: 総合検証

- [ ] `[TEST]` `tests/lib/i18n/messages.test.ts`・`noHardcodedText.test.ts` が `video.*` を含めて通る（ja・en のキー集合の一致、ハードコード文言なし）。
- [ ] `[TEST]` 全 `vitest`・`tsc`・全 Playwright が通る。
- [ ] 手動確認（実アカウントが必要なため自動化不可）: 300MB 級の mp4 のアップロード所要時間と、トークン再発行（30分を超える低速回線を模擬するか、`VIDEO_UPLOAD_TOKEN_TTL_SEC` を一時的に短縮して確認）。10分超の動画で `tooLong`、変換失敗時（壊れた mp4）に `processingFailed` が表示されること。Safari（ネイティブHLS）と Firefox での再生。
- [ ] 積み残し（実装後の微調整）: 基準カード幅 `referenceCardWidth`（現在は仮置きの 506px）を、実装した visual を X のカード上で見比べて微調整する。調整した値は `VIDEO_OVERLAY_SPEC` と design.md §6.5.2 の換算表（S・各換算値）、本ファイルの visual 検証の期待座標へ反映する。
