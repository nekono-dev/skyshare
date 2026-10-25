-- 登録状態の取得が、アカウントごとの待機中・実行中の予約の最も遅い実行時刻を、
-- 全アカウントの予約を走査せずに求められるようにする。
-- 旧索引 (did, status) の機能は、先頭 2 列が同じ新しい索引が引き継ぐ。
DROP INDEX scheduled_posts_owner;
CREATE INDEX scheduled_posts_owner ON scheduled_posts (did, status, run_at);
