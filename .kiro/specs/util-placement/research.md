# Research & Design Decisions

---

**Purpose**: `src/util/` の各モジュールの利用元を grep で実測し、移動先を決めた根拠と、移動で生じる依存の変化を記録する。
---

## Summary

- **Feature**: `util-placement`
- **Discovery Scope**: Extension（既存の `src/util/`・`src/lib/`・`src/components/` の組み替え。振る舞いは変えない）
- **Key Findings**:
  - brief の「汎用のまま残すもの」のうち `util/textCount.ts`・`util/object.ts`・`util/links.ts` は、利用元が一つの領域だけ（grep の実測）。新しい規約（利用元が複数領域のときだけ `util` に置く）に従い、移動対象とした。
  - `util/share/intent.ts` を `lib/share` へ移すと、`lib/settings/shareSettings.ts` → `lib/share`（値）と `lib/share/counterReserve.ts` → `lib/settings/shareSettings.ts`（型）が循環する。`AutoPopupTarget` の型を `lib/share` へ移して解消する。
  - `util/textCount.ts` は `util/share/intentLength.ts` を参照している。`util` から `lib` への import は `layer` 規則で違反になるため、`textCount.ts` も `lib/share` へ移す。
  - `util/listbox/` と `util/scrollLock.ts` は、分類フォルダ（`select/`・`dialog/`）に直接置けない（`componentLayout` の規則）。利用元の部品フォルダの内側に置く。

## Research Log

### 利用元の実測（2026-11-03、`grep -rn` で `src/`・`tests/`・`scripts/`・`config/`・`e2e/` を対象）

- **Context**: brief の分類（「汎用のまま残す」）を、移動の前に利用元で確かめる必要があった（要件 1.7・3.1）。
- **Sources Consulted**: `src/**/*.ts`・`src/**/*.tsx`・`src/**/*.astro`・`tests/**`
- **Findings**:
  - `util/share/intent.ts`: `lib/settings/shareSettings.ts`・`lib/share/counterReserve.ts`・`components/settings/Settings/index.tsx`・`components/settings/Settings/useShareToggles.ts`・`components/share/IntentShareDialog/index.tsx`・`components/composer/ThreadComposer/rules/shareDispatch.ts`
  - `util/share/intentLength.ts`: `util/share/intent.ts`・`util/share/truncateText.ts`・`util/textCount.ts`・`lib/share/counterReserve.ts`・`components/composer/ThreadComposer/rules/shareDispatch.ts`・`tests/unit/util/textCountFallback.test.ts`
  - `util/share/openIntentPopup.ts`: `util/share/intent.ts`・`components/composer/ThreadComposer/hooks/useThreadSubmit.ts`（`src/pages/jump.astro` はコメントの中のパスのみ）
  - `util/share/truncateText.ts`: `util/share/intent.ts`
  - `util/share/webShare.ts`: `components/timeline/Timeline/ThreadCard/PostCard/useWebShareCrosspost.ts`・`components/composer/ThreadComposer/rules/shareDispatch.ts`
  - `util/textarea/contentEditableModel.ts`: `components/composer/ThreadComposer/hooks/useSuggest.ts`・`components/composer/ThreadComposer/ThreadSegmentForm/PostBodyEditor/index.tsx`・`util/textarea/contentEditableReconcile.ts`・`util/textarea/highlightNodeParts.ts`（内部）
  - `util/textarea/contentEditableReconcile.ts`: `PostBodyEditor/index.tsx`
  - `util/textarea/suggestTrigger.ts`: `hooks/useSuggest.ts`
  - `util/textarea/highlightNodeParts.ts`・`util/textarea/facetHighlightSegments.ts`: 内部（`util/textarea` の中のみ）と `PostBodyEditor` 経由の利用
  - `util/listbox/filter.ts`・`util/listbox/navigation.ts`: `components/common/select/Dropdown/index.tsx`
  - `util/clientEnvironment.ts`: `components/feedback/FeedbackForm/index.tsx`（関数 `collectClientEnvironment` と型）・`lib/feedback/feedbackDraft.ts`（型）
  - `util/emoji/countryFlag.ts`: `lib/atproto/languageFlag.ts`
  - `util/autoLink.ts`: `lib/atproto/richTextSegments.ts`
  - `util/scrollLock.ts`: `components/common/dialog/Overlay/index.tsx`
  - `util/textCount.ts`: `components/composer/ThreadComposer/ThreadSegmentForm/index.tsx`・`components/composer/ThreadComposer/ImageAltDialog/index.tsx`・`tests/unit/util/textCount.test.ts`・`tests/unit/util/textCountFallback.test.ts`
  - `util/object.ts`: `lib/atproto/draft.ts` のみ
  - `util/links.ts`: `components/composer/ThreadComposer/hooks/useDraftFlow.ts` のみ
  - `util/http.ts`: `lib/schedule`（2）・`lib/session`・`lib/survey`・`pages/oauth`・`pages/v1`・`pages/v2`（20）・テスト
  - `util/outcome.ts`: `lib/entry`（4）・`lib/feedback`・`lib/schedule`（4）
  - `util/formData.ts`: `lib/api`（2）・`lib/schedule`・`pages/v2`
  - `util/utf8Bytes.ts`: `components/entry`・`lib/api`（2）・`lib/entry`
  - `util/padTwoDigits.ts`: `lib/schedule`・`lib/video`
  - `util/waitForImageLoad.ts`: `components/composer`・`components/timeline`
- **Implications**: 移動対象は次の二つに分かれる。(a) `util/share/`（5 件）は `lib/share` へ統合する（U-A と `lib-layers` の決定）。(b) 利用元が単一領域のモジュール（`textarea`（5 件）・`listbox`（2 件）・`clientEnvironment`・`countryFlag`・`autoLink`・`scrollLock`・`textCount`・`object`・`links` の計 14 件）は、利用元の領域へ移す。`http`・`outcome`・`formData`・`utf8Bytes`・`padTwoDigits`・`waitForImageLoad` の 6 件は二つ以上の領域が使うため `util` に残す。

### 循環の確認（`lib/share` と `lib/settings`）

- **Context**: `util/share/intent.ts` を `lib/share` に統合すると、`lib/settings` → `lib/share` の辺ができる。
- **Findings**: 既存の辺 `lib/share/counterReserve.ts` → `lib/settings/shareSettings.ts`（`import type { AutoPopupTarget }`）がある。`lib/settings/autoPopupTarget.ts` は import を持たない純粋な型と定数で、参照元は `shareSettings.ts` のみ。
- **Implications**: `autoPopupTarget.ts` を `lib/share/` へ移し、`counterReserve.ts` と `shareSettings.ts` の両方がそこを参照する。`lib/settings` → `lib/share` の一方向になる。`lib/settings/autoPopupTarget.ts` の冒頭コメント（「循環を作らないよう…」）は、移動後の位置に合わせて書き換える。

### 依存の層（`util` → `lib`）

- **Context**: `scripts/architecture/rules.ts` の `layer` 規則は `util` が `lib`・`components`・`pages` を import することを違反にする。
- **Findings**: `util/textCount.ts` が `util/share/intentLength.ts` を参照している。`util/textCount.ts` の利用元は composer だけである。
- **Implications**: `textCount.ts` を `lib/share/` へ移すと、`util` の中に `lib` への import が残らない。

### 小さい部品の内側（`componentLayout`）

- **Context**: `components/common/select/` と `components/common/dialog/` は分類フォルダで、部品を直接置かない規則がある。
- **Findings**: 部品フォルダの外に置いてよい `.ts` は、`layout/nav/` の共有の処理と `i18n` の入口だけである（`structure.md`）。
- **Implications**: `listbox` は `Dropdown/` の内側、`scrollLock.ts` は `dialog/Overlay/` の内側に置く。`textarea` と `links.ts` は利用元がすべて `ThreadComposer/` の中にあるため、`ThreadComposer/rules/` に置く。

## Architecture Pattern Evaluation

| Option                       | Description                                                          | Strengths                                                  | Risks / Limitations                                                  | Notes                    |
| ---------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------ |
| 利用元の領域へ移す（採用）   | 単一領域の関数を、利用元の `lib/` 領域または部品フォルダの内側へ移す | 利用元から配置が読める。`util/` の規約が機械で検査しやすい | 移動先が `lib` と `components` に分かれる                            | brief の U-A と一致      |
| `util/` に残し、名前で分ける | `util/composer/` のように利用元を名前にする                          | 移動の差分が小さい                                         | 「領域に依存しない」の規約と矛盾する                                 | 却下                     |
| `lib/shared/` へ統合する     | `util` を `lib` の中へ入れる                                         | 置き場が一つになる                                         | 汎用と業務の境界が消える（U-B）。`structure.md` の規約を広く改訂する | 却下（利用者の決定 U-A） |

## Design Decisions

### Decision: 単一領域の `util` は利用元へ移し、`util/` へは戻さない

- **Context**: 要件 1・3・4。規約「利用元が複数領域のときだけ `util` に置く」を `structure.md` に加える。
- **Alternatives Considered**:
  1. 汎用の性質（`textCount`・`object`・`links`）を理由に `util/` に残す
  2. 利用元の実測で判断し、単一領域は移す
- **Selected Approach**: 2。規約の根拠は利用元の数であり、関数の性質ではない。
- **Rationale**: 性質で残すと、規約と実際の配置が食い違う。`structure-checks` は利用元の数で検査できる。
- **Trade-offs**: `object.ts` のように一般的な関数が `lib/atproto/` に入る。将来の再利用は、利用元が増えた時点で移す。
- **Follow-up**: 実装後に `util/` 直下を grep し、残りの 6 件の利用元が二つ以上あることを確認する。

### Decision: `lib/share` と `lib/settings` の循環は `AutoPopupTarget` の型を `lib/share` へ移して解消する

- **Context**: 要件 2.4・2.5。`lib/settings` → `lib/share` の辺が必要になる（`isValidInstanceDomain`）。
- **Alternatives Considered**:
  1. `isValidInstanceDomain` を `lib/settings` へ移す（`intent.ts` の他の関数と結びつきが残る）
  2. `AutoPopupTarget` と `AUTO_POPUP_TARGETS` を `lib/share/autoPopupTarget.ts` へ移す
  3. `counterReserve.ts` の型を `shareSettings.ts` から使わず、値（`"ask"` など）を引数で受け取る
- **Selected Approach**: 2。`autoPopupTarget.ts` は import を持たないため、移動しても依存が増えない。`shareSettings.ts` は `lib/share/autoPopupTarget` を参照する。
- **Rationale**: 共有の型は参照される側（下位）に置く（steering の規則）。`lib/share` は `lib/settings` より下位になる。
- **Trade-offs**: `lib/settings/autoPopupTarget.ts` の位置が変わり、その型を import している箇所の import 文を書き換える。
- **Follow-up**: 実装時に `AutoPopupTarget` と `AUTO_POPUP_TARGETS` の importer を grep し、すべて新しいパスへ更新する。

### Decision: `clientEnvironment.ts` は `lib/feedback/` へ移す

- **Context**: 要件 1.6。利用元は `lib/feedback/feedbackDraft.ts`（型）と `components/feedback/FeedbackForm/index.tsx`（関数と型）。
- **Alternatives Considered**: `components/feedback/` の内側へ置く（`lib/feedback` が参照できなくなる）、`lib/feedback/` へ置く
- **Selected Approach**: `lib/feedback/clientEnvironment.ts`
- **Rationale**: `lib` は UI に依存しない。`components` は `lib` を参照してよい。
- **Trade-offs**: `lib/feedback` が `navigator` と `window` の型を扱う。React は import しない。

## Risks & Mitigations

- 循環の見落とし — `libRegionPairs`・`test:imports` の循環検査で確認する。`lib/share` ↔ `lib/settings` を重点的に見る。
- `structure.md` の依存表（`lib/settings`・`lib/share`・`lib/atproto`・`lib/feedback`）と実装の食い違い — 同じ変更で改訂する。
- 移動先の名前の衝突（`lib/share/textCount.ts` と既存の関数名）— 実装時に grep で確認する。
- brief と実測の食い違い（`textCount`・`object`・`links`）— design のレビュー（人の承認）で確認を受ける。

## References

- `.kiro/specs/util-placement/brief.md` — 問題・方針（U-A）・境界
- `.kiro/specs/lib-layers/design.md` — `lib/api` を基盤、`lib/share` を業務とする層の決定
- `.kiro/steering/structure.md` — 部品フォルダの規則・`lib` の依存表・依存規則の検査

### Decision: 分類の四つの規則と `src/types/`（2026-11-03 利用者の決定の具体化）

- **Context**: 利用元の実測で、`util/clientEnvironment.ts` が型・純粋な判定・ブラウザの読み取りを一つのファイルに持つこと、`util/share/intent.ts`・`util/share/webShare.ts` が純粋な組み立てと `window.open`・`navigator.share` を持つことが分かった。`componentLayout` は部品フォルダの外の `.ts` を違反にする。
- **Selected Approach**: 型は `src/types/`（`lib` が `util`・`components` の型を必要とする場合）、業務は `lib/`、ブラウザと DOM は `components/` の部品の内側（純粋な部分は `lib/` へ分ける）、汎用で利用元が二つ以上は `util/`。ファイル単位ではなく関数単位で分ける。
- **Rationale**: 利用元の数だけでは、ブラウザの副作用が `lib` に入る問題を防げない。型の置き場は、`lib` から `util`・`components` への参照を消すために必要。
- **Trade-offs**: 分割で新しいファイルが 4 件増える。`util/share` のブラウザ側と `util/waitForImageLoad.ts` は、`componentLayout` の制約により配置が決まらないため、未決定（U-1・U-2）として残す。
- **Follow-up**: U-1・U-2・U-3 の決定を design に記録してから、3 の塊（util/share の純粋な部分と textCount）と 6.2 を行う。

### 追補（2026-11-03 利用者の決定。上の記録は残す）

- **U-1（案 C）**: `lib/share` は純粋な組み立てだけを持つ。`openIntentPopupFor` は削除し、呼び出し側で `buildIntentUrl` と `openIntentPopup` を組み合わせる。
- **U-1 の配置（grep）**: `openIntentPopup.ts` の利用元は composer（`useThreadSubmit`・`shareDispatch`）と share（`IntentShareDialog`）にまたがるため、共通の部品フォルダ `components/share/IntentShareDialog/` に置く。
- **U-1 の配置（逸脱）**: `webShare.ts`（ブラウザ部分）の利用元は composer（`shareDispatch`）と timeline（`useWebShareCrosspost`）にまたがり、呼び出し元の共通の部品フォルダが `IntentShareDialog/` のみのため、そこに置く（決定の記録の例外 3）。
- **U-2**: `util/waitForImageLoad.ts` は `util/` に残す。DOM を使う例外として `structure.md` に明記する。
- **U-3**: `parseUserAgent` の利用元は `FeedbackForm/clientEnvironment.ts` だけのため、`components/feedback/FeedbackForm/userAgent.ts` に置く。`lib/feedback` は `ClientEnvironment` の型を使うだけになる。
- **型の規則（lib が util の型を使う場合も src/types へ）**: `util/outcome.ts`（型だけ。`lib/entry`・`lib/feedback`・`lib/schedule` が使う）を `src/types/outcome.ts` へ移し、`util/outcome.ts` は消える。`util/formData.ts` の `FormDataFieldKind`（`lib/api` が使う）を `src/types/formData.ts` へ移し、関数は残す。残る `util/` は 5 件（旧案の 6 件から `outcome` が減った）。
- **型の規則（葉と型だけ）**: `src/types/` は外部パッケージ（DOM の型を含む）を import しない。`ClientEnvironment`・`Outcome`・`FormDataFieldKind` はいずれもプリミティブか、同じファイル内の型だけで書ける（確認済み）。
- **差分（記録）**: `textCount.ts` は利用元が components のみだが、3 件の塊の決定により `lib/share` に置く（`intentLength` と同じ文字数の規則）。U-3 の `parseUserAgent` と判断の基準が一致しないため、差分として残す。
