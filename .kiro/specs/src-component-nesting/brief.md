# Brief: src-component-nesting

## Problem

`src/components/` は、部品が 1 部品 1 フォルダで領域の直下に平らに並ぶ。2026-11-03 の計測では、部品フォルダ 94 件のうち子フォルダに入っているのは 4 件（`ThreadComposer` の子）だけで、残りはすべて領域の直下にあった。`ThreadComposer` だけが子部品（`ComposerDialogs`・`ImagePicker` など）を持ち、ほかの部品は使われ方と無関係な位置にある。結果として、ある部品がどの親の中で使われているかが、フォルダ構成から読み取れない。`ThreadComposer` の内側だけが複雑に見え、「`ThreadComposer` とそれ以外」という偏りが生じている。

`common/` も 23 件の部品が平らに並び、依存の関係（ダイアログの土台、ドロップダウンの土台、一覧の部品）が見えない。

## Current State

2026-11-03 時点で、次の変更を実装済み（未コミット。ワーキングツリーに残っている）。cc-sdd の工程（要件・設計・タスクの承認）は通していない。

- **部品の入れ子**: 利用元がすべて一つの部品の中にある部品 37 件を、その親の子フォルダへ移動（`git mv`）。`ThreadComposer` の配下は 4 件から 19 件に増えた。`video/`・`survey/` の領域は、すべての部品が親の子になり消えた。移動のうち 19 件は、領域をまたぐ移動。
- **import の書き換え**: 移動に伴い、src・tests の import 指定子を書き換えた（src-import-style の規則に従う）。
- **common の分類**: 21 件を役割の分類フォルダへ移動（dialog・select・input・list・media・section）。根には `Loading`・`InlineIcon` だけを残した。
- **統合・削除**:
  - `common/Spinner` を `common/Loading` に統合（利用元は Loading だけ）。
  - `settings/SettingsDialog` を削除（利用元 0 件）。
  - `composer/ThreadComposer/hooks/useSuggest.ts` の型 `SuggestCandidate` を `rules/suggestCandidate.ts` に移し、UI（SuggestPopover）から hooks への逆向きの依存を解消。
- **steering と README**: `structure.md` に、次の規則を追記（利用元の内側に置く・`common/` の基盤の定義・分類フォルダ・領域の一覧の更新）。`src/components/README.md`・`common/`・`entry/`・`image/`・`settings/` の README を、現在の配置に合わせて書き直し。
- **テスト**: `tests/unit/components/image/croppedImageStyle.test.ts` を、対象の部品の場所（`composer/ThreadComposer/ImagePicker/`）へ移動。
- **検証**: `npm run test:all` は exit 0（単体 302・コンポーネント 13・ルート 212・描画 2・e2e 7）。import 検査は違反 0 件、循環は 0 件。変更したファイルは Prettier の検査を通過。

既存の規約との関係:

- `structure.md` の「部品の判断やフックが多いときは、子フォルダ `rules/`・`hooks/`」の規則は変えていない（今回の作業の対象外。ユーザーの指示で一旦無視した規約）。
- `src-folder-layout` の 1.3（部品フォルダの外のファイルの例外の一覧）は、変えていない。

## Desired Outcome

- 部品の配置が、利用関係を読み取れる構造になっている。どの部品がどの親の中で使われているかが、フォルダ名だけで分かる。
- `common/` の部品が、役割の分類フォルダで読める。根には複数の分類から使われる基盤だけが残る。
- 規則（入れ子・基盤・分類）が `structure.md` に明記され、`componentLayout`・`steeringRegions`・import 検査の既存の検査が通る。
- 利用者に見える振る舞いは変わらない（e2e とコンポーネントテストが通る）。

## Approach

規則を先に定め、その規則を機械的に当てはめて配置を決める。判断が必要な部品は、次のように決めた（approach の選択肢として残すのではなく、決定として記録する）。

1. **入れ子の規則**: 部品 P の利用元がすべて部品 H の中にあるとき、P は H の子フォルダに置く。利用元が一つでも H の外にあるときは、領域の直下に置く。`common/`・`layout/` の部品には適用しない（基盤）。
2. **基盤の定義**: `common/` は汎用の部品だけを置く（呼び出し側の文言と状態を受け取り、業務を持たない）。業務に固有の部品は `common/` に置かず、業務の親の子にする。
3. **個別の判断**:
   - ChoiceQuestion（SurveyDialog の唯一の利用元）は、汎用部品として `common/` に残す。SurveyDialog を汎用部品に統合する案は採らない。
   - FloatingBox と NavigationBar は、汎用の部品として `common/` に残す。
   - ThemeModeSelect は `common/` に残す。ただし、ラベルが `settings.theme.*` のキーを直接使うため、汎用化するときはラベルを呼び出し側から渡す（今回は変えない）。
   - LanguageSelect（投稿言語の一覧）は業務に固有なので、`ThreadSegmentForm` の子にする。Settings から設定できるようにする機能は、今回の対象外（下の Out を参照）。
   - Spinner は Loading に統合する（利用元が Loading だけで、ロジックを持たない）。
   - SettingsDialog は削除する（利用元 0 件）。
4. **common の分類**: 役割で分ける。
   - `dialog/`（重ねて表示）: Overlay・FloatingBox・ChoiceDialog・ConfirmDialog
   - `select/`（選ぶ）: Dropdown・ListboxOption・LocaleSelect・ThemeModeSelect・AutoPopupTargetSelect・ChoiceQuestion
   - `list/`（一覧）: ComponentList・NavigationBar・InfiniteScrollSentinel
   - `input/`（値を入力・切り替える）: CountedTextInput・ToggleSwitch・Checkbox・RadioButton
   - `media/`（画像・人の表示）: Avatar・MediaThumb
   - `section/`（開閉・切り替え）: Collapsible・TabButtons
   - 根: Loading・InlineIcon（複数の分類から使われる基盤）

## Scope

- **In**:
  - 上記の入れ子（37 件）と common の分類（21 件）の移動、import の書き換え、テストの移動。
  - Spinner の統合、SettingsDialog の削除、SuggestCandidate の型の移動。
  - `structure.md` の規則の追記、関係する README の更新。
  - 既存の検査（`componentLayout`・`steeringRegions`・import 検査・循環検査）の、この変更での通過。
- **Out**:
  - LanguageSelect を Settings から設定できるようにする機能（利用者に見える新機能。別の spec として扱う）。
  - `ThemeModeSelect` のラベルを呼び出し側から渡す形への変更（汎用化の時点で扱う）。
  - `ThreadComposer/rules/segments.ts`・`shareDispatch.ts` が画像部品の型を import している件（判断の層から UI の型への依存。別途扱う）。
  - `hooks/`・`rules/` の子フォルダを、件数によらず作る規約（ユーザーの指示で一旦無視。`structure.md` の既存の記述のまま）。
  - `components/video`・`survey` の旧パスを参照する spec の本文（`.kiro/specs/` の既存の文書。履歴として残す）。
  - コミット（ユーザーの指示があるまで行わない）。

## Boundary Candidates

- **規則**: 入れ子・基盤・分類の規則（`structure.md`）。
- **配置**: 部品フォルダの移動と import の書き換え（機械的に決まる部分）。
- **統合・削除**: Spinner・SettingsDialog・SuggestCandidate の型。個別の判断を含む。

## Out of Boundary

- 部品の振る舞い・見た目・文言の変更（配置だけを変える）。
- `lib/` の業務の判断の配置（`src-cycles`・`src-lib-ui-boundary` の対象）。
- `pages/` の責務（`src-pages-thin` の対象）。
- 新しい機能（投稿言語の設定など）。

## Upstream / Downstream

- **Upstream**:
  - `src-folder-layout`（実装・検証済み）: 部品フォルダ外のファイルの配置、steering の領域の一覧。今回の規則は、この spec の steering を拡張する。
  - `src-composer-layout`（実装済み）: `ThreadComposer` の `hooks/`・`rules/` の規則。今回の入れ子は、この規則と両立させる。
  - `src-import-style`（実装・検証済み）: `@/` と相対 import の規則。移動に伴う書き換えは、この規則に従う。
- **Downstream**:
  - 投稿言語の設定を追加する spec（LanguageSelect を、設定から使うようにする時点で `common/select/` へ移す）。
  - 汎用化されるテーマ切替ボタン（ThemeModeSelect のラベルを呼び出し側から渡す）。
  - `src-cycles`（components の循環を、対象外にしていた件。今回の変更後の循環検査は 0 件）。

## Existing Spec Touchpoints

- **Extends**: `src-folder-layout`（steering の領域の一覧・部品の規則）、`src-composer-layout`（`ThreadComposer` の子フォルダの規則）。
- **Adjacent**:
  - `src-import-style`（`@/` の規則）
  - `src-cycles`（components の循環を対象外にしていた）
  - `settings`・`post-composition`・`surveys`（SettingsDialog・SuggestPopover・SurveyGate の配置が変わる。それぞれの spec の本文は、履歴として残す）
  - `ui-primitives`（common の部品の分類が変わる）

## Constraints

- 利用者に見える振る舞いを変えない（配置と import の変更のみ）。
- 既存の検査（`componentLayout.test.ts`・`steeringRegions.test.ts`・`check-imports`）を、通るように保つ。
- 生成物（`src/client/openapi/`）は、変更しない（`npm run apigen` の出力に差が出ないこと）。
- 作業はワーキングツリーに残す。コミットは、ユーザーが指示したときだけ行う。
- 経緯はコードに残さない（コメントに「移動前」などを書かない）。
