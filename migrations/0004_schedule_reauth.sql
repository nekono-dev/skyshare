-- 許可が無効になったときにスイッチをオフへ戻さず、再度の許可を案内するための印と、
-- 許可の有効期限の目安の計算に使う許可の時刻を加える。
-- reauth_required が 1 の行は、認可の情報（token_enc）を消して再度の許可が必要である印だけを残す。
ALTER TABLE schedule_credentials ADD COLUMN authorized_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE schedule_credentials ADD COLUMN reauth_required INTEGER NOT NULL DEFAULT 0;
-- 既存の行は、許可の時刻が分からないため最後の使用の時刻で代える
UPDATE schedule_credentials SET authorized_at = updated_at;
