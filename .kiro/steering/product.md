# Product Overview

Skyshare は、Bluesky の利用者が投稿を作り、他の SNS にも同時に共有し、投稿をまとめた公開ページ（Skyshare Entry）として残すための Web アプリケーションである。Cloudflare Workers 上で動き、運用者ごとの値を環境変数で受け取るため、自前で運用できる構成になっている。

## Core Capabilities

- **投稿の作成**: 単発とスレッドの両方を一つのフォームで作る。本文のメンション・ハッシュタグ候補、画像・動画、返信と引用の制限、下書きを扱う。
- **他 SNS への共有**: X・タイッツー・Mastodon・Misskey へ intent やポップアップで共有する。対応しない環境では Web Share を使う。
- **Skyshare Entry**: 投稿から見出し・画像つきの公開ページを作る。データは利用者の Bluesky（PDS）のレコードとして残り、サーバーは保持しない。
- **予約投稿**: 未来の日時に投稿を予約する。実行は Cron が 1 分ごとに行う。
- **アカウント管理**: Bluesky の OAuth とアプリパスワードでログインし、複数アカウントを切り替える。

補助として、ログイン時アンケート、不具合の報告と機能の提案（GitHub Issue へ登録）、旧サービスの投稿の閲覧と削除、ヘルプとプライバシーポリシーを持つ。ログインしていなくても、URL に `?guest` を付けるとダミーのデータで画面を試せる（ゲストモード。`src/lib/guestMode.ts`）。

## Target Use Cases

- Bluesky を主に使い、他の SNS にも同じ内容を出したい利用者
- 投稿をまとめ、画像つきのリンクとして共有したい利用者
- 予約した時刻に投稿したい利用者

## Value Proposition

- 一度の入力で、Bluesky と他 SNS へ投稿できる。
- 公開データは利用者の Bluesky に置かれ、サーバーが持つ状態は予約・予約用の暗号化された認可・匿名化されたアンケートの回答に限られる。ほかに、フィードバックの送信間隔を制限するための一時的な回数（Cloudflare の Rate Limiter。アカウントごと）を持つ。
- UI は日本語（既定）と英語。運営者名・連絡先・分析タグなどは環境変数で変えられる。

## Constraints Visible in Code

- 対象は Bluesky のホスティングアカウント。OAuth でログインできるのは Bluesky が運用するアカウントに限られる（`src/lib/session/oauthLogin.ts`）。
- 動画の実体は Workers を経由せず、ブラウザから Bluesky の動画サービスへ直接送る。
- 旧サービス（pageDB）の投稿は読み取りと削除だけを扱う。

---

_Focus on purpose and patterns. Current behavior is recorded from the implementation (`src/`, configuration files)._
_updated_at: 2026-11-10_
