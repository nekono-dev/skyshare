# Brief: util-placement

## Problem

`src/util/` は「領域に依存しない小さな関数」の置き場のはずだが、業務固有の物が混ざっている。利用元が一つの領域だけのものは、その領域の中に置いたほうが、読む人にとって何がどこで使われるかが分かる。

## Current State（2026-11-03 の実測。利用元の領域）

- `util/share/`（5 件: `intent`・`intentLength`・`openIntentPopup`・`truncateText`・`webShare`）→ components の composer・share・timeline・settings と、`lib/share`・`lib/settings`。`lib/share/` は 2 件あり、同じ概念が二か所に分かれている。
- `util/textarea/`（5 件: `contentEditableModel`（426 行）など）→ `components/composer` だけ。
- `util/listbox/`（2 件）→ `components/common/select` だけ。
- `util/clientEnvironment.ts` → `lib/feedback`（型）と `components/feedback` だけ。
- `util/emoji/countryFlag.ts` → `lib/atproto/languageFlag` だけ。
- `util/autoLink.ts` → `lib/atproto` だけ。
- `util/scrollLock.ts` → `components/common` だけ。
- 汎用のまま残すもの: `util/http.ts`（pages から 22 箇所）・`util/outcome.ts`（entry・schedule・feedback）・`util/formData.ts`・`util/object.ts`・`util/utf8Bytes.ts`・`util/padTwoDigits.ts`・`util/links.ts`・`util/textCount.ts`・`util/waitForImageLoad.ts`。

## Desired Outcome

- `util/` には、二つ以上の領域が使う汎用の関数だけがある。
- 業務固有の物は、利用元の領域（`lib/` の業務か `components/` の部品）へ移る。
- `util/share` は `lib/share` に統合される（`lib-layers` の層の決定に従う）。

## Approach（決定済み 2026-11-03: U-A 業務固有を利用元へ）

- `util/share/*` → `lib/share/`（`lib-layers` の層の決定後に、基盤か業務かを確定する）。
- `util/listbox/*` → `components/common/select/`。
- `util/textarea/*` → `components/composer/` の配下、または `components/common/input/`（design で決める。DOM 編集の基盤なら common、composer 固有の規則なら composer）。
- `util/clientEnvironment.ts` → `lib/feedback/`。
- `util/emoji/countryFlag.ts`・`util/autoLink.ts` → `lib/atproto/`。
- `util/scrollLock.ts` → `components/common/`（design で分類フォルダを決める）。

## Scope

- **In**: 上記の移動、import の更新、`structure.md` の `util/` の規約（「利用元が複数領域のときだけ util に置く」を追加）。
- **Out**: 振る舞い、汎用のまま残す関数の中身、`lib` の層の分類（`lib-layers`）、部品の分割（`components-small-areas`）。

## Boundary Candidates

- `util/` の業務固有の物（`share`・`listbox`・`textarea`・`clientEnvironment`・`emoji`・`autoLink`・`scrollLock`）
- `util/` の規約（steering）

## Out of Boundary

- `util/http.ts` などの汎用の関数の再設計。
- `lib/` の層の分類（`lib-layers`）。

## Upstream / Downstream

- **Upstream**: `lib-layers`（`util/share` の統合先が層で決まる）
- **Downstream**: `components-small-areas`・`lib-large-files`（`contentEditableModel.ts` の移動先）・`structure-checks`

## Existing Spec Touchpoints

- **Extends**: `src-duplicates`（share の責務の統合。結論を `lib/share` への統合に改める。`src-duplicates` の brief に追記する）
- **Adjacent**: `ui-primitives`（`components/common` の部品）・`post-composition`（composer の入力）・`external-sharing`（共有の処理）

## Constraints

- 振る舞いは変えない。移動の前後で `npm run test:all` の結果を比べる。
- 利用元が 1 領域だけになった後も、`util/` に戻さない（規約で検査する: `structure-checks`）。
- `npm run test:all` の結果は、着手時の件数を下回らない。
