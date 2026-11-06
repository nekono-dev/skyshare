# Requirements Document

## Introduction

`src/util/` は「領域に依存しない小さな関数」の置き場であるが、現状は一つの領域だけが使う業務固有の物（`util/share`・`util/textarea`・`util/listbox`・`util/clientEnvironment.ts`・`util/emoji/countryFlag.ts`・`util/autoLink.ts`・`util/scrollLock.ts`・`util/object.ts`・`util/links.ts`・`util/textCount.ts`）や、ブラウザの操作を含む物が混ざっている。本仕様は、次の四つの規則で各モジュールを分類し直す。(1) 型は `src/types/` に置く（`lib` が使う型が `util` または `components` で定義されている場合を含む）、(2) 業務の判断は `lib/` の領域へ移す、(3) ブラウザや DOM を操作する処理は、それを使う `components/` の部品へ移す（純粋な部分は `lib/` へ分ける）、(4) 領域に依存せず DOM も使わない汎用の関数だけを `util/` に残す。あわせて、`util/share` と `lib/share` に分かれている同じ概念を `lib/share` に統合し、`structure.md` の `util/` の規約に「利用元が複数領域のときだけ `util/` に置く」を加える。利用者に見える振る舞い、API の入出力、生成物は変えない。

## Boundary Context

- **In scope**: `src/util/` の業務固有の関数の利用元の領域への移動、業務とブラウザの処理が混ざるモジュールの分割、`src/types/` の新設（`ClientEnvironment`・`Outcome`・`FormDataFieldKind` の型）、`util/share` の `lib/share` への統合（純粋な部分）とブラウザ側の部品フォルダへの移動、移動に伴う import とテストのパスの更新、`structure.md` の `util/`・`src/types/` の規約の改訂
- **Out of scope**: 汎用のまま残す関数（`util/http.ts`・`util/formData.ts` の関数・`util/utf8Bytes.ts`・`util/padTwoDigits.ts`・`util/waitForImageLoad.ts`）の中身と設計、`lib/` の層の分類（`lib-layers`）、`components/` の部品の分割と小さい部品領域の統合（`components-small-areas`）、400 行を超えるファイルの分割（`lib-large-files`。`contentEditableModel.ts` の分割を含む。本仕様では移動のみを行う）、検査の追加（`structure-checks`）
- **決定の記録**: 利用者の決定（U-1: 案 C、U-2: `waitForImageLoad` は `util/` に残す、U-3: `parseUserAgent` は部品の内側、型の規則）は design の「決定の記録」の節に書く。決定から生じる例外と差分も同じ節に記録する
- **Adjacent expectations**: `lib-layers` が決めた層の分類（`lib/share` は業務）に従う。`src-duplicates` の share の責務の結論は、本仕様の完了時に `lib/share` への統合へ改める。`structure-checks` は本仕様の規約を機械で検査する。利用者に見える画面・操作・文言は変えない。

## Requirements

### Requirement 1: 業務固有の関数の移動

**Objective:** As a 開発者, I want 一つの領域だけが使う関数がその領域の中に置かれていること, so that 読む人が、何がどこで使われるかを配置から判断できる

#### Acceptance Criteria

1. When a `util` 配下のモジュールの利用元が一つの領域だけである場合, the system shall place that module inside the利用元の領域 (the 業務の `lib/` 領域 or the `components/` の部品フォルダ)
2. The system shall move `util/listbox/` の全ファイル to the `components/common/select/Dropdown/` の内側（利用元が `Dropdown` だけのため。分類フォルダ `select/` に直接置かない）
3. The system shall move `util/textarea/` の全ファイル to the `components/composer/ThreadComposer/rules/` の内側 without splitting the contents of any file
4. The system shall move `util/emoji/countryFlag.ts` and `util/autoLink.ts` to the `lib/atproto/` の内側
5. The system shall move `util/scrollLock.ts` to the `components/common/dialog/Overlay/` の内側（利用元が `Overlay` だけのため）
6. The system shall split `util/clientEnvironment.ts` as follows（決定の根拠は design）: (a) the `ClientEnvironment` 型 to `src/types/clientEnvironment.ts`（`lib/feedback` と `components/feedback` の両方が使うため）、(b) the 純粋な判定 `parseUserAgent`（と内部の補助）to `components/feedback/FeedbackForm/userAgent.ts`（利用元が部品だけのため。利用者の決定 U-3）、(c) the ブラウザの読み取り `detectStandalone`・`collectClientEnvironment`（と補助）to `components/feedback/FeedbackForm/clientEnvironment.ts`
7. The system shall move `util/textCount.ts`・`util/object.ts`・`util/links.ts` to the利用元の領域 (`lib/share/`・`lib/atproto/`・`components/composer/ThreadComposer/rules/` の内側), because each of them has only one利用元の領域（grep による実測。brief の「汎用」の分類と異なるため、design で根拠を記録する）
8. The system shall keep the exported names and the behavior of every moved module unchanged
9. The system shall classify every module under `util/` by the four rules recorded in the design（型は `src/types/`、業務は `lib/`、ブラウザと DOM は `components/`、汎用は `util/`）, and shall record the classification of each module in the design

### Requirement 2: `util/share` の統合

**Objective:** As a 開発者, I want 共有の処理が一つの領域にまとまっていること, so that 同じ概念が二か所に分かれて見つけにくくなる状態を解消できる

#### Acceptance Criteria

1. The system shall move the pure parts of `util/share/`（`intent` の URL と本文の組み立て・`intentLength`・`truncateText`・`webShare` の文字列と File の組み立て）to `lib/share/`
2. When the pure parts and the browser parts of `util/share/` have been moved, the `lib/share/` shall contain the existing `counterReserve.ts` and `shareBody.ts` together with the moved modules, and no `util/share/` directory shall remain
3. If a moved module is used by `components/` の部品, then the system shall update that部品の import to `@/lib/share/...` and keep the部品 at its current location
4. The system shall keep the `lib/share` 領域 free of import cycles among its files and with `lib/settings`, including type-only imports
5. If `lib/settings` が `util/share` を参照している, then the system shall update that import to `lib/share`, and shall not leave an import cycle between `lib/share` and `lib/settings`（`lib/share` が `lib/settings` の型を参照している分は、`AutoPopupTarget` を `lib/share` へ移して解消する。design に記録する）
6. The system shall not place any module that performs a browser side effect（`window.open`・`navigator.share`）inside `lib/share`, and shall place the `window.open` の処理 and the `navigator.share` の処理 inside the `components/share/IntentShareDialog/` の内側（利用者の決定 U-1 の案 C）

### Requirement 3: `util/` に残すもの

**Objective:** As a 開発者, I want `util/` が汎用の関数だけを持つこと, so that `util/` を見れば、どの領域にも依存しない関数だけが分かる

#### Acceptance Criteria

1. When this spec is completed, the `util/` 直下 shall contain exactly the five modules used by two or more領域 (`http.ts`・`formData.ts`・`utf8Bytes.ts`・`padTwoDigits.ts`・`waitForImageLoad.ts`。grep による実測の結果であり、design で確認する。`util/outcome.ts` は型のみのモジュールのため、型の規則により `src/types/` へ移す)
2. The system shall keep the contents of the remaining 汎用 modules unchanged in this spec（`util/formData.ts` は、型 `FormDataFieldKind` を `src/types/` へ移すため、この規則の例外とし、関数は変えない）
3. When this spec is completed, `util/` shall contain no module whose利用元 is only one領域

### Requirement 4: `structure.md` の規約

**Objective:** As a 開発者, I want `util/` と `src/types/` に置く基準が文書で明記されていること, so that 新しい関数や型を置くときに、どこへ置くかを判断できる

#### Acceptance Criteria

1. When this spec is completed, the `structure.md` の `util/` の節 shall state the rule「利用元が複数領域のときだけ `util` に置く」
2. The `structure.md` shall state that a module whose利用元 becomes one領域 shall be moved to that領域 and shall not be returned to `util/`
3. When a module is moved out of `util/` or into `util/`, the `structure.md` shall be updated in the same change
4. The `structure.md` の `util/` の節 shall describe the rule in the same form that the `structure-checks` spec will enforce
5. The `structure.md` shall state the four classification rules（型は `src/types/`、業務は `lib/`、ブラウザと DOM は `components/`、汎用は `util/`）in the `util/` の節 or the adjacent section, and shall state the exception of `util/waitForImageLoad.ts`（DOM を使うが二つの部品領域が使うため `util/` に残す）
6. The `structure.md` shall state the `src/types/` rule（section「型（`src/types/`）」）as defined in Requirement 7

### Requirement 5: 振る舞いの不変

**Objective:** As a 運用者, I want 配置の移動で利用者に見える動作が変わらないこと, so that 安心して移動を進められる

#### Acceptance Criteria

1. The system shall keep all user-visible behavior, including screens, messages, and HTTP responses, unchanged from the state before this spec
2. When a module is moved or renamed, the system shall update the import paths of the affected code and tests in the same change, without changing the meaning of any test
3. The system shall keep the API input and output contract unchanged, so that `npm run apigen` produces no diff in the generated output
4. When this spec is completed, `npm run test:all` shall exit with code 0
5. When this spec is completed, the number of passed tests of `npm run test:all` shall be not less than the count recorded at the start of implementation (2026-11-03 baseline)

### Requirement 6: 関連 spec の記録

**Objective:** As a 開発者, I want 過去の share の結論が現在の配置と食い違わないこと, so that `src-duplicates` の記録を読んだ人が誤った場所へ向かわない

#### Acceptance Criteria

1. When this spec is completed, the `src-duplicates` の brief shall record that the share の責務 is integrated into `lib/share`（`util-placement` による）
2. The `src-duplicates` の brief shall keep its existing content and only append the record of this change

### Requirement 7: `src/types/` の新設

**Objective:** As a 開発者, I want 業務と部品が共に参照する型の置き場が一つあること, so that 型の定義が `util/` や部品の中に散らばらない

#### Acceptance Criteria

1. When this spec is completed, the `src/types/` shall exist and contain the `ClientEnvironment` 型 in `src/types/clientEnvironment.ts`、`Outcome` 型と `FailureStatus` 型 in `src/types/outcome.ts`、`FormDataFieldKind` 型 in `src/types/formData.ts`
2. When `lib` が使う型の定義が `util/` または `components/` にある場合（`ClientEnvironment`・`Outcome`・`FormDataFieldKind` を含む）, the system shall move that型 to `src/types/` and shall make `lib` and `components` import it from there
3. The `src/types/` の各ファイル shall contain type-level declarations only（`export type`・`export interface`・`import type`）, and shall import nothing from outside `src/types/` including external packages（`structure-checks` が検査する）
4. The system shall keep a type that is defined in `lib/` and used only by `components/` in `lib/`（`components` は `lib` を import してよいため。移動しない）
