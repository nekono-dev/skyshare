# プルダウン（Dropdown）自前実装 タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[FE]` フロントエンド / `[TEST]` テスト

## Phase 1: 純粋関数（util / lib）

- [x] `[FE]` `src/util/emoji/countryFlag.ts` を新設する（design.md §6.1）。
- [x] `[FE]` `src/lib/atproto/languageFlag.ts` を新設し、`BLUESKY_POST_LANGUAGES` の全コードを §6.2 のルールで代表国に対応づける。
- [x] `[FE]` `src/util/listbox/navigation.ts`（`nextEnabledIndex`/`firstEnabledIndex`/`lastEnabledIndex`/`indexOfEnabled`/`findPrefixIndex`）を新設する（§5.5）。
- [x] `[FE]` `src/util/listbox/filter.ts`（`normalizeForSearch`/`filterOptions`）を新設する（§5.6）。
- [x] `[TEST]` `tests/util/emoji/countryFlag.test.ts`・`tests/lib/atproto/languageFlag.test.ts`・`tests/util/listbox/navigation.test.ts`・`tests/util/listbox/filter.test.ts`（design.md §8 の観点）。
- [x] 検証: `npx tsc --noEmit` と上記 `vitest` が通る。

## Phase 2: フローティング基盤と選択肢行の共通化

- [x] `[FE]` `FloatingBox` に `style` prop を追加する。（Phase 5.7 で `Dropdown` が `FloatingBox` を使わなくなったため、この追加は取り消した。）
- [x] `[FE]` `src/components/common/ListboxOption/`（`index.tsx`・`index.module.css`）を新設する（§4）。
- [x] `[FE]` `SuggestPopover` の行描画を `ListboxOption` へ移行し、移した CSS（`.option`/`.option-active`）を `SuggestPopover/index.module.css` から削除する。
- [x] 検証: `npx tsc --noEmit` が通り、既存 `vitest` が全て通る。
- [x] `[TEST]` Playwright（既存 `tests/e2e/threadComposer.spec.ts` のメンション/ハッシュタグ候補に関するシナリオ。無い場合は `tests/e2e/suggestPopover.spec.ts` を新設）:
  1. `/post/?guest` の本文欄で `#` を入力 → 候補パネルが表示され、1件目がハイライトされる。
  2. ↓ を押す → ハイライトが2件目へ移る。
  3. 候補をクリック → 本文に `#タグ ` が挿入され、本文欄がフォーカスを保持している。
  4. Esc → パネルが閉じる。

## Phase 3: Dropdown 本体

- [x] `[FE]` `src/components/common/Dropdown/`（`index.tsx`・`index.module.css`）を新設する（§2、§5）。位置決め（§5.2）、スクロール追従（§5.3）、開閉（§5.4）、キーボード（§5.5）、絞り込み（§5.6）、ARIA（§5.7）、描画（§5.8）。
- [x] `[FE]` `src/components/common/README.md` に `Dropdown`/`ListboxOption` と依存関係図を追記する。
- [x] `[TEST]` `tests/e2e/dropdown.spec.ts` を新設する。検証対象は Phase 4 で置き換える `ThemeModeSelect`（`/settings/`）と `LanguageSelect`（`/post/?guest`）のため、Phase 4 完了後に下記シナリオを実行する。
- [x] 検証: `npx tsc --noEmit`、`npm run build`（SSG で例外が出ないこと）が通る。

## Phase 4: 既存4種の置き換えと国旗

- [x] `[FE]` `ThemeModeSelect`・`PageSizeSelect`・`SelfLabelsSelect` を `Dropdown` のラッパーに置き換える（§7）。
- [x] `[FE]` `LanguageSelect` を `Dropdown`（`searchable`）のラッパーに置き換え、国旗付き選択肢を定義する（§6.3）。
- [x] `[FE]` 4ラッパーの Props から `name` を除き、呼び出し側（`ThreadSegmentForm`・`SettingList`・`EntryList` ほか）の `name` 指定を削除する。
- [x] `[FE]` 各ラッパーの `index.module.css` から不要になった `<select>` 用スタイルを削除する。`src/styles/input.ui.module.css` の `.select-sizer` など、不要になったクラスがあれば削除する。
- [x] `[FE]` `src/components/common/README.md`・`src/components/post/README.md` のコンポーネント説明を更新する。
- [x] 検証: `grep -rn "<select" src` が 0 件、`npx tsc --noEmit`、全 `vitest` が通る。
- [x] `[TEST]` Playwright（`tests/e2e/dropdown.spec.ts`）:
  1. `/settings/` の表示テーマのトリガーをクリック → パネルに「システム設定に従う」「ライト」「ダーク」が表示され、現在値に選択中の強調がある。「ダーク」をクリック → パネルが閉じ、トリガー表示が「ダーク」になり、トリガーにフォーカスが戻る。
  2. トリガーにフォーカスして Enter → 開く。↓ → Enter → 次の項目が確定される。Esc で開いて閉じるとき、値は変わらない。
  3. パネルを開いたまま、パネル外をクリック → 閉じる。値は変わらない。
  4. `/post/?guest` の投稿言語のトリガーをクリック → 絞り込み入力欄にフォーカスは移らず、placeholder「入力して検索」が出ている。トリガーにフォーカスしたまま `k` `o` を押すと入力欄に「ko」が入り絞り込まれる。一覧が縦スクロール可能（`scrollHeight > clientHeight`）で、パネルがビューポート内に収まる（`boundingBox` が `innerHeight` 以内）。
  5. 一覧をスクロールしてもパネルは閉じない。ページ（ウィンドウ）をスクロールすると閉じる。
  6. 入力欄に `ko` を入力 → 「한국어」を含む項目に絞り込まれ、先頭がアクティブ。クリックで確定 → トリガーに🇰🇷と「한국어」が表示される。
  7. 入力欄に存在しない文字列を入力 → 「該当する項目がありません」が表示され、Enter を押しても何も確定せずパネルは開いたまま。
  8. 日本語IME変換中（`compositionstart` を dispatch した状態）の Enter では確定されない。
  9. 言語を開き直す → 入力欄は空で、選択中の言語が一覧内に見える位置にスクロールされている。
  10. 「Esperanto」（国旗なし）を選択 → トリガーに国旗が出ない。一覧内では、国旗あり/なしの項目のラベルの左端が揃う。
  11. 投稿言語のトリガーを画面下端に近い位置（`page.setViewportSize` で高さを小さくする）で開く → パネルがトリガーの上に表示され、ビューポート内に収まる。
  12. 自己ラベルで「ラベルなし」を選択 → トリガーに「ラベルなし」相当の表示となり、他のラベルを選んだ後にも再度選べる。
  13. 表示件数（`PageSizeSelect`）: 画面から到達できない（EntryList の paged 分岐はデッドコード）ため E2E 対象外。`PaginationModeSelect`（同じく未使用）も同様にラッパー化済み。
  14. 無効状態のプルダウン（`disabled`）をクリック → 開かない。
- [ ] 手動確認: Windows 実機での国旗絵文字（2文字の国コード表記になる）と、スクリーンリーダーでの読み上げ（現在値・開閉・選択項目）。

## Phase 5: 検索トリガー方式への変更（検索付きはトリガー自身が入力欄）

対応: requirements.md FR-5、design.md §2・§5.1・§5.4〜§5.9・§6.3。

- [x] `[FE]` `DropdownOption` に `inputText`、Props に `searchPlaceholder`・`searchPromptText` を追加する（§2）。
- [x] `[FE]` `Dropdown` から、パネル内の絞り込み入力欄（`searchRef`・`<input role="searchbox">`）と、パネル内操作ガード（`interactionGuardUntilRef`・`onMouseDownCapture`）、キーボード用余白の事前見込み（`KEYBOARD_RESERVE_RATIO`）を削除する。
- [x] `[FE]` `searchable` のトリガーを `<input role="combobox">`（一覧モードも編集可能な入力欄のまま `inputMode="none"`）にし、`mode`（`list`/`search`）・`enterSearch`・`close` の入力破棄・§5.5 のキー処理・§5.6 の入力処理を実装する。検索モードの空入力は `searchPromptText`、0件は `emptyText` を出す。
- [x] `[FE]` `handleDismiss` を「検索モードの間は閉じず再配置」に変更する（§5.4）。
- [x] `[FE]` `ui["select-wrapper-auto"] > input` を対象に加える。`.trigger` を `input` でも同じ外観にする。
- [x] `[FE]` `LanguageSelect` を `inputText`（国旗+ラベル）方式へ変更し、`triggerContent` を除く（§6.3）。
- [x] `[FE]` `common/README.md`・`Dropdown` 先頭コメントを更新する。
- [x] 検証: `npx tsc --noEmit`、`npm run build`、全 `vitest` が通る。
- [x] `[TEST]` Playwright（`tests/e2e/dropdown.spec.ts` の言語選択シナリオを置き換え・追加）:
  1. `/post/?guest` の投稿言語のトリガーをクリック → パネルが一覧モードで開き、一覧が表示される。トリガーは `inputmode="none"` のテキストボックスで、`🇯🇵 日本語` を表示している。
  2. パネルを開いたままトリガーを再クリック → パネルは閉じず、トリガーは空で placeholder「入力して検索」を表示する。パネルの一覧は選択肢が無く「入力して検索してください」を表示する（`role=status`）。トリガーにフォーカスがあり、`inputmode="text"`。
  3. `ko` を入力 → 「한국어」を含む項目に絞り込まれ、先頭がアクティブ。クリックで確定 → パネルが閉じ、トリガーに `🇰🇷 한국어` が表示される。
  4. 検索モードで存在しない文字列を入力 → 「該当する項目がありません」が表示される。Enter を押しても何も確定せず、パネルは開いたまま。Esc で閉じる → トリガーは直前の選択項目（`🇯🇵 日本語` など）に戻る。
  5. 検索モードでパネル外クリック → 閉じ、トリガーは直前の選択項目に戻る。
  6. 一覧モードで開いたまま `k` `o` をキー入力 → 検索モードに入り、トリガーに「ko」が入って絞り込まれる。
  7. 検索モードで `window` の `resize`・`scroll` を発火 → パネルは閉じない。一覧モード（トリガー未入力）でのスクロールでは閉じる。
  8. 開き直す → 一覧モード・入力は空に戻り、選択中の言語が一覧内に見える位置にある。
  9. パネルの幅は一覧モード・検索モード・絞り込み後で変わらず、閉じて開き直しても同じ。
  10. 日本語IME変換中（`compositionstart` 後の `isComposing` な Enter）では確定されない。
  11. 検索モードでトリガーの `blur`（iOS のキーボード完了相当）→ 入力が空なら一覧モードへ戻りパネルは開いたまま。入力済みなら入力と絞り込み結果が残り、その後のスクロールで閉じて入力は破棄される。
  12. 画面下端付近で開く → トリガーの上に反転して開き、ビューポート内に収まる。
- [x] 手動確認: iOS Safari 実機で、画面のスクロール位置が最上部のとき、1回目のタップで一覧モード（キーボード無し）、再タップで検索モード（キーボード表示）になり、パネルがトリガーの隣に留まること。

## Phase 5.5: 表示行数の制限（最大5行）

対応: requirements.md FR-3、design.md §5.2。

- [x] `[FE]` 一覧の最大高さを、固定の320pxから「sizer の先頭5行の実高さの合計」へ変更する。
- [x] `[TEST]` Playwright: 投稿言語を開いたとき、一覧内で完全に見える行が5行以下（4行以上）であること。表示テーマ（3件）はスクロールしないこと。
- [x] 検証: `npx tsc --noEmit`、Dropdown/Suggest の E2E が通る。

## Phase 5.6: スクロール中の一時非表示と静止後の再表示

対応: requirements.md FR-5、design.md §5.4。

- [x] `[FE]` 検索モード（入力欄フォーカス中）・開いた直後のスクロール/リサイズ中はパネルを不可視にし、静止後に再配置して再表示する（`suspendUntilSettled`）。`visualViewport` の変化も同様に扱う。
- [x] `[TEST]` Playwright: 検索モードで `scroll` を連続発火し続ける間、パネルが不可視になる。止まったら再表示され、入力（ko）と絞り込み結果が保たれ、パネルがトリガーの隣にある。
- [x] `[FE]` 位置計算の基準（`anchorKey`）を記録し、開いている間は毎フレーム実測値と比較して、変化したら再配置する。
- [x] `[TEST]` Playwright: スクロールイベントなしでトリガーが動いても、パネルがトリガーの直下/直上へ追従する。
- [ ] 手動確認: iOS Safari 実機で、キーボード表示中にスクロールしても表示が崩れず、止まると再表示されること。

## Phase 5.7: パネルを絶対配置へ変更（フローティングをやめ、ブラウザに追従させる）

対応: requirements.md FR-1・FR-2、design.md §3・§5.2・§5.4・§5.8。検証用サンプル（A〜D）の iOS 18 での結果に基づき、D 方式（A + 祖先の overflow 解除 + 親の範囲で向き・高さを決定）を採用した。

- [x] `[FE]` `Dropdown` から `FloatingBox` を外し、パネルを外枠（`.select-wrapper`）内の `position:absolute` にする。JS の座標計算・隠す/再表示（suspend）・毎フレーム追従・`visualViewport` リスナー・パネル内操作ガードを削除する。
- [x] `[FE]` 開いた直後に一度だけ、向き（上下）・横揃え・一覧の最大高さを決める（範囲は `visualViewport` と祖先のスクロール枠の共通部分）。
- [x] `[FE]` `ui.module.css` に、`data-dropdown` を持つ要素と祖先の `overflow` を解除する規則を追加する。
- [x] `[TEST]` Playwright: スクロール・リサイズで閉じず、パネルがトリガーに付いてくる。親の overflow で切れない（表示テーマ・投稿言語・自己ラベルで、パネルの四隅・中央の最前面要素がパネル自身であること。解除規則を外すと失敗することを確認済み）。
- [x] 検証: `npx tsc --noEmit`、Dropdown/Suggest の E2E が通る。
- [ ] 手動確認: iOS Safari 実機で、キーボード表示中のスクロールでもパネルがトリガーに付いてくること、本番画面（投稿フォーム・設定・モーダル内）で見切れないこと。

## Phase 6: 仕上げ

- [x] `[FE]` 全 `vitest`・`npx tsc --noEmit`・`npm run build`・既存の Playwright 全スイートが通る。
- [x] `[FE]` 追加・変更したコードが AGENTS.md のコメント規定（ファイル先頭の責務、関数ごとの目的/Input/Output/Example）を満たすことを確認する。
