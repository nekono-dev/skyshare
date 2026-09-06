# クリエイターモード 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

**前提**: 本書はEditorToolbox（[`specs/editor-toolbox/design.md`](../editor-toolbox/design.md)）が `src/components/common/EditorToolbox/` に実装済みであることを前提とする。EditorToolbox自体の内部設計（状態遷移ロジック、`FloatingBox`との連携、アクセシビリティ実装等）は同設計書を参照し、本書では「利用する側」の設計のみを記述する。

## 1. アーキテクチャ概要

```
src/pages/creator.astro                … クリエイターモード専用ページ（新規）
  └─ src/components/creator/CreatorPostForm/   … PostFormの機能を再利用しつつ拡張フォームを合成する新規コンポーネント
       ├─ src/components/post/PostForm/*        … 既存。本文編集・画像・OGP・gate等のロジックを共有フックとして再利用
       ├─ src/components/common/EditorToolbox/  … 前提（specs/editor-toolbox）。FR1〜FR4の入り口となる汎用ツールバー＋パネル共通コンポーネント
       ├─ src/components/postFeatures/**Panel/  … 本設計で新設。EditorToolboxへ差し込むパネル内容＋ツール定義フック（FR1〜FR4）
       └─ src/components/postFeatures/ThreadComposer/ … 本設計で新設。スレッド投稿のセグメント管理（FR5、ツールボックスの外側）
```

設計方針は次の3点に集約される。

1. **PostForm本体を「機能ロジック（hooks・純関数）」と「単一投稿フォームのレイアウト（JSX）」に分離し、クリエイターモードはロジック層を再利用する。** PostForm自体の見た目・挙動は変更しない。
2. **FR1〜FR4（テキスト選択に基づくリンク設定・装飾変換・カスタムパラメータ・entry詳細設定）は、いずれも前提コンポーネント `EditorToolbox`（Markdownエディタのツールバーに相当）に「ツール」として登録する形で統合する。** 個々の機能はEditorToolboxの内部実装を知らず、EditorToolboxも個々の機能の内容を知らない（疎結合なプラグイン方式）。
3. **FR5（スレッド投稿）はテキスト選択に紐づく機能ではないため、EditorToolboxの外側で、セグメント（投稿単位）の配列を管理する独立したコンポーネント `ThreadComposer` として実装する。** 各セグメントは内部的に1個の `CreatorPostForm`（＝1個のEditorToolbox）を持つ。

## 2. EditorToolboxとの結合方式

### 2.1 EditorToolboxが提供するもの（前提の要約）

詳細は [`specs/editor-toolbox/design.md`](../editor-toolbox/design.md) を参照。クリエイターモードの設計に関わる要点のみ再掲する。

```ts
// src/components/common/EditorToolbox/index.tsx（前提として実装済み）
export type EditorToolboxPanelTool = {
  kind: "panel"
  id: string
  label: string
  icon?: React.ReactNode
  ariaLabel?: string
  disabled?: boolean
  renderPanel: (ctx: { close: () => void }) => React.ReactNode
}

export type EditorToolboxActionTool = {
  kind: "action"
  id: string
  label: string
  icon?: React.ReactNode
  ariaLabel?: string
  isActive?: boolean
  disabled?: boolean
  onClick: () => void
}

export type EditorToolboxTool = EditorToolboxPanelTool | EditorToolboxActionTool

// <EditorToolbox tools={EditorToolboxTool[]} />
```

EditorToolboxは選択範囲やテキスト編集の状態を一切関知しない完全に汎用的なコンポーネントである。FR1〜FR4はいずれも `kind: "panel"` のツールとして実装する（即時実行型 `kind: "action"` は本要件では使用しないが、将来的な拡張（例: YayTextの特定スタイルをワンクリック適用するショートカットボタン）に利用可能）。

### 2.2 ツール定義側の実装パターン

各機能（FR1〜FR4）は、`EditorToolboxTool` を返すReactフックと、パネルの中身を描画するコンポーネントをセットで提供する。フックはUI（JSXを返す`renderPanel`）に依存するため、既存の `PostForm/useSuggest.ts` や `PostForm/useKeyboardRows.ts` と同様に、対応するコンポーネントディレクトリに同居させる（`src/lib/postFeatures/**` には状態変換・バリデーション等の純粋関数のみを置き、Reactに依存するツール定義フックはコンポーネント側に置くことで、`lib`が`components`に依存する逆転を避ける）。

```ts
// src/components/postFeatures/LinkFacetPanel/useLinkFacetTool.ts
export const useLinkFacetTool = (params: {
  editorRef: RefObject<HTMLDivElement>
  manualFacets: ManualLinkFacet[]
  onChange: (next: ManualLinkFacet[]) => void
}): EditorToolboxPanelTool => {
  // 選択範囲の取得、パネル内のURL入力フォームの状態管理、確定時のmanualFacets更新を行う
  // renderPanel内でLinkFacetPanel（見た目のみを持つプレゼンテーショナルコンポーネント）を描画する
}
```

同様に `useYayTextTool`（`YayTextPanel`）、`useCustomFieldsTool`（`CustomFieldsPanel`）、`useEntryManifestTool`（`EntryManifestPanel`）を実装する。選択範囲の取得（`window.getSelection()`からのUTF-16文字インデックス算出）はEditorToolboxの責務ではないため、これらのツール定義フック側で個別に実装する（5節参照）。

### 2.3 CreatorPostFormへの結合方式

```tsx
// src/components/creator/CreatorPostForm/index.tsx（抜粋イメージ）
const linkTool = useLinkFacetTool({
  editorRef,
  manualFacets,
  onChange: setManualFacets,
})
const yayTextTool = useYayTextTool({
  editorRef,
  text,
  onReplaceRange: handleYayTextReplace,
})
const customFieldsTool = useCustomFieldsTool({
  entries: customFieldEntries,
  onChange: setCustomFieldEntries,
})
const entryManifestTool = useEntryManifestTool({
  value: manifestOverride,
  onChange: setManifestOverride,
  enabled: imageEntry !== null,
})

return (
  <>
    <EditorToolbox
      tools={[linkTool, yayTextTool, customFieldsTool, entryManifestTool]}
    />
    <PostBodyEditor
      editorRef={editorRef}
      value={text}
      onChange={setText} /* ...既存props */
    />
  </>
)
```

`EditorToolbox` は `PostBodyEditor` の直上（設置イメージとしてはMarkdownエディタの上部ツールバー）に配置し、`PostBodyEditor` 自体への変更は発生しない（`editorRef` を共有するだけで選択範囲を取得できるため）。

**既存PostFormへの逆輸入時の結合方式**（将来対応、Phase 8）は、`src/components/post/PostForm/index.tsx` の `<PostBodyEditor>` 呼び出しの直前に同様の`<EditorToolbox tools={[...]} />`を1行追加し、逆輸入したい機能のツール定義フックだけを配列に含めるだけで完結する。EditorToolbox自体の変更は不要であり、これがEditorToolboxを独立した共通コンポーネントとして切り出した（`specs/editor-toolbox`として別仕様化した）ことの主要な狙いである。

## 3. ディレクトリ構成（新規追加分）

```
src/pages/
  creator.astro                                 # 新規: /creator ページ

src/components/creator/
  CreatorPostForm/index.tsx                     # 新規: 1セグメント分のクリエイターフォーム本体
  CreatorPostForm/index.module.css
  ThreadPage/index.tsx                          # 新規: /creator ページの実体（ThreadComposerの配置、ページ全体のレイアウト）
  ThreadPage/index.module.css

src/components/common/
  EditorToolbox/**                              # 前提（specs/editor-toolbox実装済み）。本書での変更対象外

src/components/postFeatures/
  LinkFacetPanel/index.tsx                      # FR1: URL入力パネルの見た目
  LinkFacetPanel/useLinkFacetTool.ts             # FR1: EditorToolboxPanelTool定義フック
  LinkFacetPanel/index.module.css
  YayTextPanel/index.tsx                        # FR3: 7スタイルボタンのパネル
  YayTextPanel/useYayTextTool.ts                 # FR3: EditorToolboxPanelTool定義フック
  YayTextPanel/index.module.css
  CustomFieldsPanel/index.tsx                   # FR2: キー・バリュー増減UI
  CustomFieldsPanel/useCustomFieldsTool.ts       # FR2: EditorToolboxPanelTool定義フック
  CustomFieldsPanel/index.module.css
  EntryManifestPanel/index.tsx                  # FR4: heading/caption/cover入力UI
  EntryManifestPanel/useEntryManifestTool.ts     # FR4: EditorToolboxPanelTool定義フック
  EntryManifestPanel/index.module.css
  ThreadComposer/index.tsx                      # FR5: セグメント配列・投稿順序制御（EditorToolboxの外側）
  ThreadComposer/index.module.css

src/lib/postFeatures/
  manualFacets.ts       # 手動facet状態の型・自動検出facetとのマージ（FR1、純粋関数のみ）
  facetReindex.ts        # 本文編集/YayText変換時のfacet byte offset再計算（FR1, FR3で共有、純粋関数のみ）
  customFields.ts        # ドット記法キー→ネストオブジェクト変換、予約語・プロトタイプ汚染ガード（FR2、純粋関数のみ）
  entryManifest.ts        # heading/caption/coverのバリデーション（FR4、純粋関数のみ）
  thread.ts               # スレッドセグメントの投稿順序状態機械、root/parent算出（FR5、純粋関数のみ）

src/util/postFeatures/
  yaytext.ts               # 純粋な文字コードポイント変換テーブル・変換関数（FR3。ドメイン非依存のためutil）
  byteOffset.ts             # UTF-16文字位置 ⇔ UTF-8バイト位置の相互変換（ドメイン非依存のためutil）

src/lib/api/schema/common.ts        # 変更: CommonStrongRefSchema, CommonReplyRefSchema, CommonCustomFieldsSchema を追加
src/lib/api/schema/v2/entry/post.ts  # 変更: reply / customFields / manifestHeading / manifestCaption を追加
src/lib/api/schema/v2/bsky/record/post.ts # 変更: reply / customFields を追加

src/lib/atproto/post.ts               # 変更: createBskyPost に reply/customFields引数を追加
src/lib/entry/skyshareRecord.ts        # 変更: createSkyshareEntry に heading/caption override引数を追加
src/pages/v2/entry.ts                 # 変更: 上記フィールドの受け渡し
src/pages/v2/bsky/record.ts           # 変更: reply/customFieldsの受け渡し
```

`src/util/postFeatures/yaytext.ts` と `byteOffset.ts` はドメイン知識ゼロで完結する（AGENTS.mdのportability testを満たす）ため `util/` に置く。`lib/postFeatures/*.ts` はskyshareのrecord構造に依存する知識を持つが、React/JSXには依存しない純粋関数のみを置く。`components/postFeatures/**Panel/use*.ts` はReact hookとしてUIとlibの橋渡しを行う。

`src/components` は「コンポーネントごとに `index.tsx`/`index.module.css` のみを置き、サブディレクトリを作らない」という既存規約があるが、`use*.ts` のような同一階層への追加ファイルは `src/components/post/PostForm/useSuggest.ts` 等の既存実装と同じパターンであり、この規約（サブディレクトリを作らない）に抵触しない。

## 4. 既存PostFormのリファクタ方針（共有ロジックの抽出）

現状 `src/components/post/PostForm/index.tsx` は状態管理・DOM操作・送信処理が1コンポーネントに集約されている。すでに `useShareToggles`・`submitEntry`・`shareDispatch`・`useSuggest`・`useKeyboardRows` は分離済みであり、クリエイターモードはこれらをそのまま再利用できる。追加で以下の抽出を行う。

- `useEntryComposerState`（新規、`src/components/post/PostForm/useEntryComposerState.ts`）: `text`/`languageCode`/`selfLabel`/`imageEntry`/`ogpResult`/`postGate` など、1投稿分の入力状態をまとめて管理するフックとして切り出す。現在PostForm本体に直書きされているuseStateの塊をこのフックへ移動し、PostForm・CreatorPostForm双方から呼び出す。
- `submitEntry`（既存 `src/components/post/PostForm/submitEntry.ts`）: `SubmitEntryParams` に `customFields`・`manualFacets`・`reply`・`manifestHeading`・`manifestCaption` を任意項目として追加する（後述各節）。既存呼び出し元（PostForm本体）は追加パラメータを渡さないため挙動は変わらない。
- `PostBodyEditor`（既存）: 変更しない。`EditorToolbox` は `editorRef`（既存props）を通じて選択範囲を取得するため、選択範囲取得・置換ロジックは `PostBodyEditor` の外側（各ツール定義フック）に実装する。

このリファクタにより、PostForm本体のJSXはほぼ変更せず、CreatorPostFormは「`useEntryComposerState` + `EditorToolbox` + 追加コンポーネント」を組み合わせた別レイアウトとして実装できる。

## 5. FR1: URLリンク設定機能の設計

### 5.1 状態設計

```ts
// src/lib/postFeatures/manualFacets.ts
export type ManualLinkFacet = {
  id: string
  byteStart: number
  byteEnd: number
  uri: string
}
```

`ManualLinkFacet[]` はテキスト本体とは別のReact state（`useState<ManualLinkFacet[]>([])`）として、CreatorPostForm（将来的にはPostForm）側で保持する。`useLinkFacetTool` はこの配列と `onChange` のみを受け取り、`EditorToolboxPanelTool` を組み立てる。パネルの見た目（URL入力欄、登録済みリンク一覧、削除ボタン）は `LinkFacetPanel` コンポーネントが担う。

### 5.2 選択範囲 → バイトオフセット変換

`PostBodyEditor` はcontentEditableなdivであり、`window.getSelection()` で得られる `Range` はDOMノード＋オフセットの組。既存の `extractPlainText`（`src/util/textarea/contentEditableModel.ts`）と同じ走査ロジックを使って、選択開始/終了位置をプレーンテキスト上のUTF-16文字インデックスへ変換する関数 `resolveSelectionCharRange(root, selection): { charStart, charEnd } | null` を `useLinkFacetTool` 内部（または共有ユーティリティ）に実装する。EditorToolbox自体は選択範囲を関知しないため、この変換ロジックはツール定義フック側（クリエイターモードの設計対象）に閉じる。

さらに `src/util/postFeatures/byteOffset.ts` に、UTF-16文字インデックス⇔UTF-8バイトインデックスの相互変換を行う純粋関数を実装する。

```ts
// src/util/postFeatures/byteOffset.ts
export const charIndexToByteIndex = (text: string, charIndex: number): number =>
  new TextEncoder().encode(text.slice(0, charIndex)).length
```

「選択範囲確定 → EditorToolbox上の『リンク』ツールを押下 → パネルでURI入力 → 確定」で `ManualLinkFacet` を1件生成する際、この関数で `charStart/charEnd` を `byteStart/byteEnd` に変換して保存する。

### 5.3 本文編集への追従（facet位置のシフト・失効）

本文（`text` state）が変わるたびに、直前の `text` と新しい `text` を比較し、`ManualLinkFacet[]` を更新する必要がある。`useEffect` で `text` の変化を検知し、以下の純粋関数を通す。

```ts
// src/lib/postFeatures/facetReindex.ts
export type ByteEdit = {
  /** 編集が始まったバイト位置（共通接頭辞の長さ） */
  startByte: number
  /** 旧テキストで編集により失われたバイト数 */
  deletedByteLength: number
  /** 新テキストで挿入されたバイト数 */
  insertedByteLength: number
}

/** 旧文字列・新文字列から単純な「共通接頭辞＋共通接尾辞」diffで編集区間を求める */
export const computeByteEdit = (oldText: string, newText: string): ByteEdit | null

/**
 * 編集区間と重なるfacetは失効（除外）し、編集区間より後ろにあるfacetは
 * (insertedByteLength - deletedByteLength) だけシフトする。
 * 編集区間より前のfacetはそのまま維持する。
 */
export const reindexFacetsAfterEdit = <T extends { byteStart: number; byteEnd: number }>(
  facets: T[],
  edit: ByteEdit,
): T[]
```

`computeByteEdit` は「共通接頭辞の文字数」「共通接尾辞の文字数」を求め、その間を編集区間とみなす単純化されたdiffである（フルLCSは行わない）。IME入力・貼り付け・削除等、典型的な単一箇所編集であればこれで十分に追従できる。複数箇所の同時編集（例: 検索置換のような操作）は本アプリのcontentEditable実装では発生しないため対象外とする。

この `reindexFacetsAfterEdit` はFR3（YayText変換によるテキスト置換）でも共有して使う。

### 5.4 送信時のマージ

`submitEntry.ts` 内、`detectFacetsForSubmission(text)` の呼び出し結果（自動検出facet）と `manualFacets`（手動リンクfacetをOpenAPIの `CommonFacetSchema` 形式へ変換したもの）をマージする関数を追加する。

```ts
// src/lib/postFeatures/manualFacets.ts
export const mergeManualFacetsWithAutoDetected = (
  manualFacets: ManualLinkFacet[],
  autoFacets: Components.CommonFacetsType | undefined,
): Components.CommonFacetsType => {
  // 1. autoFacetsのうち、manualFacetsのいずれかの範囲と重複するものを除外する
  // 2. manualFacetsをapp.bsky.richtext.facet#link形式へ変換する
  // 3. 結合してbyteStartでソートして返す
}
```

バックエンドの `validateFacets`（`src/lib/atproto/facet.ts`）は変更不要。既存の境界チェックのみで手動facetも自動facetと同様に検証される。

## 6. FR3: YayText変換の設計

### 6.1 変換テーブル

```ts
// src/util/postFeatures/yaytext.ts
export type YayTextStyle =
  | "bold"
  | "italic"
  | "boldItalic"
  | "sansBold"
  | "script"
  | "monospace"
  | "doubleStruck"

/** styleごとの `通常文字 -> 装飾文字` のMap。A-Z/a-z/0-9のみを対象とする。
 *  Unicode Mathematical Alphanumeric Symbols (U+1D400台) 及び
 *  doubleStruck個別対応が必要な blackboard bold（ℂℍℕℙℚℝℤ等、既存のUnicode Letter領域にある例外）を含む。
 */
const STYLE_MAPS: Record<YayTextStyle, Map<string, string>>

export const applyYayTextStyle = (
  text: string,
  style: YayTextStyle,
): string => {
  // 1文字ずつ codePoint 単位でMapを引く。対応がない文字はそのまま残す。
}
```

`STYLE_MAPS` は起動時に規則的に生成する（例えば `bold` はA=U+1D400, a=U+1D41A, 0=U+1D7CE の連番オフセットで機械的に構築できる。`doubleStruck` のみ `C,H,N,P,Q,R,Z` が例外的に既存のUnicode文字（ℂ, ℍ, ℕ, ℙ, ℚ, ℝ, ℤ）を使うため個別マップとして定義する）。

### 6.2 適用フロー（EditorToolbox経由）

1. `useYayTextTool` は `useLinkFacetTool` 同様、選択範囲（charStart/charEnd）を取得する。
2. EditorToolbox上の「装飾」ツール（パネル型）押下でパネル（`YayTextPanel`）が展開し、7スタイルのボタンが並ぶ。
3. スタイルボタン押下で `applyYayTextStyle(selectedText, style)` を実行し、変換後文字列を得る。
4. `useYayTextTool` は親コンポーネントへ `onReplaceRange(charStart, charEnd, transformedText)` を通知する。
5. 親は `text` を「charStart前 + transformedText + charEnd後」に更新し、`computeByteEdit(oldText, newText)` → `reindexFacetsAfterEdit` を `manualFacets` に適用する。

### 6.3 桁上げ文字（サロゲートペア）の扱い

Mathematical Alphanumeric SymbolsはすべてBMP外（U+10000以降）のためJavaScript文字列上ではサロゲートペア（UTF-16で2コードユニット）になる。`applyYayTextStyle` は `Array.from(text)`（コードポイント単位のイテレーション）を用いて処理し、`charIndexToByteIndex` 等のオフセット計算もUTF-16コードユニット単位/コードポイント単位の混同が起きないよう、DOM Selection由来のオフセット（UTF-16単位）とテキスト処理（コードポイント単位）の境界を明確に分離して実装する。

### 6.4 重複時の挙動（決定事項の反映）

要件で「重なりを許容し、変換後にfacetのindexを自動再計算する」と決定した。実装上は5.3の `reindexFacetsAfterEdit` をそのまま適用するのみで、装飾対象の範囲が既存の手動/自動facetと意味的に整合するかどうかの検証は行わない。

## 7. FR2: カスタムパラメータ機能の設計

### 7.1 状態

```ts
// src/lib/postFeatures/customFields.ts
export type CustomFieldEntry = { id: string; key: string; value: string }

export const RESERVED_TOP_LEVEL_KEYS = new Set([
  "text", "facets", "reply", "embed", "langs", "labels", "tags", "createdAt", "via", "$type",
])
const FORBIDDEN_KEY_SEGMENTS = new Set(["__proto__", "constructor", "prototype"])

export type CustomFieldsValidationError =
  | { type: "reservedKey"; key: string }
  | { type: "forbiddenSegment"; key: string }
  | { type: "emptyKey" }
  | { type: "duplicateKey"; key: string }
  | { type: "conflictingPath"; key: string } // 例: "hoge" が leaf と親の両方に使われている

export const validateCustomFieldEntries = (
  entries: CustomFieldEntry[],
): CustomFieldsValidationError[]

/** ドット記法をネストオブジェクトへ変換する。事前にvalidateCustomFieldEntriesでエラー無しを確認してから呼ぶこと。 */
export const buildCustomFieldsObject = (
  entries: CustomFieldEntry[],
): Record<string, unknown>
```

`useCustomFieldsTool` は `entries: CustomFieldEntry[]` と `onChange` を受け取り、`EditorToolboxPanelTool` を組み立てる。パネルの見た目（各行の追加・削除・入力、バリデーションエラー表示）は `CustomFieldsPanel` コンポーネントが担う（バリデーション自体は `validateCustomFieldEntries` という独立した純関数のため、投稿直前の最終チェックにも再利用する）。ツール自体は、未解決のバリデーションエラーがある間ラベルまたはアイコンで警告状態を示す（EditorToolboxのツール定義には警告色専用のプロパティは無いため、`label`にエラー件数を含める、または `icon` を警告色に切り替える等、ツール定義フック側の描画で表現する）。

### 7.2 recordへのマージ（クライアント・サーバ共通ロジック）

`buildCustomFieldsObject` が返すネストオブジェクトを、投稿record本体へマージする処理はクライアント（送信前の最終確認・プレビュー用途）とサーバ（実際にrecordを組み立てる箇所）の両方で必要になる。ロジックの二重実装を避けるため、`src/lib/postFeatures/customFields.ts` に置いた純関数（`buildCustomFieldsObject`, `mergeCustomFieldsIntoRecord`）を、クライアント側（`CustomFieldsPanel`/`useCustomFieldsTool` 経由）・サーバ側（`src/lib/atproto/post.ts`）の双方からimportする（Cloudflare Workers・ブラウザどちらでも動くよう、Node.js固有APIを使わない実装にする）。

```ts
export const mergeCustomFieldsIntoRecord = (
  record: Record<string, unknown>,
  customFields: Record<string, unknown>,
): Record<string, unknown> => {
  // record側の既存キーとcustomFields側のキーが衝突した場合はcustomFields側を無視する
  // （予約キーはUIバリデーション側で事前に弾いているため、ここでは防御的な最終ガードとして機能する）
}
```

### 7.3 バックエンドAPI変更

`src/lib/api/schema/common.ts` に追加:

```ts
export const CommonCustomFieldsSchema = z.record(z.string(), z.unknown()).meta({
  id: "CommonCustomFields",
})
export type CommonCustomFieldsType = z.infer<typeof CommonCustomFieldsSchema>
```

`src/lib/api/schema/v2/entry/post.ts` と `src/lib/api/schema/v2/bsky/record/post.ts` の両方の `RequestBodySchema`（各union分岐）に `customFields: Common.CommonCustomFieldsSchema.optional()` を追加し、`RequestBodyFieldKinds` に `customFields: "json"` を追加する。

`src/lib/atproto/post.ts` の `createBskyPost` にパラメータ `customFields: Record<string, unknown> | undefined` を追加し、record組み立て時に `mergeCustomFieldsIntoRecord` を適用してから `agent.post()` に渡す。

サーバ側でも、深さ・キー数の上限（例: 最大10キー、ネスト最大3階層）をバリデーションし、超過時は400を返す（クライアント側バリデーションのみに依存しない防御的実装）。

## 8. FR4: entry manifest（heading/caption/cover）任意設定の設計

### 8.1 フロントエンド

`useEntryManifestTool` は `{ heading?: string; caption?: string; coverImage?: ImageEntry | null }` を状態として持ち、`enabled`（画像投稿かどうか）に応じて `EditorToolboxPanelTool.disabled` を切り替える。パネルの見た目（`EntryManifestPanel`）は以下を提供する。

- heading入力（`CountedTextInput`、maxLength 100）
- caption入力（`CountedTextInput`、maxLength 300）
- cover画像選択（既存 `ImagePicker` を1枚専用モードで再利用、またはコンポーネント内で単一slot版のクロップUIを組む。具体案は実装時に既存 `ImagePicker` の再利用可否を確認し、再利用できない場合のみ専用の軽量コンポーネントを追加する）

未入力の場合は `undefined` のままとし、`submitEntry.ts` 側で「未指定なら送らない」を徹底する（サーバ側の既定フォールバックロジックをそのまま活かす）。

### 8.2 バックエンド変更

`src/lib/api/schema/v2/entry/post.ts` の両union分岐に以下を追加する。

```ts
manifestHeading: z.string().max(100).optional(),
manifestCaption: z.string().max(300).optional(),
```

`src/lib/entry/skyshareRecord.ts` の `createSkyshareEntry` のシグネチャに `headingOverride?: string` / `captionOverride?: string` を追加し、

```ts
heading: headingOverride?.trim() || `${userName} 's Post`,
caption: (captionOverride?.trim() || headingText) ?? "",
```

のように優先順位を組む。`src/pages/v2/entry.ts` のフェーズ11呼び出し箇所で `body.data.manifestHeading` / `body.data.manifestCaption` を渡すよう変更する。

cover画像（`ogImage`）は既存フィールドをそのまま利用するため、スキーマ変更は不要。クライアント側で「投稿画像から自動生成したthumbnailBlob」ではなく「EntryManifestPanelで選択した画像」を`ogImage`として送るよう `submitEntry.ts` の分岐を追加する。

## 9. FR5: スレッド投稿機能の設計

### 9.1 データ構造

```ts
// src/lib/postFeatures/thread.ts
export type ThreadSegmentStatus = "draft" | "posting" | "posted" | "failed"

export type ThreadSegmentState = {
  id: string
  status: ThreadSegmentStatus
  composer: EntryComposerState // 4節のuseEntryComposerStateが管理する型を再利用
  postedRef?: { uri: string; cid: string } // 投稿成功後に確定
  errorMessage?: string
}

export type ThreadState = {
  segments: ThreadSegmentState[]
}
```

`ThreadComposer` は `ThreadSegmentState[]` を管理し、各セグメントの描画には `CreatorPostForm`（EditorToolboxを内包する1セグメント分のフォーム本体）を「投稿ボタン単体表示・自動ポップアップ無効」モードで埋め込む。`ThreadComposer` 自体はEditorToolboxのツールではなく、複数の `CreatorPostForm` インスタンスを並べる上位コンポーネントである点に注意する。

### 9.2 投稿順序制御

- セグメント`i`の投稿ボタンは、`i === 0` または `segments[i-1].status === "posted"` の場合のみ活性化する。
- セグメント`i`（`i > 0`）投稿時、`reply.root = segments[0].postedRef`、`reply.parent = segments[i-1].postedRef` をリクエストへ付与する。
- 投稿失敗時は該当セグメントを `failed` にし、エラーメッセージを表示、再投稿ボタン（同一内容で再試行）を出す。後続セグメントは投稿不可のまま。
- セグメントの追加・削除は、まだ投稿していない（`status !== "posted"`）セグメントに対してのみ許可する（投稿済みセグメントを削除するとroot/parent整合性が壊れるため）。

### 9.3 バックエンド変更

`src/lib/api/schema/common.ts` に追加:

```ts
export const CommonStrongRefSchema = z
  .object({
    uri: z.string(),
    cid: z.string(),
  })
  .strict()

export const CommonReplyRefSchema = z
  .object({
    root: CommonStrongRefSchema,
    parent: CommonStrongRefSchema,
  })
  .strict()
```

`POST /v2/entry`・`POST /v2/bsky/record` の両スキーマに `reply: Common.CommonReplyRefSchema.optional()` を追加し、`RequestBodyFieldKinds` に `reply: "json"` を追加する。

`src/lib/atproto/post.ts` の `createBskyPost` に `reply` 引数を追加し、`app.bsky.feed.post` レコード組み立て時に `reply` フィールド（`{root, parent}`）としてそのまま渡す（atproto公式lexicon `#replyRef` に準拠する形のため追加バリデーション不要。`root`/`parent`のuri/cidが実在するかはPDS側のリレーションチェックに委ねる）。

`src/pages/v2/entry.ts` / `src/pages/v2/bsky/record.ts` それぞれのハンドラで `body.data.reply` を `createBskyPost` へ受け渡す。

### 9.4 各セグメントのentry作成

各セグメントは独立した投稿として扱われるため、画像投稿セグメントは通常の `/v2/entry` フロー（reply付き）でskyshare entryを作成する。スレッド全体を代表する特別なentryの概念は設けない（要件確定事項どおり）。各セグメントは自身のEditorToolbox（FR1〜FR4のツール）をそのまま利用できる。

## 10. `/creator` ページ構成

```
src/pages/creator.astro
  - 認証済みユーザーのみアクセス可能（既存の認証ミドルウェア/ガードを流用）
  - <ThreadPage client:load /> をマウント

src/components/creator/ThreadPage/index.tsx
  - デフォルトで1セグメントのCreatorPostForm（EditorToolbox込み）を表示
  - 「スレッドに追加」ボタン押下でThreadComposerへ拡張（2セグメント目以降が出現）
  - 単一セグメントのみの場合はThreadComposerを経由せず、通常の1件投稿として動作する
    （スレッド機能を使わないユーザーにreply関連のUIを見せない）
```

## 11. セキュリティ・バリデーション考慮

- カスタムパラメータのキー解析（`buildCustomFieldsObject`）は `__proto__`/`constructor`/`prototype` セグメントを拒否し、`Object.create(null)` ベースで構築することでプロトタイプ汚染を防止する。
- サーバ側でもクライアントと同じ `validateCustomFieldEntries` 相当の検証を独立して行う（クライアントの検証をバイパスした直接APIリクエストへの防御）。
- `reply.root`/`reply.parent` のuri/cidはクライアント申告値をそのまま信頼するのではなく、`root`/`parent`のuriが呼び出しユーザー自身のDIDに属することを検証する（他人の投稿への不正なreply chain構築の防止）。検証失敗時は400を返す。

## 12. 影響範囲まとめ

**新規ファイル**

- `src/pages/creator.astro`
- `src/components/creator/**`
- `src/components/postFeatures/**`
- `src/lib/postFeatures/**`
- `src/util/postFeatures/**`

**前提として利用するが本書では変更しないファイル**

- `src/components/common/EditorToolbox/**`（`specs/editor-toolbox`で実装完了済みであることが前提）

**変更ファイル**

- `src/lib/api/schema/common.ts`（StrongRef/ReplyRef/CustomFields schema追加）
- `src/lib/api/schema/v2/entry/post.ts`（reply/customFields/manifestHeading/manifestCaption追加）
- `src/lib/api/schema/v2/bsky/record/post.ts`（reply/customFields追加）
- `src/lib/atproto/post.ts`（createBskyPostにreply/customFields引数追加）
- `src/lib/entry/skyshareRecord.ts`（heading/caption override引数追加）
- `src/pages/v2/entry.ts`（新規フィールドの受け渡し）
- `src/pages/v2/bsky/record.ts`（新規フィールドの受け渡し）
- `src/components/post/PostForm/index.tsx`（`useEntryComposerState`抽出のためのリファクタ、既存挙動は不変）
- `src/components/post/PostForm/submitEntry.ts`（customFields/manualFacets/reply/manifestHeading/manifestCaption受け入れ、すべて任意項目）

## 13. 段階的な逆輸入のための設計上の担保

- `EditorToolbox`（`specs/editor-toolbox`で独立実装済み）は特定の機能を一切知らないため、逆輸入時にEditorToolbox自体を変更する必要がない。
- `src/components/postFeatures/**Panel/` の各ツール定義フックは、propsとして「現在の値＋onChange」のみを要求し、PostForm/CreatorPostFormいずれの内部状態の型にも直接依存しない。
- `src/lib/postFeatures/**` の関数はすべて純粋関数（副作用なし）とし、PostForm本体に組み込む際もロジックの複製が発生しないようにする。
- 将来PostFormへ逆輸入する際は、(1) `useEntryComposerState` の利用に既存PostFormのuseStateを置き換える、(2) `<EditorToolbox tools={[...]} />` を `PostBodyEditor` 直前に追加し、逆輸入したいツール定義フックだけを配列に含める、(3) `submitEntry` への追加パラメータ受け渡しを配線する、の3ステップで完結する設計とする。
