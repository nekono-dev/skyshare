# 他SNSへの共有（intentshare）タスク

## Phase 1: 字数省略ユーティリティ

- [x] `src/util/share/truncateText.ts`を実装する（`weightedLength` / `truncateBodyWithSuffix` / `INTENT_WEIGHTED_LIMIT`）
- [x] `src/util/share/intent.ts`の`buildIntentText`に`truncateLimit`を追加し、`resolveTruncateLimit`を実装する
- [x] `tests/util/share/truncateText.test.ts`、`tests/util/share/intent.test.ts`を用意する

完了確認: `npx vitest run tests/util/share` が全件成功し、省略結果の`weightedLength`が常に280以下であること。

## Phase 2: 設定値と旧設定の引き継ぎ

- [x] `shareSettings.ts`に`AutoPopupTarget`・`readAutoPopupTargetSetting` / `writeAutoPopupTargetSetting`・`truncateIntentText`の読み書き・`resolveMastodonInstanceDomain`を実装し、旧設定（自動ポップアップOFF・クロスポスト・X投稿ボタン表示）の読み書き関数を削除する
- [x] `legacyShareSettings.ts`（`deriveAutoPopupTarget` / `migrateLegacyShareSettings`）を実装し、`readAutoPopupTargetSetting`の先頭から呼ぶ
- [x] `shareTogglesReducer.ts`とそのテストを削除する
- [x] `useShareToggles.ts`を設計2.3の構成へ作り直す
- [x] `tests/lib/settings/legacyShareSettings.test.ts`、`tests/lib/settings/shareSettings.test.ts`を追加する

完了確認: `npx vitest run tests/lib/settings` が全件成功すること。`npx tsc --noEmit`で型エラーがないこと。

## Phase 3: 投稿直後の共有処理

- [x] `shareDispatch.ts`の引数・戻り値・処理フローを設計4に沿って実装する
- [x] `tests/components/post/ThreadComposer/shareDispatch.test.ts`を設計4.2の全分岐の条件網羅にする

完了確認: `npx vitest run tests/components/post/ThreadComposer` が全件成功すること。

## Phase 4: UI（プルダウン・ダイアログ・フォーム・設定ページ・i18n）

- [x] `AutoPopupTargetSelect`を実装する
- [x] `IntentShareDialog`に`keepOpenOnSelect`とMastodonドメイン不正時の無効化を実装する
- [x] `ThreadComposer/index.tsx`・`PostLauncher/index.tsx`を設計7に沿って実装する（プルダウン表示、手動ボタンと旧トグルの削除、事前ポップアップの条件、ダイアログの委譲）
- [x] `Settings/index.tsx`を設計8に沿って実装する
- [x] i18nのja/enを設計9に沿って更新する
- [x] `ThreadComposer/spec.submitButton.md`を本設計の挙動に合わせる
- [x] `npm run codegen`が不要であること（APIスキーマ変更なし）を確認する

完了確認:

- `npx tsc --noEmit`、`npx vitest run`、`npm run build`が成功すること。
- Playwrightで以下のシナリオを確認し、`tests/e2e/intentShare.spec.ts`として恒久化する（ゲスト表示での投稿フローを使用する）。
  1. 「WebShareの代わりにポップアップを開く」がOFFのとき、投稿フォームと設定ページに「自動ポップアップするSNS」プルダウンが無い。ONにすると、投稿フォームでは「詳細オプション」内の先頭に、設定ページでは直下に表示され、選択値がリロード後も保持される。いずれの選択値でも、詳細オプションは初期状態で閉じている（長文省略・固定表示しないがOFFの場合）。
  2. 選択値が「投稿時に選択する」で投稿すると、ポップアップは開かず投稿先選択ダイアログが開き、入力欄が空になる。
  3. 選択値が「タイッツー」で投稿すると、タイッツーのintent URLのポップアップが開き、ダイアログは開かない。
  4. 投稿後のダイアログで「X に投稿」を選んでもダイアログが閉じず、続けて「タイッツーに投稿」を選べる。「閉じる」・背景クリック・Escで閉じる。
  5. 投稿フォームを固定表示しない設定（Overlay表示）でも、投稿成功でOverlayが閉じた後にダイアログが残り、投稿先を続けて選べる。
  6. タイムラインのPostCardの共有ダイアログは、投稿先を選択するとポップアップを開いて閉じる。末尾にskyshare entry URLが付き、`text`の重み付き長が280以下である。
  7. 「長文を省略して共有」と「返信・引用オプションを保存する」が詳細オプション内に（長文省略、返信・引用、固定表示しないの順で）表示され、設定がリロード後も保持される。「画像を自分で添付」をONにすると省略がOFFかつ操作不能になり、保存値もOFFになる。OFFへ戻しても省略はOFFのまま。保存値が競合している場合は読み込み時にOFFへ補正される。
  8. 設定ページに「自動ポップアップをOFFにする」「タイッツーにクロスポスト」「Mastodonにクロスポスト」「X投稿ボタンを表示」が存在せず、Mastodonのインスタンス入力欄が常時表示される。
  9. 旧設定のうち`crosspostToTaittsuu=true`のみ（`popupIntentInsteadOfWebshare=true`）をlocalStorageに用意してページを開くと、プルダウンが「タイッツー」になり、旧キーが削除されている。`crosspostToTaittsuu=true`と`showCrosspostXButton=true`の2つがONの場合は「投稿時に選択する」になる。`noAutoPopupAfterPost=true`のみの場合は「X」になる。
- 長文の本文を省略する実動作は、`tests/util/share`の単体テストで網羅する。ゲスト表示ではskyshare entryを新規作成する投稿ができないため、E2Eでは省略結果の文字列までは検証しない。
- ログイン済み実アカウントでの実投稿（Blueskyへの投稿と、skyshare entry URL付きのX/タイッツーへの実共有）は自動化できないため、手動で確認する。手順: 長文の画像投稿を行い、ダイアログからXを選び、省略後の共有文が投稿画面に入ることを目視する。

## Phase 5: 文字数カウンタの上限補正とタイッツー換算（R18・R33〜R37）

- [x] `src/util/share/intentLength.ts`を実装し、`truncateText.ts`・`intent.ts`・`shareDispatch.ts`を宛先別換算に対応させる
- [x] `src/lib/entry/estimateEntryUrl.ts`を実装する
- [x] `src/lib/share/counterReserve.ts`を実装する
- [x] `ThreadSegmentForm`・`ThreadComposer`のカウンタを設計3.4に沿って変更する（3カウンタ表示を含む）
- [x] i18n（タイッツーのカウンタラベル）、`spec.submitButton.md`、各READMEを更新する
- [x] 単体テスト・E2Eを追加する

完了確認: `npx tsc --noEmit`、`npx vitest run`、`npm run build`が成功すること。
