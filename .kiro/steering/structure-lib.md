# Structure: lib（業務の判断）

`src/lib/` は業務の判断を置く。`src/pages/` と `src/components/` の両方から使う。

## 業務（src/lib/<領域>/）

**Location**: `src/lib/<領域>/`
**Purpose**: 領域ごとの判断（検証・状態遷移・外部の呼び出し）。画面と API の両方から使う。
**Example**: `src/lib/schedule/` は予約の受付・保管・実行・後片付けを持つ

- 領域は下の「領域の一覧」のとおり（`session`・`oauth`・`schedule`・`survey`・`entry`・`timeline`・`atproto`・`settings`・`i18n`・`platform`・`feedback`・`share` など）。
- `platform/` は複数の領域が使う Cloudflare の型（D1・R2・Cron）と宣言。特定の機能に属さない共有の型はここに置く。
- `timeline/` はスレッドのまとめと一覧の整形、下書きの一覧（`draftList.ts`）。`entry/` は Entry のレコードと作成・更新・削除に限る。例外として、旧 pageDB の投稿の取得と削除（`legacyPagedb.ts`）を持つ。
- `atproto/` は Bluesky の仕様に従うレコードの組み立てと読み取り。
- `api/schema/` は endpoint の入出力スキーマで、`src/pages/` の経路と同じ階層にする（`api/schema/v2/feedback/post.ts`）。

## 領域の一覧

`src/lib/` の領域（業務の判断。`lib/<領域>` の形で書く）は、基盤と業務の二つの層に分ける。依存は業務 → 基盤の一方向だけにする（規則 `libLayer`。対応表は `scripts/architecture/libLayers.ts` にあり、下の表と一致させる）。

### 層の表

| 層   | 領域               | 役割                                                                                                                                                                                                                                                                                               |
| ---- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基盤 | `lib/api`          | API の契約。`api/schema/`（endpoint の入出力スキーマ）と `api/contract/`（業務から下ろした入力の制約と送信内容の型。`contract/feedbackLimits`・`contract/feedbackSubmission`・`contract/surveyPath`）。`lib/api` は業務（`feedback`・`survey`）を参照しない。業務の側が `api/contract/` を参照する |
| 基盤 | `lib/atproto`      | Bluesky の仕様に従うレコードの組み立てと読み取り                                                                                                                                                                                                                                                   |
| 基盤 | `lib/codegen`      | 生成物（`src/client/openapi/`）が import する fetch と form-data の処理。生成物の import 経路を保つため移動しない（下の「残す領域」）                                                                                                                                                              |
| 基盤 | `lib/i18n`         | 表示言語の判断と辞書                                                                                                                                                                                                                                                                               |
| 基盤 | `lib/image`        | 画像の上限・処理・ギャラリーの配置                                                                                                                                                                                                                                                                 |
| 基盤 | `lib/oauth`        | OAuth のクライアント・トークン・DPoP の判断                                                                                                                                                                                                                                                        |
| 基盤 | `lib/platform`     | Cloudflare の型と宣言（D1・R2・Cron）、Bluesky・公開の endpoint                                                                                                                                                                                                                                    |
| 基盤 | `lib/session`      | 利用者のセッションの保持と更新（Cookie・OAuth・セッションの更新）。アクティブアカウントの共有キャッシュ（`activeAccountSession.ts`）を持つ                                                                                                                                                         |
| 基盤 | `lib/site`         | ビルド情報・サイト設定・プライバシーポリシーの文面（`policySections.ts`）                                                                                                                                                                                                                          |
| 基盤 | `lib/video`        | 動画の判断                                                                                                                                                                                                                                                                                         |
| 業務 | `lib/entry`        | Entry のレコードと作成・更新・削除。旧 pageDB の投稿の取得と削除（`legacyPagedb.ts`）を持つ                                                                                                                                                                                                        |
| 業務 | `lib/feedback`     | 不具合の報告と機能の提案                                                                                                                                                                                                                                                                           |
| 業務 | `lib/guestMode.ts` | ゲストモードの判断。`lib` 直下の業務のファイル（ゲストのダミーデータは `lib/timeline/guest/`）                                                                                                                                                                                                     |
| 業務 | `lib/schedule`     | 予約投稿                                                                                                                                                                                                                                                                                           |
| 業務 | `lib/settings`     | 利用者の設定                                                                                                                                                                                                                                                                                       |
| 業務 | `lib/share`        | 他 SNS への共有の本文と文字数の補正                                                                                                                                                                                                                                                                |
| 業務 | `lib/survey`       | アンケート                                                                                                                                                                                                                                                                                         |
| 業務 | `lib/timeline`     | スレッドのまとめ・一覧の整形・下書きの一覧（`draftList.ts`）                                                                                                                                                                                                                                       |

### 残す領域

1〜2 ファイルの領域のうち、統合せず残すもの（要件 4.2）:

- `lib/codegen`: 生成物 `src/client/openapi/client.ts`（相対 import の `lib/codegen/fetcher.ts`・`openapiFormData.ts`）と `config/orval.config.ts`（出力先の `src/lib/codegen/`）が、このフォルダを参照する。`lib/codegen` を移すと生成物の import 経路が変わり、`npm run apigen` の差分になるため、基盤として残す。
- `lib/share`: 他 SNS への共有の判断をまとめる領域として残す。`util/share/` の純粋な部分（URL・本文・文字数・切り詰め・File の組み立て）を統合した。ブラウザ側（`window.open`・`navigator.share`）は `lib/share` に置かず、`components/share/IntentShareDialog/` の内側に置く。`lib/share` は `lib/settings` を参照しない（自動ポップアップの型は `lib/share/autoPopupTarget.ts` に置く）。

---

_依存の向きは [structure-dependencies.md](structure-dependencies.md)、規約の概要は [structure.md](structure.md)。_
_updated_at: 2026-11-08_
