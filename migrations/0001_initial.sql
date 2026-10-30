-- 未リリース時点の初期スキーマ。空の DB に適用する。

-- 予約投稿の保管先。予約の内容・実行の進捗と、予約用の認証情報を持つ
CREATE TABLE scheduled_posts (
  id TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  run_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'posted', 'failed')),
  payload TEXT NOT NULL,
  image_keys TEXT NOT NULL DEFAULT '[]',
  progress TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  result_uri TEXT,
  updated_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE INDEX scheduled_posts_due ON scheduled_posts (status, run_at);
CREATE INDEX scheduled_posts_owner ON scheduled_posts (did, status, run_at);

CREATE TABLE schedule_credentials (
  did TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  token_enc TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  authorized_at INTEGER NOT NULL DEFAULT 0,
  reauth_required INTEGER NOT NULL DEFAULT 0
);

-- OAuth の認可途中の状態（暗号化して保管する）
CREATE TABLE schedule_oauth_states (
  state TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  data_enc TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- ログイン時アンケートの保管先。回答済みの集合と匿名の回答を、共通の値も参照も持たない 2 つの表に分ける。
-- 集合の行から回答は引けず、回答の行から利用者は引けない。

-- 回答済みの利用者の集合。回答への参照も時刻も持たない
CREATE TABLE survey_respondents (
  survey_id TEXT NOT NULL,
  did_hash TEXT NOT NULL,
  PRIMARY KEY (survey_id, did_hash)
) WITHOUT ROWID;

-- 匿名の回答。回答者に関わる値を持たない
CREATE TABLE survey_answers (
  survey_id TEXT NOT NULL,
  id TEXT NOT NULL,
  answers TEXT NOT NULL,
  answered_on TEXT NOT NULL,
  PRIMARY KEY (survey_id, id)
) WITHOUT ROWID;
