# Structure: components（部品）

## 部品（`src/components/<領域>/<Name>/`）

**Location**: `src/components/<領域>/<Name>/`
**Purpose**: 1 部品 1 フォルダ。`index.tsx`（または `index.astro`）を置く。スタイルを持つ部品だけ `index.module.css` を置く（スタイルのない部品にファイルを増やさない）。
**Example**: `src/components/common/input/Checkbox/index.tsx` と `index.module.css`

- 領域は機能の単位で分ける: `composer`（投稿フォーム・下書き・予約の入力）、`timeline`（タイムラインと投稿の表示）、`share`（他 SNS への共有）、`entry`（Entry の一覧・操作）、`account`・`settings`・`feedback`・`schedule`・`image`・`help`・`privacy`。アンケート（`survey`）と動画（`video`）の部品は、利用する親の子に置く（下の「利用元の内側に置く」）。
- 画面全体で共有する部品は `common`（UI 部品）、`layout`（骨格）。骨格は `components/layout/Baselayout/` に置く（`layout/` の部品フォルダの一つ）。`src/layout/` を置かない（骨格は `components/layout/` の一箇所だけに置く）。`common/` には汎用の部品だけを置く（呼び出し側の文言と状態を受け取り、業務を持たない。例: `ChoiceQuestion`・`FloatingBox`・`NavigationBar`・`ThemeModeSelect`・`Loading`）。一つの業務に固有の部品（例: 投稿言語の一覧を持つ `LanguageSelect`）は、`common/` に置かず、その業務の親の子にする。
- `common/` の部品は、役割で分類フォルダに分ける。`dialog/`（重ねて表示する）・`select/`（選ぶ）・`input/`（値を入力・切り替える）・`list/`（一覧）・`media/`（画像・人の表示）・`section/`（開閉・切り替えるまとまり）。分類フォルダは部品を直接置かず、部品フォルダを置く。根には `Loading`・`InlineIcon`（複数の分類から使われる基盤）だけを置く。
- 翻訳の入口（表示言語のフック `useTranslation.ts`・リッチな文言の描画 `renderSlots.tsx`）は `i18n`。判断は `lib/i18n` に残し、React の入口だけを `components/i18n` に置く。
- 部品フォルダの外に置いてよいのは、翻訳の入口（上の `i18n`）と、`layout/nav/` の共有の処理（`navItems.ts`・`sync*.ts`。Sidebar と FooterNav が共有するため、どちらの子にもできない）だけである。それ以外の `.ts`・`.tsx`・`.astro` は部品フォルダの中に置く（`tests/unit/scripts/componentLayout.test.ts` が検査する）。
- フォルダ名とコンポーネント名は PascalCase。
- 部品の判断は同じフォルダの `camelCase.ts` に置く（例: `ThreadComposer/rules/segments.ts`）。フックは `useX.ts`。
- 判断の層（`rules/`）は部品を import しない。部品が使う型は `rules/` に置き、部品がそれを参照する（例: `ThreadComposer/rules/entries.ts`）。`rules/` の判断は純粋な関数に限る（例外: `common/dialog/Overlay/rules/scrollLock.ts` は `body` のスクロールロックのため DOM を使う。利用者の決定により `rules/` に置いた）。ブラウザの関数（`window.open`・`navigator.share`）を使う判断は、それを引数で受け取る（例: `ThreadComposer/rules/shareDispatch.ts` の `runShareDispatch`）。
- 部品の判断やフックが多いときは、部品フォルダの直下に子フォルダ `rules/`（判断）と `hooks/`（フック）を作り、そこにまとめてよい。直下には配線（`index.tsx` と `index.module.css`）と子フォルダだけを置く。
- 子フォルダの名前は小文字にする（部品フォルダの PascalCase と区別するため）。部品の子フォルダ（`ComposerOptions/` など）は、従来どおり PascalCase のままにする。
- **利用元の内側に置く**: 部品 P の利用元（P を import しているファイル）がすべて部品 H の中にあるとき、P は H の子フォルダ（`H/P/`）に置く（例: `composer/ThreadComposer/ImagePicker/`、`timeline/Timeline/ThreadCard/PostCard/`）。利用元が一つでも H の外（`pages/`・他の領域）にあるときは、領域の直下に置く。子の子も同じ規則で置く。`common/`・`layout/` の部品には、この規則を当てはめない（基盤）。部品フォルダの内側にあるブラウザ側の `.ts`（`openIntentPopup.ts`・`webShare.ts`）は、利用元が一つの部品に限らないとき `structure-shared.md` の「共通」の規則 (3) に従い、この規則より優先する。

### `src/components/` の領域

部品の領域（`components/<領域>` の形で書く）:

- `components/account`・`components/common`・`components/composer`・`components/entry`・`components/feedback`・`components/help`・`components/i18n`・`components/image`・`components/layout`・`components/privacy`・`components/schedule`・`components/settings`・`components/share`・`components/timeline`

領域を追加・削除したときは、この一覧を更新する（`tests/unit/scripts/steeringRegions.test.ts` が、実装と一覧の差を報告する）。

## 未解消の不一致（観察）

- 純粋関数を `src/components/` の中に置く例（`composer/ThreadComposer/rules/` の判断ファイル）と、`src/lib/` に置く例が混在する。新しい共通の判断は `src/lib/` に置く。

## 小さい部品領域の判断

小さい部品領域（`share`・`feedback`・`privacy`・`help`）を、統合するか残すかの判断。判断は下の統合の条件から導き、判断の時点の利用元を表に残す。判断は配置だけを対象とし、部品の内部は変えない。

### 統合の条件

部品 P を親 H の子フォルダ（`H/P/`）へ統合するのは、P のすべての利用元が H の部品フォルダの内側にあるときだけ。次のどちらかに当たるときは統合せず、領域の直下に残す。

- 利用元が二つ以上の親にまたがる。
- 利用元に `src/pages/` のファイルを含む。

### 判断の表

| 領域       | 部品                                   | 利用元                                                         | 判断       | 理由                                         |
| ---------- | -------------------------------------- | -------------------------------------------------------------- | ---------- | -------------------------------------------- |
| `share`    | `IntentShareDialog`                    | `composer/ThreadComposer`（3 件）・`timeline/Timeline`（3 件） | 残す       | 利用元が二つの親にまたがる                   |
| `feedback` | `FeedbackForm`                         | `pages/feedback.astro`                                         | 残す       | 利用元が `pages/` のみ。統合先の親がない     |
| `privacy`  | `PolicyCards`                          | `pages/privacy.astro`                                          | 残す       | 同上                                         |
| `help`     | `Help`（`HelpItem` は内側）            | `pages/help.astro`・`Help/HelpItem`                            | 残す       | 利用元に `pages/` を含む                     |
| `i18n`     | `useTranslation.ts`・`renderSlots.tsx` | 多数                                                           | 移動しない | 翻訳の入口（多数の部品が使う入口であること） |

判断の時点は 2026-11-04 の実測。

## `common/` へ移さない理由

`common/` は業務を持たない汎用の部品だけを置く。上の四つは特定の業務（共有・不具合の報告・プライバシーポリシー・ヘルプ）に固有の内容を持つため、`common/` へ移さない。`pages/` へ移すことも、`pages/` は薄い入口だけを持つ規約に反するため、しない。

## 再検討の条件

- 利用元が一つの親の部品フォルダの内側にまとまったとき（統合を検討する）。
- 利用元に新しい親や `src/pages/` のファイルが加わった、または減ったとき（条件を当てはめ直す）。
- 判断を変えて部品を移動するときは、import とテストのパスを同じ変更で更新する。

---

_updated_at: 2026-11-08_
