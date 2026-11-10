# Structure: 共通（util・styles）と型（types）

## 共通（`src/util/`・`src/styles/`）

- `util/` は、利用元が二つ以上の領域のときだけ `util` に置く（領域に依存せず、DOM も使わない汎用の関数）。利用元が一つになった関数は利用元の領域へ移し、`util/` へ戻さない。`util/share/` のような下位フォルダは置かない。
- 置き場の判断は四つの規則による: (1) 型は `src/types/`（「型（`src/types/`）」の節）、(2) 業務の判断は `lib/<領域>/`（例外: 利用元が一つの部品だけの純粋な判定は、その部品の内側に置く。例: `components/feedback/FeedbackForm/userAgent.ts`）、(3) ブラウザや DOM を操作する処理（`window`・`document`・`navigator`・`Image`・`Node`）は、それを使う `components/` の部品の内側（純粋な部分は `lib/` へ分ける。利用元が複数の部品領域にまたがるときは、それらが共通に import できる部品フォルダの内側）、(4) 領域に依存せず DOM も使わない汎用の関数は `util/`。
- 例外: `util/waitForImageLoad.ts` は DOM の `Image` を使うが、利用元が二つの部品領域のため `util/` に残す。
- `styles/` は CSS Modules。`tokens.css` が値、`ui.module.css` と `*.ui.module.css` が共通のクラス。

## 型（`src/types/`）

- 複数の領域が参照する型の置き場。`lib` が `util` または `components` で定義された型を使うときは、その型を `src/types/` へ移し、`lib` と `components` の両方がそこから import する（`lib` が `util` の型を使う場合も含む）。
- `lib` で定義され `components` だけが使う型は `lib` に残す（`components` は `lib` を import してよい）。
- `src/types/` は葉である。`src/types/` のファイルは `src/types/` の外（`lib`・`components`・`util`・`pages`）と、外部パッケージ（DOM の型を含む）を import しない。外部の型が要る場合は、その型を import せず、型の持ち主の層に残す。
- `src/types/` の文は型だけにする（`export type`・`export interface`・`import type` のみ）。値の宣言（`const`・`let`・`function`・`class`・`enum`）・`export default`・`export *`・値の import は置かない。
- Cloudflare の型と宣言は、既存の規則どおり `lib/platform/` に置く（この節の対象外）。
- 葉と型だけの規則（`typesLeaf`・`typesOnly`）は、`npm run test:imports` が検査する（[structure-checks.md](structure-checks.md)）。

---

_updated_at: 2026-11-08_
