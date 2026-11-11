# 実装計画

作業はグループ単位で直列に行う（`(P)` は付けない）。理由: 全グループが許容リスト `config/comments/allowlist.json` を共有し、並列に編集すると衝突するため。グループの対象ファイルは `research.md` の「グループとファイル」に置く。段階の完了条件（検査・許容リストの整理・コメントだけの差分・単体テスト・経緯の語の確認）は `design.md` の「段階の完了条件」に従う。

前提: 先行 spec は comment-policy（基準・検査・許容リストの仕組み）で、未実装の間はこの計画を実行しない（`spec.json` の `ready_for_implementation` は false）。comments-* の spec 同士も共有の許容リストを使うため、並列にせず直列に実行する。

- [x] 1. G1 common（`src/components/common/**`）のコメントを書き直し、検査を通す
- [x] 1.1 common の部品のコメントを書き直す
  - 許容リストの 19 件のファイル（dialog・input・list・media・section・select と `Loading`）の先頭ヘッダと、コメントの行を、基準に従って書き直す
  - 書き直した内容が、対応するコードの現在の振る舞いと一致している
  - 判別に迷うコメントは残し、完了の報告に挙げる
  - 完了の条件: common のファイルに、禁止パターンと先頭ヘッダの違反が無く、コードの行が変わっていない
  - _Boundary: G1 common_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 1.2 G1 の段階の完了を確かめ、許容リストの項目を消す
  - 検査の出力のうち common のパスに当たる項目が 0 件であることを確かめる
  - 許容リストから、common のパスで所有が `comments-components-pages` の項目を消す（他の所有の項目は消さない）
  - common のディレクトリの `git diff` の変更行が、コメントの行と空行だけであることを確かめる
  - `commentRules.test.ts` が通過し、CSS（common の子の `.css`）の禁止パターンと経緯の語の検索で残りが無い、または残した理由が報告に挙がっている
  - _Boundary: G1 common, 許容リスト_
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2_

- [x] 2. G2 composer の中心（`ThreadComposer/index.tsx`・`hooks/`・`rules/`）のコメントを書き直し、検査を通す
- [x] 2.1 ThreadComposer の中心・hooks・rules のコメントを書き直す
  - 許容リストの 15 件（`index.tsx`・`hooks/` の 6 件・`rules/` の 8 件）の先頭ヘッダと、コメントの行を書き直す
  - `rules/` の判断は、純粋な関数の意図と、その理由（境界の扱い・順序の制約）を書く。関数の使い方のうち、シグネチャから分からないこと（単位・境界値・失敗のしかた）を残す
  - 書き直した内容が、対応するコードの現在の振る舞いと一致している
  - 完了の条件: これらのファイルに違反が無く、コードの行と `eslint-disable-next-line` の行が変わっていない
  - _Boundary: G2 composer core_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 2.2 G2 の段階の完了を確かめ、許容リストの項目を消す
  - 検査の出力のうち `src/components/composer/ThreadComposer/` の直下・`hooks/`・`rules/` に当たる項目が 0 件であることを確かめる
  - 許容リストから、これらのパスで所有が `comments-components-pages` の項目を消す
  - `git diff` の変更行（上の 2.1 の範囲）が、コメントの行と空行だけであることを確かめる
  - `commentRules.test.ts` が通過し、経緯の語の検索の残りを判断して報告に挙げる
  - _Boundary: G2 composer core, 許容リスト_
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2_

- [x] 3. G3 composer の子部品（`PostGateDialog`・`ThreadComposer` の子）のコメントを書き直し、検査を通す
- [x] 3.1 ThreadComposer の直下の子部品（dialog・option・picker・list・button）のコメントを書き直す
  - 対象: `PostGateDialog`・`ComposerDialogs`・`ComposerOptions`・`ImageAltDialog`・`ImageCropDialog`（`CropSlot` を含む）・`ImagePicker`・`OgpFetchButton`・`RunAtPicker`・`ScheduleList`（許容リストの 11 件）
  - 先頭ヘッダと、コメントの行を基準に従って書き直す。部品の配置は変えない
  - 完了の条件: これらのファイルに違反が無く、コードの行が変わっていない
  - _Boundary: G3 composer children_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 3.2 ThreadSegmentForm の子部品のコメントを書き直す
  - 対象: `ThreadSegmentForm/` の直下の `index.tsx` と、子の `LanguageSelect`・`OgpPreview`・`PostBodyEditor`・`SuggestPopover`・`ThumbnailAdjustButton`・`VideoPicker`（許容リストの 7 件）
  - `PostBodyEditor` の `eslint-disable-next-line` の行は変えない
  - 完了の条件: これらのファイルに違反が無く、コードの行と機械指示の行が変わっていない
  - _Boundary: G3 composer children_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 3.3 G3 の段階の完了を確かめ、許容リストの項目を消す
  - 検査の出力のうち `src/components/composer/` の残りのパス（上の 3.1・3.2 の範囲）に当たる項目が 0 件であることを確かめる
  - 許容リストから、これらのパスで所有が `comments-components-pages` の項目を消す（G2 の項目は、2.2 で消し済みであること）
  - `git diff` の変更行が、コメントの行と空行だけであることを確かめる
  - `commentRules.test.ts` が通過し、`src/components/composer/` の CSS と経緯の語の検索の残りを判断して報告に挙げる
  - _Boundary: G3 composer children, 許容リスト_
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2_

- [x] 4. G4 timeline（`src/components/timeline/**`）のコメントを書き直し、検査を通す
- [x] 4.1 PostBody・PostRichText のコメントを書き直す
  - 対象: `timeline/PostBody/` の配下（`PostEngagementStats`・`PostLinkCard`・`PostQuote`・`VideoPlayButton`・`VideoPlayer`・`VideoThumbnail`・`VideoUnavailable` と `index.tsx`）と `PostRichText/index.tsx`（許容リストの 9 件）
  - 完了の条件: これらのファイルに違反が無く、コードの行が変わっていない
  - _Boundary: G4 timeline_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 4.2 Timeline の残り（PostLauncher・SurveyGate・ThreadCard・PostCard）のコメントを書き直す
  - 対象: `timeline/Timeline/` の配下（`PostLauncher`・`SurveyGate/` と `SurveyDialog/`・`ThreadCard/` と `PostCard/`・`PostCardEntryActions/`・`useSkyshareEntryStatus.ts`・`useWebShareCrosspost.ts`・`index.tsx`）（許容リストの 9 件）
  - 投稿カードの Entry 操作と共有の判断は、現在の挙動を書く（経緯・旧の扱いは残さない）
  - 完了の条件: これらのファイルに違反が無く、コードの行と機械指示の行が変わっていない
  - _Boundary: G4 timeline_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 4.3 G4 の段階の完了を確かめ、許容リストの項目を消す
  - 検査の出力のうち `src/components/timeline/` に当たる項目が 0 件であることを確かめる
  - 許容リストから、`src/components/timeline/` のパスで所有が `comments-components-pages` の項目を消す
  - `git diff` の変更行が、コメントの行と空行だけであることを確かめる
  - `commentRules.test.ts` が通過し、`src/components/timeline/` の CSS と経緯の語の検索の残りを判断して報告に挙げる
  - _Boundary: G4 timeline, 許容リスト_
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2_

- [x] 5. G5 account・entry・image・schedule（`src/components/` の 4 領域）のコメントを書き直し、検査を通す
- [x] 5.1 account・entry・image・schedule の部品のコメントを書き直す
  - 対象: `account/`（3 件）・`entry/`（8 件、`EntryDetailView/index.astro` を含む）・`image/`（2 件）・`schedule/`（4 件、`useScheduleAvailability.ts` を含む）（許容リストの 17 件）
  - 予約（`schedule/`）の認可と資格情報の扱いは、現在の仕組みと理由を書く（日付・経緯を残さない）
  - 完了の条件: これらのファイルに違反が無く、コードの行が変わっていない
  - _Boundary: G5 account-entry-image-schedule_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 5.2 G5 の段階の完了を確かめ、許容リストの項目を消す
  - 検査の出力のうち `src/components/account/`・`entry/`・`image/`・`schedule/` に当たる項目が 0 件であることを確かめる
  - 許容リストから、これらのパスで所有が `comments-components-pages` の項目を消す
  - `git diff` の変更行が、コメントの行と空行だけであることを確かめる
  - `commentRules.test.ts` が通過し、これらの領域の CSS と経緯の語の検索の残りを判断して報告に挙げる
  - _Boundary: G5 account-entry-image-schedule, 許容リスト_
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2_

- [x] 6. G6 settings・share・feedback・help・privacy・i18n・layout のコメントを書き直し、検査を通す
- [x] 6.1 layout・i18n・settings・share・feedback のコメントを書き直す
  - 対象: `layout/`（`Baselayout`・`FooterNav`・`NavIcon`・`Sidebar` の `.astro` と、`nav/` の 4 件の `.ts`）・`i18n/useTranslation.ts`・`settings/`（`SettingList`・`Settings` と `useShareToggles.ts`）・`share/IntentShareDialog/`（2 件）・`feedback/FeedbackForm/`（2 件）（許容リストの 16 件）
  - `nav/` の共有の処理（`navItems.ts`・`sync*.ts`）は、Sidebar と FooterNav が共有する理由を書く
  - 完了の条件: これらのファイルに違反が無く、コードの行が変わっていない
  - _Boundary: G6 settings-share-layout_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 6.2 G6 の段階の完了を確かめ、許容リストの項目を消す
  - 検査の出力のうち `src/components/settings/`・`share/`・`feedback/`・`help/`・`privacy/`・`i18n/`・`layout/` に当たる項目が 0 件であることを確かめる
  - 許容リストから、これらのパスで所有が `comments-components-pages` の項目を消す
  - `git diff` の変更行が、コメントの行と空行だけであることを確かめる
  - `commentRules.test.ts` が通過し、これらの領域の CSS（`help`・`privacy` を含む）と経緯の語の検索の残りを判断して報告に挙げる
  - _Boundary: G6 settings-share-layout, 許容リスト_
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2_

- [x] 7. G7 画面の入口（`src/pages/*.astro`・`entries/`・`posts/`）のコメントを書き直し、検査を通す
- [x] 7.1 画面の `.astro` のコメントを書き直す
  - 対象: `accounts.astro`・`feedback.astro`・`help.astro`・`jump.astro`・`privacy.astro`・`entries/[slug].astro`・`entries/index.astro`・`entries/sample.astro`・`posts/[dbIndex]/[slug].astro`（許容リストの 9 件）
  - `entries/sample.astro` は確認用のページ。削除の予定に関する記述は、現在の扱い（残している）として書く
  - 完了の条件: これらのファイルに違反が無く、Astro のフロントマター（`---`）と HTML のコメントの行が、必要なものを除いて変わっていない
  - _Boundary: G7 pages-astro_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 7.2 G7 の段階の完了を確かめ、許容リストの項目を消す
  - 検査の出力のうち `src/pages/` の `.astro` のパスに当たる項目が 0 件であることを確かめる
  - 許容リストから、これらのパスで所有が `comments-components-pages` の項目を消す
  - `git diff` の変更行が、コメントの行と空行だけであることを確かめる
  - `commentRules.test.ts` が通過し、`src/pages/` の `.astro` の経緯の語の検索の残りを判断して報告に挙げる
  - _Boundary: G7 pages-astro, 許容リスト_
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2_

- [x] 8. G8 API の入口（`src/pages/oauth/`・`v1/`・`v2/`）のコメントを書き直し、検査を通す
- [x] 8.1 oauth・v1・v2 の bsky・entries・entry・feedback のコメントを書き直す
  - 対象: `oauth/`（3 件）・`v1/page.ts`・`v2/bsky/`（`drafts`・`images`・`session`・`session/[did]`・`session/authorization`・`session/authorization/completion`・`video/upload-token`）・`v2/entries.ts`・`v2/entries/skyshare.ts`・`v2/entry.ts`・`v2/feedback.ts`（許容リストの 15 件）
  - 認証・Cookie・OAuth の判断は、現在の仕組みと理由を書く（旧の方式・経緯を残さない）
  - 完了の条件: これらのファイルに違反が無く、コードの行が変わっていない
  - _Boundary: G8 pages-api_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 8.2 v2 の schedules・surveys のコメントを書き直す
  - 対象: `v2/schedules.ts`・`v2/schedules/[id].ts`・`v2/schedules/[id]/images/[index].ts`・`v2/schedules/credential.ts`・`v2/schedules/credential/authorization.ts`・`v2/schedules/credential/authorization/completion.ts`・`v2/schedules/limits.ts`・`v2/surveys/[surveyId]/answers.ts`・`v2/surveys/[surveyId]/respondent.ts`（許容リストの 9 件）
  - アンケートの匿名性と保持期限の記述は、現在の仕組みと理由だけを書く（日付入りの決定を残さない）
  - 完了の条件: これらのファイルに違反が無く、コードの行が変わっていない
  - _Boundary: G8 pages-api_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 8.3 G8 の段階の完了を確かめ、許容リストの項目を消す
  - 検査の出力のうち `src/pages/oauth/`・`v1/`・`v2/` に当たる項目が 0 件であることを確かめる
  - 許容リストから、これらのパスで所有が `comments-components-pages` の項目を消す
  - `git diff` の変更行が、コメントの行と空行だけであることを確かめる
  - `commentRules.test.ts` が通過し、これらのパスの経緯の語の検索の残りを判断して報告に挙げる
  - _Boundary: G8 pages-api, 許容リスト_
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2_

- [x] 9. G9 共通の入口・型・ユーティリティ・CSS（`src/` 直下・`types/`・`util/`・`styles/`・`global.d.ts`）のコメントを書き直す
- [x] 9.1 `src/` 直下・`util/` のコメントを書き直す
  - 対象: `env.ts`・`vars.ts`・`worker.ts`・`middleware.ts`（許容リストの対象）と、`util/formData.ts`・`util/http.ts`・`util/padTwoDigits.ts`・`util/waitForImageLoad.ts`（許容リストの対象）
  - `worker.ts` の Cron の入口（`scheduled`）の説明は、実行の順序と理由を現在形で書く
  - 完了の条件: これらのファイルに違反が無く、コードの行が変わっていない
  - _Boundary: G9 root-types-util-styles_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 9.2 検査の対象外のファイル（`global.d.ts`・`types/`・`util/utf8Bytes.ts`・`styles/` の CSS）の禁止パターンと経緯の語を取り除く
  - `src/global.d.ts` と `src/types/` の `.ts`・`src/util/utf8Bytes.ts` に、禁止パターン（spec 参照・要件番号・AC/FR/NFR・cc-sdd・kiro・バッククォートの外の日付）と経緯の語が無いことを、検索で確かめる。あれば直す
  - `src/styles/` の CSS 6 件のうち、`ui.module.css`・`avatar.ui.module.css`・`button.ui.module.css`・`tokens.css` の旧 spec 参照（`specs/design-tokens`）を、現在の仕組みと理由の記述に直す。「旧画面」（画面の切り替えを指す語）は残し、判断を報告に挙げる
  - 完了の条件: `src/global.d.ts`・`src/types/`・`src/util/utf8Bytes.ts`・`src/styles/` に、禁止パターンが 0 件であり、CSS のコードの行（セレクタ・宣言）が変わっていない
  - _Boundary: G9 root-types-util-styles_
  - _Requirements: 2.6, 3.1, 3.3, 4.1, 4.4, 5.1, 5.3_

- [x] 9.3 G9 の段階の完了を確かめ、許容リストの項目を消す
  - 検査の出力のうち `src/env.ts`・`src/vars.ts`・`src/worker.ts`・`src/middleware.ts`・`src/util/` に当たる項目が 0 件であることを確かめる
  - 許容リストから、これらのパスで所有が `comments-components-pages` の項目を消す
  - `git diff` の変更行（`src/` 直下・`util/`・`types/`・`styles/`・`global.d.ts`）が、コメントの行と空行だけであることを確かめる
  - `commentRules.test.ts` が通過する
  - _Boundary: G9 root-types-util-styles, 許容リスト_
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.3, 5.4, 6.1, 6.3, 6.4, 6.5, 7.1, 7.2, 7.4_

- [x] 10. 全体の検証と完了の報告
- [x] 10.1 範囲の全体で、検査と全テストを通す
  - `npx tsx scripts/architecture/commentRules.ts --emit-allowlist` の出力で、範囲（`src/components`・`src/pages`・`src/*.ts`・`src/types`・`src/util`）に当たる違反が 0 件である
  - `npm run test:type`・`npm run test:imports`・`npm run test:unit`・`npm run test:component`・`npm run test:route`・`npm run test:render` が通過する（失敗があれば、コメントの変更と無関係な原因かを切り分けて報告する）。`npm run test:e2e` は、この spec の検証には含めない（comments-api-schema が実行する）
  - 完了の条件: 上のテストが通過し、その結果が完了の報告に記録されている
  - _Boundary: G10 final_
  - _Requirements: 7.3, 6.2_

- [x] 10.2 許容リストと変更範囲を確かめ、完了の報告を作る
  - 許容リストのうち、所有が `comments-components-pages` の項目が 0 件であり、他の所有の項目が変わっていない（`git diff -- config/comments/allowlist.json` で、消した項目が範囲内のパスだけであることを確かめる）
  - `git status` で、ファイルの追加・削除・移動が無く、変更が範囲内のコメントと空行と許容リストだけである
  - `src/components`・`src/pages`・`src/` 直下・`src/types`・`src/util`・`src/styles` の CSS と `global.d.ts` を、禁止パターンと経緯の語で検索し、結果を報告する
  - 完了の報告に、判別に迷って残したコメント、正当な用法として残した語、残っている README の参照、検証の結果を含める
  - _Boundary: G10 final, 許容リスト_
  - _Requirements: 6.2, 6.3, 6.4, 6.5, 5.2, 7.4, 7.5_

## Implementation Notes

### 完了の報告（タスク 10。2026-11-11）

- 10.1: 許容リストの所有 `comments-components-pages` の項目は 0 件（作業前 203 件）。他の所有者は comments-tests 197・comments-scripts-config 42・comments-api-schema 5 で、作業前から変わらない。検査の出力に、範囲（`src/components`・`src/pages`・`src/` 直下・`types`・`util`）の違反は無い。`npm run test:type`・`test:imports`・`test:unit`（704 件通過・1 件スキップ）・`test:component`（13）・`test:route`（212）・`test:render`（2）がすべて終了コード 0。範囲の `.ts`・`.tsx` 130 ファイルの字句比較（基準は作業開始時の ff045b65）は差分 0 件。`.astro` と CSS は、DiffCheck（コメント以外の行の差分）で確かめた（ヘッダを import の前へ移した import 行の移動を除き空）。
- 10.2: `git diff --name-status` に、変更（M）以外（追加・削除・改名）は無い。変更は範囲内のコメント・空行と許容リストの項目の削除だけ。`src/lib`・`tests`・`scripts`・`config`（許容リストを除く）への差分は 0。範囲を禁止パターン（`specs/`・AC/FR/NFR・cc-sdd・kiro）で検索した結果は 0 件（README を除く）。
- 判別に迷って残したコメントは無い。
- 正当な用法として残した語: `src/components/account/LoginIntro/index.tsx` の「旧UI」（旧 UI への案内リンクを指す）、`src/pages/posts/[slug].astro` の「旧形式URL」と `legacy pageDB`、`src/pages/v1/page.ts`・`src/env.ts` の `legacy backend`・「旧投稿表示ページ」、`src/styles/ui.module.css` の「旧画面」（View Transitions で切り替わる前の画面を指す）。
- 残っている README の参照: `src/components/common/README.md:42` の `specs/dropdown` への参照（README は範囲外）。
- 作業の記録: 経緯語・参照を除くほか、削ったヘッダの理由は宣言の JSDoc・行コメントへ移した。作業前から存在する「Input:/Output:/例:」の節は残した（独立レビューが 8.2 の `fail`・`internalError` で指摘したが、取り決めに従い変更しない）。
- 委譲: 実装とレビューは Codex に委譲した。6.1 の実装、7.1 の実装とレビュー、8.1 の実装、6.1 の独立レビューは、Codex の利用上限のあいだ、新しいサブエージェントで行った。9.2（CSS の参照 4 件と言い回し）は数行の修正のため直接行った。

### feature 検証（kiro-validate-impl, 2026-11-11）

- 判定は `GO`。タスクは全て `[x]`、`_Blocked:_` は無い。`npm run test:type`・`test:imports`・`test:unit`・`test:component`・`test:route`・`test:render` が終了コード 0（10.1 を参照）。許容リストの所有 `comments-components-pages` は 0 件、他の所有者は変わらない。変更は範囲内のコメント・空行と許容リストの項目の削除だけで、境界の外への差分とファイルの追加・削除・改名は無い。Revalidation Triggers は発火していない。起動の確認（e2e）は、この spec の検証に含めず、push 前フックの `npm run test:all` が行う。

### 独立した検証（kiro-validate-impl を Codex で実施, 2026-11-11）

- 判定は `MANUAL_VERIFY_REQUIRED`（実装の不備の指摘は無し）。要件 34 件のうち 28 件が「満たす」、6 件（3.4・4.2・4.3・5.2・6.x・7.1）は「部分的」だった。理由は、(a) 全変更コメントを 1 件ずつ独立に照合していないこと（サンプル 15 ファイルは、理由の欠落・コードとの食い違い・禁止パターンのいずれも無し）、(b) 作業前の基準 `ff045b65` からの差分に、他の comments-* spec の変更が混ざり、許容リストの他所有者の件数の変化をこの spec に帰属できないこと。(b) は検証の基準の取り方の問題で、この spec の実装の問題ではない。DiffCheck・字句比較（130 ファイル）・境界（追加・削除・改名なし）は再確認済み。

- 起動確認の再実施（2026-11-11, コミット b60199a2）: 検証が読み取り専用で起動を実行できず `MANUAL_REQUIRED` となった点を補った。`npm run test:e2e` は 10 件成功。`SITE_HOST` を仮の値で与えた `npm run build:v2` は成功し、ビルド済み成果物を `astro preview` で起動して 7 ページを Chromium で開き、例外は 0 件（未ログインの認証付き API による 401 の console エラーのみ）。Web Share API は手動で確認済み。
