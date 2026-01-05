import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const resetEnvAndImport = async (endpoints: string[], rule: unknown) => {
    vi.resetModules();
    process.env.DB_ENDPOINTS = JSON.stringify(endpoints);
    process.env.DB_ENDPOINT_RULE = JSON.stringify(rule);
    return await import('../../src/lib/redis');
};

describe('RedisClient endpoint selection', () => {
    beforeEach(() => {
        // ensure deterministic Math.random when needed
        vi.restoreAllMocks();
    });

    afterEach(() => {
        delete process.env.DB_ENDPOINTS;
        delete process.env.DB_ENDPOINT_RULE;
        vi.resetModules();
        vi.restoreAllMocks();
    });

    it('keeps default redisIndex (0) when endpoint provided but no dbIndex', async () => {
        const mod = await resetEnvAndImport(['e0', 'e1', 'e2'], {});
        const { RedisClient } = mod as any;

        const c = new RedisClient({ endpoint: 'custom-endpoint' });
        expect(c.redisIndex).toBe(0);
    });

    it('uses provided dbIndex when specified', async () => {
        const mod = await resetEnvAndImport(['e0', 'e1', 'e2'], {});
        const { RedisClient } = mod as any;

        const c = new RedisClient({ dbIndex: 2 });
        expect(c.redisIndex).toBe(2);
    });

    it('selects index according to weights in dbEndpointRule', async () => {
        const endpoints = ['e0', 'e1', 'e2'];
        const rule = {
            balancing: [
                { index: 0, weight: 1 },
                { index: 1, weight: 2 },
                { index: 2, weight: 0 },
            ],
        };

        // pick a random value that falls into index 1's bucket
        vi.spyOn(Math, 'random').mockReturnValue(0.6);

        const mod = await resetEnvAndImport(endpoints, rule);
        const { RedisClient } = mod as any;

        const c = new RedisClient();
        expect(c.redisIndex).toBe(1);
    });

    it('respects registerBlock.dateBefore (blocks when now < dateBefore)', async () => {
        const endpoints = ['e0', 'e1'];
        const farFuture = new Date();
        farFuture.setFullYear(farFuture.getFullYear() + 10);

        const rule = {
            balancing: [
                {
                    index: 0,
                    weight: 1,
                    registerBlock: { dateBefore: farFuture.toISOString() },
                },
                { index: 1, weight: 1 },
            ],
        };

        // with index 0 blocked, Math.random 0 should select the first available candidate (index 1)
        vi.spyOn(Math, 'random').mockReturnValue(0);

        const mod = await resetEnvAndImport(endpoints, rule);
        const { RedisClient } = mod as any;

        const c = new RedisClient();
        expect(c.redisIndex).toBe(1);
    });
});
