# クリエイターモード タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[FE]` フロントエンド / `[BE]` バックエンド（skyshareサーバサイド） / `[TEST]` テスト

**前提**: 本タスク一覧の着手前に、[`specs/editor-toolbox/tasks.md`](../editor-toolbox/tasks.md) がすべて完了し、`src/components/common/EditorToolbox/` が利用可能な状態になっていること。

## Phase 0: 共通基盤リファクタ（他フェーズの前提）

既存PostFormから状態管理ロジックを抽出し、クリエイターモード側から再利用できるようにする。この段階では見た目・挙動は一切変更しない。

- [ ] `[FE]` `useEntryComposerState`（`src/components/post/PostForm/useEntryComposerState.ts`）を新設し、`text`/`languageCode`/`selfLabel`/`imageEntry`/`ogpResult`/`postGate` 等、1投稿分の入力stateをPostForm本体から移動する。
- [ ] `[FE]` `src/components/post/PostForm/index.tsx` を `useEntryComposerState` を呼ぶ形に置き換える（挙動が変わらないことを既存の手動確認/テストで担保）。
- [ ] `[TEST]` 既存のPostForm関連テストがすべてパスすることを確認する（リグレッション防止）。
- [ ] `[FE]` `src/lib/api/schema/common.ts` に `CommonStrongRefSchema` / `CommonReplyRefSchema` / `CommonCustomFieldsSchema` を追加する。
- [ ] `[FE]` `src/components/postFeatures/`, `src/lib/postFeatures/`, `src/util/postFeatures/` の各ディレクトリを作成する。

## Phase 1: FR1 URLリンク設定機能（フロントエンドのみ）

依存: Phase 0、EditorToolbox実装済み

- [ ] `[FE]` `src/util/postFeatures/byteOffset.ts`: UTF-16文字インデックス⇔UTF-8バイトインデックス相互変換関数を実装する。
- [ ] `[TEST]` `byteOffset.ts` の単体テスト（マルチバイト文字・サロゲートペアを含むケース）。
- [ ] `[FE]` `src/lib/postFeatures/facetReindex.ts`: `computeByteEdit` / `reindexFacetsAfterEdit` を実装する。
- [ ] `[TEST]` `facetReindex.ts` の単体テスト（前方挿入・後方挿入・facet範囲との重複・facet範囲を跨ぐ削除の各分岐）。
- [ ] `[FE]` `src/lib/postFeatures/manualFacets.ts`: `ManualLinkFacet` 型、`mergeManualFacetsWithAutoDetected` を実装する。
- [ ] `[TEST]` `manualFacets.ts` の単体テスト（自動検出facetとの重複除去、ソート順）。
- [ ] `[FE]` `src/components/postFeatures/LinkFacetPanel/index.tsx`: URL入力欄、登録済みリンク一覧、編集/削除UI（パネルの見た目のみ）を実装する。
- [ ] `[FE]` `src/components/postFeatures/LinkFacetPanel/useLinkFacetTool.ts`: 選択範囲取得、`EditorToolboxPanelTool` の組み立て（`renderPanel`で`LinkFacetPanel`を描画）を実装する。
- [ ] `[FE]` 本文欄でのハイライト表示を拡張し、手動リンクfacetの範囲を視認できるようにする（既存 `facetHighlightSegments.ts` / `highlightNodeParts.ts` の拡張、またはクリエイターモード専用のハイライトロジック追加）。
- [ ] `[FE]` `CreatorPostForm` で `useLinkFacetTool` を呼び出し、`EditorToolbox` の `tools` 配列に登録する。`text` state変更時に `manualFacets` を `reindexFacetsAfterEdit` で追従させる。
- [ ] `[FE]` クリエイターモード用の送信処理で `mergeManualFacetsWithAutoDetected` を適用する。
- [ ] 手動確認: 任意文字列にリンクを設定して投稿し、Bluesky上でリンクとして機能することを確認する。

## Phase 2: FR3 YayText変換機能（フロントエンドのみ）

依存: Phase 1（`facetReindex.ts` を共有）

- [ ] `[FE]` `src/util/postFeatures/yaytext.ts`: 7スタイル分の変換テーブル生成・`applyYayTextStyle` を実装する。
- [ ] `[TEST]` `yaytext.ts` の単体テスト（各スタイルのA-Z/a-z/0-9変換、非対応文字はそのまま残ることの確認、doubleStruckの例外文字C/H/N/P/Q/R/Zの確認）。
- [ ] `[FE]` `src/components/postFeatures/YayTextPanel/index.tsx`: 7スタイルボタンのパネル（見た目のみ）を実装する。
- [ ] `[FE]` `src/components/postFeatures/YayTextPanel/useYayTextTool.ts`: 選択範囲取得、スタイル確定時のテキスト置換通知、`EditorToolboxPanelTool` の組み立てを実装する。
- [ ] `[FE]` `CreatorPostForm` で `useYayTextTool` を呼び出し、`EditorToolbox` の `tools` 配列に追加する。置換後に `computeByteEdit` → `reindexFacetsAfterEdit` を `manualFacets` に適用する配線を行う。
- [ ] `[FE]` 文字数カウンタ（`countGraphemes`/`countWeightedTweetLength`）が装飾後文字列でも正しく機能することを確認する（既存ロジックの再利用のみで対応可能か確認し、対応不可なら調整する）。
- [ ] 手動確認: 装飾変換後、既存の手動リンクfacetの位置がずれずに機能することを確認する。

## Phase 3: FR2 カスタムパラメータ機能（フロントエンド＋バックエンド）

依存: Phase 0、EditorToolbox実装済み

- [ ] `[FE]` `src/lib/postFeatures/customFields.ts`: `CustomFieldEntry` 型、`RESERVED_TOP_LEVEL_KEYS`、`validateCustomFieldEntries`、`buildCustomFieldsObject`、`mergeCustomFieldsIntoRecord` を実装する（Cloudflare Workers / ブラウザ双方から利用できる実装にする）。
- [ ] `[TEST]` `customFields.ts` の単体テスト（ドット記法のネスト変換、予約語エラー、`__proto__`等禁止セグメントの拒否、重複キー・競合パスのエラー検出）。
- [ ] `[BE]` `src/lib/api/schema/v2/entry/post.ts` の両union分岐に `customFields: Common.CommonCustomFieldsSchema.optional()` を追加し、`RequestBodyFieldKinds` を更新する。
- [ ] `[BE]` `src/lib/api/schema/v2/bsky/record/post.ts` の全union分岐に同様の追加を行う。
- [ ] `[BE]` `src/lib/atproto/post.ts` の `createBskyPost` に `customFields` 引数を追加し、`mergeCustomFieldsIntoRecord` を適用してからrecordを作成するよう変更する。
- [ ] `[BE]` サーバ側でのキー数・ネスト深さ上限バリデーションを追加する（クライアント検証のバイパス対策）。
- [ ] `[BE]` `src/pages/v2/entry.ts` / `src/pages/v2/bsky/record.ts` で `body.data.customFields` を `createBskyPost` へ受け渡す。
- [ ] `[TEST]` `tests/lib/atproto/post.test.ts`（存在しなければ新設）に customFields マージの分岐を追加する。
- [ ] `[TEST]` `tests/pages/v2/entry.test.ts` / `tests/pages/v2/bsky/record.test.ts` に customFields 指定時・予約語混入時（400）の分岐を追加する。
- [ ] `npm run codegen` を実行し、フロント用クライアント（`CreateEntryBody`/`CreateBskyRecordBody` 型）を再生成する。
- [ ] `[FE]` `src/components/postFeatures/CustomFieldsPanel/index.tsx`: +/−ボタンによる行増減、バリデーションエラー表示（パネルの見た目のみ）を実装する。
- [ ] `[FE]` `src/components/postFeatures/CustomFieldsPanel/useCustomFieldsTool.ts`: `EditorToolboxPanelTool` の組み立て（バリデーションエラーがある間はツールのラベル/アイコンで警告表示）を実装する。
- [ ] `[FE]` `CreatorPostForm` で `useCustomFieldsTool` を呼び出し、`EditorToolbox` の `tools` 配列に追加する。送信時に `buildCustomFieldsObject` の結果を送信パラメータへ含める。
- [ ] 手動確認: 追加したキー・値が実際のrecordに反映されること（`getRecord`等で確認）、予約語入力時にエラーになることを確認する。

## Phase 4: FR4 entry manifest（heading/caption/cover）任意設定（フロントエンド＋バックエンド）

依存: Phase 0、EditorToolbox実装済み

- [ ] `[BE]` `src/lib/api/schema/v2/entry/post.ts` の両union分岐に `manifestHeading: z.string().max(100).optional()` / `manifestCaption: z.string().max(300).optional()` を追加する。
- [ ] `[BE]` `src/lib/entry/skyshareRecord.ts` の `createSkyshareEntry` に `headingOverride`/`captionOverride` 引数を追加し、優先順位ロジック（override → 既存の自動生成）を実装する。
- [ ] `[BE]` `src/pages/v2/entry.ts` のフェーズ11呼び出し箇所を更新する。
- [ ] `[TEST]` `tests/lib/entry/skyshareRecord.test.ts` に override指定時・未指定時（既存挙動維持）の分岐を追加する。
- [ ] `[TEST]` `tests/pages/v2/entry.test.ts` に manifestHeading/manifestCaption 指定時の分岐を追加する。
- [ ] `npm run codegen` を実行してフロント用クライアントを再生成する。
- [ ] `[FE]` `src/lib/postFeatures/entryManifest.ts`: heading/caption/coverImageのstate・バリデーション（文字数上限）を実装する。
- [ ] `[FE]` `src/components/postFeatures/EntryManifestPanel/index.tsx`: heading/caption入力、cover画像選択UI（既存 `ImagePicker` の再利用可否を実装時に確認し、再利用できなければ単一slot版の軽量コンポーネントを実装する。パネルの見た目のみ）を実装する。
- [ ] `[FE]` `src/components/postFeatures/EntryManifestPanel/useEntryManifestTool.ts`: `EditorToolboxPanelTool` の組み立て（画像投稿でない場合は`disabled: true`にする）を実装する。
- [ ] `[FE]` `CreatorPostForm` で `useEntryManifestTool` を呼び出し、`EditorToolbox` の `tools` 配列に追加する。未入力時は `ogImage`/`manifestHeading`/`manifestCaption` を送信しない（現行の自動生成に委ねる）よう配線する。
- [ ] 手動確認: heading/caption/cover画像を指定して投稿し、entry一覧・詳細に反映されることを確認する。未入力時に既存の自動生成と同じ結果になることを確認する（後方互換確認）。

## Phase 5: FR5 スレッド投稿機能（フロントエンド＋バックエンド）

依存: Phase 1〜4（スレッドの各セグメントがフル機能を持つため、他フェーズの機能コンポーネントが先に揃っている必要がある）

- [ ] `[BE]` `src/lib/api/schema/v2/entry/post.ts` の両union分岐に `reply: Common.CommonReplyRefSchema.optional()` を追加する。
- [ ] `[BE]` `src/lib/api/schema/v2/bsky/record/post.ts` の全union分岐に同様の追加を行う。
- [ ] `[BE]` `src/lib/atproto/post.ts` の `createBskyPost` に `reply` 引数を追加し、recordへ `reply: {root, parent}` を設定する。
- [ ] `[BE]` `reply.root`/`reply.parent` のuriが呼び出しユーザー自身のDIDに属することをサーバ側で検証するロジックを追加し、不一致時は400を返す。
- [ ] `[BE]` `src/pages/v2/entry.ts` / `src/pages/v2/bsky/record.ts` で `body.data.reply` を受け渡す。
- [ ] `[TEST]` `tests/lib/atproto/post.test.ts` に reply付与時の分岐を追加する。
- [ ] `[TEST]` `tests/pages/v2/entry.test.ts` / `tests/pages/v2/bsky/record.test.ts` に reply指定時・他人の投稿への不正なreply指定時（400）の分岐を追加する。
- [ ] `npm run codegen` を実行してフロント用クライアントを再生成する。
- [ ] `[FE]` `src/lib/postFeatures/thread.ts`: `ThreadSegmentState`/`ThreadState`、投稿順序制御（活性化判定・root/parent算出）ロジックを実装する。
- [ ] `[TEST]` `thread.ts` の単体テスト（順序制御ロジックの分岐網羅）。
- [ ] `[FE]` `src/components/postFeatures/ThreadComposer/index.tsx`: セグメント追加/削除、各セグメント（`CreatorPostForm`インスタンス）の投稿ボタン活性制御、投稿成功/失敗の状態表示を実装する。
- [ ] `[FE]` セグメントごとの投稿処理（`reply`パラメータを含めた送信）を実装する。
- [ ] `[FE]` 自動ポップアップ（クロスポスト等）を本機能利用時は無効化する配線を行う。
- [ ] 手動確認: 3件以上のセグメントを作成し、順に投稿してBluesky上で正しいスレッドとして表示されることを確認する。未投稿の後続セグメントの投稿ボタンが操作不可であることを確認する。

## Phase 6: `/creator` ページ統合・全体テスト

依存: Phase 1〜5

- [ ] `[FE]` `src/components/creator/CreatorPostForm/index.tsx`: `useEntryComposerState`・`EditorToolbox`・Phase1〜4の各ツール定義フックを合成した1セグメント分のフォームを実装する。
- [ ] `[FE]` `src/components/creator/ThreadPage/index.tsx`: 単一セグメント表示⇔ThreadComposer拡張の切り替えを実装する。
- [ ] `[FE]` `src/pages/creator.astro`: 認証ガードを適用し、`ThreadPage` をマウントする。
- [ ] 手動確認: `/creator` にログイン済みユーザーでアクセスし、EditorToolbox経由で全機能（URLリンク・YayText・カスタムパラメータ・entry詳細設定）とスレッド投稿を一通り使って投稿できることを確認する。
- [ ] 手動確認: 既存の `/`（Timeline）・既存PostFormの投稿導線に regression がないことを確認する。
- [ ] `[TEST]` 全体の `npx vitest run` を実行し、既存テストを含めてすべてパスすることを確認する。
- [ ] ドキュメント更新: `README.md`/`README-jp.md` にクリエイターモードの導線を追記するか検討する（ユーザー向け説明が必要な場合）。

## Phase 7（将来対応・本タスク一覧の範囲外）: PostFormへの逆輸入

参考情報として記載。実施タイミングは別途判断する。

- [ ] 逆輸入したい機能（例: URLリンク設定）のツール定義フックを選定する。
- [ ] `src/components/post/PostForm/index.tsx` の `<PostBodyEditor>` 直前に `<EditorToolbox tools={[...]} />` を追加し、選定したツール定義フックを配列に含める。
- [ ] `submitEntry` への配線（customFields/manualFacets等の受け渡し）を行う。
- [ ] 既存PostForm利用箇所（dialog/page両バリアント）でのUI崩れがないことを確認する。
