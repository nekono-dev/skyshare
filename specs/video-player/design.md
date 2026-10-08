# 動画の表示と再生 設計書

## 1. 構成

| パス                                              | 責務                                              |
| ------------------------------------------------- | ------------------------------------------------- |
| `src/lib/entry/entry.ts`                          | 投稿の埋め込みからの動画の抽出と再生URLの組み立て |
| `src/lib/entry/posts.ts`                          | タイムラインの投稿への動画の付与                  |
| `src/components/video/VideoPlayer/index.tsx`      | entry詳細ページの再生                             |
| `src/components/video/VideoThumbnail/index.tsx`   | タイムラインの静的な表示                          |
| `src/components/video/VideoPlayButton/index.tsx`  | 再生ボタンの見た目                                |
| `src/components/video/VideoUnavailable/index.tsx` | 再生できない動画の表示                            |
| `src/components/post/PostBody/index.tsx`          | 動画・再生できない動画・画像の表示の切り替え      |

## 2. 設計項目

### D-1: 動画の抽出 (FR-7, FR-8, FR-9, FR-10)

```ts
export type SourceVideo = { cid: string; playlistUrl: string; thumbnailUrl: string; alt: string
                            aspectRatio?: { width: number; height: number } }
export const buildVideoUrls = (repoDid: string, cid: string) => ({
  playlistUrl: `${VIDEO_WATCH_BASE_URL}${encodeURIComponent(repoDid)}/${cid}/playlist.m3u8`,
  thumbnailUrl: `${VIDEO_WATCH_BASE_URL}${encodeURIComponent(repoDid)}/${cid}/thumbnail.jpg`,
})
export const extractEmbedVideo = (embed, repoDid): SourceVideo | undefined // app.bsky.embed.video のみ
export const extractUnsupportedEmbedVideo = (embed, repoDid): SourceVideo | undefined // recordWithMedia の media が video
```

- 再生URLは投稿レコードの埋め込みから組み立て、AppViewの表示用データに依存しない。投稿の直後にAppViewへ反映されていない期間があるため。
- `TimelinePost` と `EntryPostView` に `video` と `unsupportedVideo` を持たせる。埋め込みは1種類のため、両方が同時に設定されることはない。
- ゲスト表示のダミー投稿とサンプルページに動画の投稿を1件ずつ置く。

### D-2: 表示の切り替え (FR-1, FR-4, FR-6)

```tsx
{video ? (videoInteractive ? <VideoPlayer video={video} postUrl={postUrl} /> : <VideoThumbnail video={video} />)
 : unsupportedVideo ? <VideoUnavailable video={unsupportedVideo} postUrl={unsupportedVideoLinkUrl} />
 : images.length > 0 ? <ImageGallery ... /> : null}
```

- タイムラインは `videoInteractive={false}`、entry詳細ページは既定の `true` を渡す。タイムラインでentryを持つ投稿は代表画像だけを表示し、動画は渡さない。
- コンテナは `aspect-ratio` を動画の比（無ければ16/9）にする。
- `VideoPlayButton` は `VIDEO_OVERLAY_SPEC` を参照し、直径59pxの `rgba(50, 50, 50, 0.6)` の円に `<polygon points="0,0 0,25 20,12.5" fill="#fff">` を中心から右へ2.5pxずらして重ねる。

### D-3: 再生 (FR-2, FR-3, FR-5, NFR-1, NFR-2)

```
初期: <button aria-label={t("video.play")}> に poster の <img> と VideoPlayButton を重ねる。<video> は作らない
start():
  videoEl = <video controls playsInline poster={thumbnailUrl}>
  const { default: Hls } = await import("hls.js")
  if Hls.isSupported(): hls.loadSource(playlistUrl); hls.attachMedia(videoEl); 致命的なエラーで setError()
  else if videoEl.canPlayType("application/vnd.apple.mpegurl"): videoEl.src = playlistUrl // iOS Safari
  else: setError()
  videoEl の error イベントでも setError()、await videoEl.play()
unmount: hls?.destroy()
エラー: t("video.playError") と postUrl への外部リンク
```

Chromiumはネイティブの再生対応を報告することがあるため、分岐は `canPlayType` ではなく `Hls.isSupported()` を先に判定する。

### D-4: 再生できない動画 (FR-8)

| 要素     | 見た目                                                                         |
| -------- | ------------------------------------------------------------------------------ |
| poster   | `filter: brightness(0.35)` と `rgba(0,0,0,0.45)` の面                          |
| 文言     | `t("video.unavailable.title")`（白・太字）                                     |
| リンク   | `postUrl` があるときだけ `t("video.unavailable.link")`（白・下線・新しいタブ） |
| 操作要素 | 再生ボタンと `<button>` を置かない                                             |

## 3. エラー処理

| 事象                           | 処理                                        |
| ------------------------------ | ------------------------------------------- |
| プレイリストの取得・再生の失敗 | 失敗の文言とBlueskyへのリンクを表示する     |
| 自動再生のブロック             | `controls` から利用者が再生できる状態にする |
