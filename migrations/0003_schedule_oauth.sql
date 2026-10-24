-- 予約用の認証をアプリパスワードから OAuth に切り替える。
-- 旧形式（アプリパスワードで得た更新用トークン）の認証情報は使えないため削除する。
DELETE FROM schedule_credentials;

-- 認可の開始から戻りまでの間だけ保つ状態（PKCE の verifier・DPoP の鍵など）。暗号化して保管する
CREATE TABLE schedule_oauth_states (
  state TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  data_enc TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
