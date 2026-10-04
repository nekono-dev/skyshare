# 投稿カード表示・画像拡大 タスク一覧

## Phase 1: 画像の縦横比とレイアウト判定（design.md §2.1・§3.1対応）

- [x] `SourceImage` に任意の `aspectRatio` を追加し、`toSourceImages` で正の有限数のときだけ詰める。
- [x] `src/lib/image/galleryLayout.ts` に `resolveGalleryLayout` と定数（`GRID_MAX_COUNT`・`SINGLE_RATIO_MIN`・`SINGLE_RATIO_MAX`）を実装する。
- [x] `[TEST]` `tests/lib/image/galleryLayout.test.ts`: 0枚で `null`、1枚で縦横比のクランプ（極端な縦長・横長・比率不明）、2〜4枚で `grid`、5枚以上で `strip` を返すこと。
- [x] `[TEST]` `tests/lib/entry/entry.test.ts`: `aspectRatio` が有効値のとき保持され、0・負数・非数・欠落のとき設定されないこと。既存の `{ url, alt, cid }` 期待値のテストが通ること。
- 完了確認: `npx vitest run tests/lib` と `npx tsc --noEmit` がエラーゼロ。

## Phase 2: 共通画像部品（design.md §3.1・§3.2対応）

- [x] `src/components/image/ImageLightbox/` を実装する（`Overlay` 利用、前後ボタン・矢印キー・スワイプ、alt・位置表示、フォーカス移動、先読み）。
- [x] `src/components/image/ImageGallery/` を実装する（grid 1〜4枚、strip 5枚以上、サムネイルボタン、閉じた際のフォーカス復帰）。
- [x] `src/components/image/README.md` の構成図と依存の内訳を更新する。
- [x] `[TEST]` Playwright（`tests/e2e/imageGallery.spec.ts`、新規。Phase 4 のサンプルページを使用）で以下を確認する。Phase 4 完了までは作成のみとし、Phase 4 で実行して完了とする。
  - 1・2・3・4枚の投稿で、サムネイルのコンテナの縦横比が design.md §3.1 の値になり、画像が `object-fit: cover` であること。
  - 5枚の投稿で、コンテナの高さが固定され、`scrollWidth > clientWidth`（横スクロール可能）で、各 `<img>` の幅/高さの比が `aspectRatio` と一致すること。
  - サムネイルをクリック → 拡大表示が開き、alt と「1/N」が表示される。ArrowRight で「2/N」になる。ArrowLeft で戻る。先頭で前ボタンが `disabled`。
  - 画像領域を左へスワイプ（pointer イベント）→ 次の画像になる。
  - 背景クリック、閉じるボタン、Esc のそれぞれで閉じ、フォーカスが開いたサムネイルへ戻る。
  - 拡大表示中に `window.scrollY` が変化しない（背面スクロールロック）。
  - 1枚の投稿では前後ボタンと位置表示が無い。

## Phase 3: PostBody と PostCard の置き換え（design.md §3.3・§3.4対応）

- [x] `src/components/post/PostBody/` を実装し、`PostCard` から author-block・本文・サムネイルのマークアップとCSSを移す。
- [x] `PostBody` に `imagesInteractive`・`engagement`、`ImageGallery` に `interactive`（false で静的表示）を実装する（Phase 2 の `ImageGallery` に `interactive` を含めてよい）。
- [x] `PostCard` を `PostBody` 利用へ置き換え、Entry を持つ投稿は visual 1枚を静的表示（1200×630 の比率で全体表示）、持たない投稿は元画像を拡大可能に表示する規則（design.md §3.4）を実装する。不要になった `VISUAL_IMAGE_COUNT` の import・サムネイル算出・CSSを削除する。
- [x] `src/components/post/README.md` の構成図と依存の内訳（`PostBody`・`image` への依存）を更新する。
- [x] `[TEST]` `tests/components/post` の既存テストを新構造に合わせて更新し、通ること。
- [x] `[TEST]` Playwright（`tests/e2e/timelineThread.spec.ts` に追記）で、ゲストモードの Timeline について次を確認する: Entry を持つ投稿（スレッドのルートを含む）に元画像ではなく visual が1枚表示され、クリックしても拡大表示が開かないこと／Entry を持たない複数画像投稿（スレッドの返信を含む）のサムネイルをクリックすると拡大表示が開き閉じられること／画像も Entry も持たない投稿に画像領域が無いこと／orphaned entry が visual を1枚表示すること。
- [x] `[TEST]` 既存の Timeline 操作の regression 確認として、`tests/e2e/entryDeleteDialog.spec.ts`・`tests/e2e/entryList.spec.ts` が通ること。
- 完了確認: 上記テストと `npx tsc --noEmit` がエラーゼロ。Timeline のカード高さは、このPhase完了後に実際の見た目を確認してから別途判断する。

## Phase 4: Entry詳細ページの置き換え（design.md §2.2・§3.5・§3.6対応）

- [x] `EntryPostView` 型と、`[slug].astro` での `posts`・`visualUrl`・`metaDescription` の組み立てを実装する（取得・ステータス判定ロジックは変更しない）。
- [x] `EntryDetailView` を新構成（ヘッダーカード＋投稿カード配列＋連結線）へ置き換え、`EntryThreadView` を削除する。ヘッダーカードの `PostEngagementStats` を削除し、各投稿カードが自身の `engagement` を表示する（design.md §2.2・§3.5）。
- [x] `EntryDetailView` の最後に `.page-footer`（下部余白、エラーペイン時を含む）を追加する。
- [x] `entries/sample.astro` を新Propsへ移行し、3投稿のスレッド表示・複数画像（1・3・5枚）のダミーデータに置き換える。`sample-orphaned.astro`・`sample-thread.astro`・`sample-error.astro` は設けない（サンプルページは `sample.astro` 1枚に集約）。
- [x] `src/components/entry/README.md` の構成図と依存の内訳を更新する。
- [x] `[TEST]` `tests/pages/v2/entry.test.ts` 等、`EntryDetailView`・`EntryThreadView` に依存する既存テストを更新し、通ること。
- [x] `[TEST]` Playwright `tests/e2e/entryThreadDetail.spec.ts` を更新し、`tests/e2e/entryPostCards.spec.ts`（新規）を追加して以下を確認する。
  - スレッドサンプル: 投稿カードが3つ、投稿順に縦に並び、カード間に連結線（`li::after`）が存在する。ヘッダーカードに「スレッド」バッジは無く、Entryのカード画像（`entry-visual`）がある。
  - スレッドサンプルの各投稿カードにそれぞれ異なるリアクション数が表示され、ヘッダーカードにはリアクション数が無い。orphaned サンプルにはリアクション数が表示されない。
  - `.page-footer` が存在し、最後の投稿カード下端からページ下端までの距離が 96px 以上である。
  - 各投稿カードの日時リンクが Bluesky ページを指し `target=_blank` である。
  - JavaScript 無効のコンテキストで、サムネイルの `<img>` が表示されている。
  - ビューポート幅 360px で `document.documentElement.scrollWidth <= clientWidth`（横スクロールなし）。
  - Phase 2 の `imageGallery.spec.ts` のシナリオをこのページ上で実行して通ること。
- [ ] 実アカウント・実PDS上の Entry での `[slug].astro` 本体の表示確認は自動化できないため、手動確認とする。手順: dev サーバで、画像付き単発投稿由来・スレッド由来・5枚以上画像の Entry の `/entries/<slug>` を開き、requirements.md §6 の受け入れ条件を目視で確認する。
- 完了確認: 上記テスト、`npx tsc --noEmit`、`npm run build` が成功する。

## Phase 6: 拡大表示のスワイプアニメーション（design.md §3.2対応）

- [x] `ImageLightbox` を、前後の画像を横に並べたスライド表示へ変更し、スワイプ中の指への追従・離したときのスナップ/復帰・端での抵抗を実装する。
- [x] `[TEST]` `tests/e2e/imageGallery.spec.ts` に以下を追加する。
  - ドラッグ途中（マウスを離す前）に、現在の画像が指の移動量だけ横にずれていること。
  - 閾値未満のドラッグで離すと、画像が元の位置に戻り「1/N」のままであること。
  - 先頭で右へスワイプしても切り替わらないこと。

## Phase 5: 仕上げ

- [x] `specs/entry/frontend`・`specs/timeline` の該当記述に本仕様への参照を追記する（design.md §4）。
- [x] `src/components/README.md` のカテゴリ間依存（`post` → `image`）を更新する。
- [x] 全体の確認として `npx vitest run`・`npx playwright test` が通ること。
