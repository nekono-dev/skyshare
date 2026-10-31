# Requirements Document

## Introduction

`src/components/` の部品は、1 部品 1 フォルダで領域の直下に平らに並んでいる。どの部品がどの親の中で使われているかは、フォルダ構成から読み取れない。`common/` も依存の関係が見えない平らな並びになっている。本 spec は、開発者とコントリビュータが部品の利用関係をフォルダ構成から読めるように、部品の配置の規則を定め、その規則で部品を配置し直す。利用者（エンドユーザー）に見える振る舞いは変えない。

## Boundary Context

- **In scope**:
  - 部品の入れ子の規則（steering の定義と、その規則による配置）
  - `common/` の基盤の定義と、役割による分類
  - 部品の統合（Spinner を Loading へ）と削除（SettingsDialog）、型の置き場所（SuggestCandidate）
  - 規則を説明する steering と、変更した領域の README
- **Out of scope**:
  - 利用者に見える機能・見た目・文言の変更
  - 投稿言語を設定から選べる機能（別の spec）
  - `ThemeModeSelect` のラベルを呼び出し側から渡す形への変更
  - `ThreadComposer/rules/` が画像部品の型を参照している件（判断の層から UI への依存。別途扱う）
  - `hooks/`・`rules/` の子フォルダを件数によらず作る規約（既存の steering の記述のまま）
  - `lib/` の業務の判断の配置、`pages/` の責務、生成物
- **Adjacent expectations**:
  - `src-folder-layout` が定めた、部品フォルダ外のファイルの例外の一覧と検査（`componentLayout`）は、そのまま守られること
  - `src-import-style` が定めた、`@/` と相対 import の規則は、移動に伴う書き換えでも守られること
  - `src-cycles` が対象外にした components の循環は、本変更の後も循環が 0 件であること

## Requirements

### Requirement 1: 利用元の内側に部品を置く規則

**Objective:** As a 開発者, I want 部品がどの親の中で使われているかをフォルダ構成から読み取れること, so that 変更の影響範囲を、部品の位置から判断できる

#### Acceptance Criteria

1. The steering document shall 部品 P の利用元（P を import しているファイル）がすべて部品 H の中にあるとき、P を H の子フォルダに置くと定める
2. If 部品 P の利用元が一つでも部品 H の外（`pages/`・ほかの領域）にあるとき, the steering document shall P を領域の直下に置くと定める
3. The steering document shall 子の子についても、同じ規則を適用すると定める
4. Where 部品が `common/` または `layout/` に属するとき, the steering document shall その部品を入れ子の規則の対象外（基盤）と定める
5. When 規則の定義が読まれるとき, the steering document shall 規則の例（`composer/ThreadComposer/ImagePicker/`、`timeline/Timeline/ThreadCard/PostCard/`）を含む

### Requirement 2: 規則に従う部品の配置

**Objective:** As a 開発者, I want リポジトリの配置が規則どおりになっていること, so that 規則を読めば、実際の配置の理由が分かる

#### Acceptance Criteria

1. The `src/components/` tree shall 規則の対象となる部品（37 件）を、利用元がすべて属する親の子フォルダに配置する
2. The `src/components/` tree shall 利用元が一つでも親の外にある部品を、領域の直下に配置する
3. The `src/components/` tree shall `common/`・`layout/` の部品の位置を、本変更の前と変えない
4. When 部品が子フォルダに移動したとき, the 部品 shall 移動の前と同じファイル（`index.tsx`・`index.module.css` とその判断のファイル）を、移動先のフォルダに持つ
5. The `src/components/` tree shall 子フォルダを持つ部品の直下に、部品と無関係なファイルを置かない

### Requirement 3: common の基盤の定義

**Objective:** As a コントリビュータ, I want `common/` に汎用の部品だけがあること, so that 業務に固有の部品を探すとき、どこを見ればよいかが分かる

#### Acceptance Criteria

1. The steering document shall `common/` の部品を、呼び出し側の文言と状態を受け取り、業務を持たない汎用の部品と定義する
2. If 部品が一つの業務に固有（例: 投稿言語の一覧）であるとき, the steering document shall その部品を `common/` に置かず、業務の親の子にすると定める
3. The `common/` tree shall 業務に固有の部品（`LanguageSelect`）を含まない
4. The `common/` tree shall 投稿フォームの業務の内側に置かれた部品（`LanguageSelect`）を、`composer/ThreadComposer/ThreadSegmentForm/` の子フォルダに持つ

### Requirement 4: common の分類

**Objective:** As a コントリビュータ, I want `common/` の部品が依存のまとまりで分かれていること, so that 部品の関係を、フォルダの並びから読み取れる

#### Acceptance Criteria

1. The `common/` tree shall 根の直下に、`Loading` と `InlineIcon` だけを部品として置く
2. The `common/` tree shall 重ねて表示する部品（`Overlay`・`FloatingBox`・`ChoiceDialog`・`ConfirmDialog`）を `dialog/` に置く
3. The `common/` tree shall 選ぶ部品（`Dropdown`・`ListboxOption`・`LocaleSelect`・`ThemeModeSelect`・`AutoPopupTargetSelect`・`ChoiceQuestion`）を `select/` に置く
4. The `common/` tree shall 一覧の部品（`ComponentList`・`NavigationBar`・`InfiniteScrollSentinel`）を `list/` に置く
5. The `common/` tree shall 値を入力・切り替える部品（`CountedTextInput`・`ToggleSwitch`・`Checkbox`・`RadioButton`）を `input/` に置く
6. The `common/` tree shall 画像や人の表示の部品（`Avatar`・`MediaThumb`）を `media/` に、開閉と切り替えのまとまりの部品（`Collapsible`・`TabButtons`）を `section/` に置く
7. The `common/` tree shall 分類フォルダに、部品フォルダ（`index.tsx`・`index.astro`）と部品のファイルを直接置かない
8. When 分類フォルダの部品が、同じ `common/` の別の分類の部品を使うとき, the `common/` tree shall その依存を、分類をまたぐ import として表す（循環を作らない）

### Requirement 5: 部品の統合と削除

**Objective:** As a 開発者, I want 使われていない部品と、一つしか使われない部品の重複がないこと, so that 保守する部品の数が減る

#### Acceptance Criteria

1. The `common/` tree shall `Spinner` の部品を持たない
2. When `Loading` が表示されるとき, the `Loading` shall 回転するスピナーを、本変更の前と同じ見た目で表示する
3. The `src/components/` tree shall `settings/SettingsDialog` の部品を持たない
4. The `Settings` 部品 shall 本変更の後も、設定画面（`src/pages/settings.astro`）から同じ内容を表示する
5. The `SuggestPopover` 部品 shall 候補の型（`SuggestCandidate`）を、hooks の中ではなく `rules/` の型のファイルから import する
6. The `ThreadComposer/hooks/` tree shall `SuggestCandidate` の型を定義しない

### Requirement 6: 振る舞いの不変

**Objective:** As a 利用者, I want 配置の変更の前後で、画面の動作が変わらないこと, so that 安心して機能を使い続けられる

#### Acceptance Criteria

1. The system shall 投稿フォーム、タイムライン、Entry の一覧と詳細、設定、予約投稿、アンケート、ログインの既存の e2e の手順（7 件）を、本変更の後も成功させる
2. The system shall 単体・コンポーネント・ルート・描画のテストを、本変更の後も成功させる
3. The generated OpenAPI document shall 本変更の前と同じ内容である
4. The generated API client shall 本変更の前と同じ内容である

### Requirement 7: 既存の規約と検査の維持

**Objective:** As a 開発者, I want 既存の検査が、本変更の後も規約を守らせること, so that 規約が後戻りしない

#### Acceptance Criteria

1. The import dependency check shall 本変更の後も違反を 0 件とする
2. The import dependency check shall 本変更の後も循環を 0 件とする
3. The component layout check shall 部品フォルダの外のソースファイルについて、`src-folder-layout` の例外の一覧と一致する結果を返す
4. The steering region check shall `structure.md` の領域の一覧に、`src/components/` の直下の領域（フォルダ）がすべて現れることを確かめる
5. When 移動に伴って import の指定子を書き換えるとき, the 指定子 shall `src-import-style` の規則（領域をまたぐか 3 段以上の `../` は `@/`、同じ領域の 2 段以内の相対）に従う

### Requirement 8: 説明の更新

**Objective:** As a コントリビュータ, I want steering と README が、現在の配置を説明していること, so that 説明を読めば、実際の配置を探せる

#### Acceptance Criteria

1. The `structure.md` shall 入れ子の規則、`common/` の基盤の定義、分類フォルダの規則を含む
2. The `structure.md` shall 領域の一覧に、`src/components/` の直下に現存する領域だけを含む
3. The README of each changed area shall 現在の配置（子フォルダ・分類フォルダ・移した部品の場所）を説明する
4. If README に旧い配置の部品名が残っているとき, the README shall その名前を現在の場所に直す
