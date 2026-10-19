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
CREATE INDEX scheduled_posts_owner ON scheduled_posts (did, status);

CREATE TABLE schedule_credentials (
  did TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  token_enc TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
