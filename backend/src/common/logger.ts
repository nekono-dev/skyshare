import * as fbLogger from 'firebase-functions/logger';
import { launchEnv } from './environments.js';

class Logger {
    private env: string;
    constructor(env: string | undefined) {
        this.env = env || 'local';
    }

    // 共通ログ処理を一元化
    private logInternal = async (
        level: 'error' | 'info' | 'debug',
        message: string
    ): Promise<void> => {
        const payload = {
            level,
            message,
            timestamp: new Date().toISOString(),
        };

        if (this.env === 'firebase') {
            try {
                const methods: Record<string, (...args: unknown[]) => void> = {
                    error: fbLogger.error,
                    info: fbLogger.info,
                    debug: fbLogger.debug,
                };
                const fn = methods[level] || fbLogger.info;
                fn(payload);
            } catch (e) {
                console.error('[FIREBASE_LOG_ERROR]', e, payload);
            }
            return;
        }

        if (this.env === 'local') {
            // local は console に出す（レベルごとに振り分け）
            if (level === 'error') {
                console.error(payload);
            } else if (level === 'info') {
                console.info(payload);
            } else {
                console.debug(payload);
            }
            return;
        }
    };

    // error をメソッドとして定義（内部共通処理を利用）
    error = async (message: string): Promise<void> => {
        await this.logInternal('error', message);
    };

    // info と debug を追加
    info = async (message: string): Promise<void> => {
        await this.logInternal('info', message);
    };

    debug = async (message: string): Promise<void> => {
        await this.logInternal('debug', message);
    };
}

const logger = new Logger(launchEnv);

export { logger };
