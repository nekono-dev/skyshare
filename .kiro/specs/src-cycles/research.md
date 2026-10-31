# Research & Design Decisions

---

**Purpose**: `lib` 内の循環 import と双方向の依存を、どの向きで解消するかの根拠を残す。
---

## Summary

- **Feature**: `src-cycles`
- **Discovery Scope**: Extension（既存の `lib` の再配置。新しい外部依存は無い）
- **Key Findings**:
  - ファイル単位の循環は 2 つ（`lib/i18n` の翻訳の型と辞書、`lib/settings` の移行処理）。どちらも型だけの import が循環の一部。
  - `lib` 内の双方向の依存は 7 組。すべて、片方が「値」として使い、もう片方が「型」や「定義」を逆向きに参照する形。
  - 型の逆向き参照のほとんどは、共有の定義（zod スキーマの一部、定数、型）が上位の領域に置かれていることが原因。定義を下位へ移せば解消する。
  - 循環の解消で振る舞いは変えない。既存のテストは i18n・settings・翻訳の出力・移行の結果を直接は守っていないため、移動の前に特性化テストを足す必要がある。

## Research Log

### 翻訳の型と辞書（`lib/i18n`）

- **Context**: 循環 16 ファイル（`messages/en/*.ts` 15 件と `translate.ts`）。
- **Sources Consulted**: `src/lib/i18n/translate.ts`、`src/lib/i18n/messages/en/index.ts`、`messages/en/*.ts`、`messages/ja/index.ts`。
- **Findings**:
  - `translate.ts` は `en`・`ja` を値として import し、`createTranslator` で辞書を引く。
  - 英語辞書の各ファイルは、`MessageEntries`（型）と `EnglishMessages`（型。`translate.ts` から import）を使う。
  - 日本語辞書は `translate.ts` を import しない。
  - `translate.ts` の型（52 箇所から利用）は、利用側の import を変えずに済むよう、再エクスポートで残す。
- **Implications**: 型を `messageEntries.ts`（依存なし）と `messageKeys.ts`（`typeof ja` の型参照のみ）へ移す。英語辞書は `messageKeys` だけを型として参照する。`translate.ts` は値の import と、移した型の再エクスポートだけを持つ。循環は、`translate → en/index → messageKeys → ja/index` の一方向になる。

### 旧形式の共有設定（`lib/settings`）

- **Context**: 循環 2 ファイル。`legacyShareSettings.ts` が `shareSettings.ts` の型（`AutoPopupTarget`）を import し、`shareSettings.ts` が `migrateLegacyShareSettings` を値として import する。
- **Findings**: 移行処理（`legacyShareSettings`）の本体は `AutoPopupTarget` の型と、その値の一覧（`AUTO_POPUP_TARGETS`）を必要とするだけ。`deriveAutoPopupTarget` の戻り値の型は `AutoPopupTarget` のみ。
- **Implications**: `AUTO_POPUP_TARGETS` と `AutoPopupTarget` を `settings/autoPopupTarget.ts` に移す。`shareSettings.ts` はそれを再エクスポートする。移行処理は、型の定義元だけを import する。循環は消える。

### `lib/api` と `lib/atproto`

- **Context**: `api` → `atproto` は `threadLimit`（値）を 5 ファイルが使う。逆向きは `atproto/{embed,facet,post,richtext}.ts` が `api/schema/common.ts` の型（`Components.*`）を使う。
- **Findings**: `atproto` が使うのは `Common*Type` の 6 種類（facets・images meta・og meta・reply ref・video blob・video meta）。いずれも型のみ。`api/schema/common.ts` は zod スキーマに `.meta(...)`（OpenAPI の説明）を付けて作るため、スキーマ自体を `atproto` に移すと OpenAPI の情報が下位に入ってしまう。
- **Options**:
  1. `atproto` が Bluesky の形の型を自分で持ち、`api` 側は zod の推論結果がそれに代入可能であることを型検査で確かめる。
  2. zod スキーマごと `atproto` へ移す。
  3. `api` を `atproto` の上位に置き、`atproto` の型を `api` の型から再定義せず、そのまま使う（現状）。
- **Decision**: 1。`atproto` の型は実装の形（Bluesky レコード）に近い方が読みやすい。`api` の推論結果と代入可能かを、`api` 側の型検査で確かめる（`api → atproto` の一方向）。

### `lib/api` と `lib/video`

- **Context**: `api/schema/common.ts` は `video/postVideoLimits`（定数）を使う（api → video）。`video/videoUploader.ts` は `api/schema/common` の `CommonVideoBlobSchema`（値）を使う（video → api）。
- **Findings**: `CommonVideoBlobSchema` は `.meta` を持たない素の zod スキーマ。`api/schema/v2/entry/post.ts` も使う。
- **Decision**: スキーマを `video/videoBlob.ts` に移し、`api/schema/common.ts` は再エクスポートする（api → video の一方向）。

### `lib/api` と `lib/feedback`

- **Context**: `feedback/issueContent.ts` が `api/schema/v2/feedback/post.ts` の `RequestBodyType`（型）を使う。逆向きは `api` が `feedback/limits` を値として使う。
- **Decision**: 送信内容の型（`bug`・`enhancement` の判別共用体）を `feedback/submission.ts` に定義し、`issueContent.ts` はそれを使う。`api` 側は zod の推論結果が代入可能であることを型検査で確かめる（`api → feedback` の一方向）。

### `lib/api` と `lib/survey`

- **Context**: `survey/request.ts` が `api/schema/v2/surveys/_surveyId/path.ts`（値）と `api/response.ts`（値）を使う。逆向きは、`api` の `answers/post.ts` と `path.ts` が `survey/definition.ts`（値）を使う。
- **Findings**: `api/response.ts` は `lib` を import しない（`errorResponseFromStatus` は純粋な関数）。`util/http.ts` も import を持たない。
- **Decision**: `PathParamsSchema` を `survey/pathParams.ts` に移し、`api/schema/.../path.ts` は再エクスポートする（api → survey の一方向）。`errorResponseFromStatus` は `util/http.ts` へ移し、`survey` は `util` を使う（api/response は util を使ってよい）。

### `lib/atproto` と `lib/entry`

- **Context**: `atproto/post.ts` が `entry/url.ts` の `parseOwnedAtUri`（値）を使う。逆向きは `entry` が `atproto` の多数（nsid・gate・blob・threadChain など）を使う。
- **Decision**: AT URI の解析（`parseAtUri`・`parseOwnedAtUri`）を `atproto/atUri.ts` に移す。`entry/url.ts` は URL の組み立てだけを持ち、解析は `atproto` を使う（entry → atproto の一方向）。

### `lib/entry` と `lib/timeline`

- **Context**: 逆向き（entry → timeline）は 2 件。`entry/createPostVisual.ts` が `TimelinePost` の型を使う（必要なのは `images` と `video` だけ）。`entry/resolveEntryDeleteScope.ts` が `timeline/posts.ts` の `normalizePostViewToTimelinePost`（値）と `TimelinePost` の型を使う。
- **Options**:
  1. `createPostVisual` が必要な項目だけの構造型を `entry` に持つ。`resolveEntryDeleteScope` を `timeline` へ移す。
  2. `normalizePostViewToTimelinePost` を `entry` へ移す。
- **Decision**: 1。`resolveEntryDeleteScope` の利用者（`components/entry` の 2 部品、`guestDummyPosts.ts`、テスト）は、削除の範囲（timeline の投稿）を扱うため、timeline の隣に置く方が自然。`timeline → entry` の一方向になる。

### `lib/entry` と `lib/image`

- **Context**: `image/galleryLayout.ts` が `entry/entry.ts` の `SourceImage`（型）を使う。逆向きは `entry/createPostVisual.ts` が `image` の定数と処理を使う。
- **Decision**: `SourceImage` を `image/sourceImage.ts` に移し、`entry/entry.ts` は再エクスポートする（entry → image の一方向）。

## Architecture Pattern Evaluation

| Option                                     | Description                                                                      | Strengths                                                      | Risks / Limitations                                                                  | Notes                              |
| ------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| 定義を下位へ移す（採用）                   | 共有の型・定数・スキーマを、参照される側（下位）へ移し、上位は再エクスポートする | 循環の向きが一方向になる。利用側の import を最小限に変えられる | 型の定義が増えて、同じ概念が二か所に見える場合がある（構造型の代入可能性で確かめる） | 7 組と 2 つの循環の全てに適用      |
| 上位の再利用を禁止し、下位で再定義（重複） | 逆向きの型を、下位で複製する                                                     | 依存は確実に一方向                                             | 重複が増え、形の変更の追従が必要                                                     | 型の複製は、代入可能性の検査で補う |
| 領域の統合                                 | 双方向の領域を一つにまとめる                                                     | 循環は消える                                                   | 領域が肥大化し、責務の境界が崩れる                                                   | 採らない                           |

## Design Decisions

### Decision: 型の定義は参照される側（下位）に置き、上位は再エクスポートする

- **Context**: 要件 3.1（双方向の依存の解消）と、利用側の変更を最小にする要求。
- **Alternatives Considered**: 上記の 3 案。
- **Selected Approach**: 定義を下位へ移し、上位（元の場所）は再エクスポートする。
- **Rationale**: 循環が解消され、利用側の変更は import の 1 行で済む。
- **Trade-offs**: 再エクスポートが残る。再エクスポートは利用側の参照を変えるための一時的な橋であり、後続の作業で減らしてよい（設計では新規の再エクスポートを増やさないことを確かめる）。
- **Follow-up**: `src-import-style` の作業で、再エクスポートの利用を減らせるか確かめる。

### Decision: `lib` の領域の依存の向きを規約として書く（要件 5.2）

- **Context**: 向きを規約にしないと、次の双方向の依存が再び生まれる。
- **Selected Approach**: steering に、`lib` の領域の依存の向きを書く（下位の定義へ向けて依存する。`api` は他の領域を参照してよいが、他の領域は `api` を参照しない。`timeline → entry`、`entry → atproto`・`image`・`video`）。
- **Follow-up**: 検査（`src-import-rules`）は、ディレクトリ単位の双方向を検出しない。この spec では、テストで双方向の有無を確かめる（設計の Testing Strategy）。

## Risks & Mitigations

- **翻訳の型の再エクスポートで、型の循環が見えなくなる** — `translate.ts` の再エクスポートも検査の対象に含める（循環は型として残らないことを検査で確かめる）。
- **構造型の代入可能性が崩れる** — `api` 側の型検査（`satisfies` 相当）で、推論結果と Bluesky の形の代入可能性を確かめる。
- **`src-lib-ui-boundary` と同じファイルを動かす** — `lib/i18n` の型の移動は、`react.ts` の移動より先に行う（roadmap の順序）。
- **振る舞いの変化を検出できない** — 移動の前に、翻訳・移行・レコードの組み立ての特性化テストを足す。

## References

- `.kiro/specs/src-cycles/requirements.md` — 要件 1〜5
- `.kiro/specs/src-import-rules/design.md` — 検査の規則（循環・層）と許容リスト
- `scripts/architecture/` — 循環（R3）の実装
