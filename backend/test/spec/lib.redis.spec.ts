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

    it('distribution approximates weights over many samples', async () => {
        const endpoints = ['e0', 'e1', 'e2'];
        const rule = { balancing: [ { index: 0, weight: 1 }, { index: 1, weight: 2 }, { index: 2, weight: 7 } ] };

        const mod = await resetEnvAndImport(endpoints, rule);
        const { RedisClient } = mod as any;

        const trials = 2000;
        const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
        for (let i = 0; i < trials; i++) {
            const c = new RedisClient();
            counts[c.redisIndex] = (counts[c.redisIndex] ?? 0) + 1;
        }

        const totalWeight = 1 + 2 + 7;
        const expected = { 0: 1 / totalWeight, 1: 2 / totalWeight, 2: 7 / totalWeight };
        for (const idx of [0, 1, 2]) {
            const obs = counts[idx] / trials;
            const relErr = Math.abs(obs - expected[idx]) / Math.max(expected[idx], 1e-9);
            expect(relErr).toBeLessThan(0.3);
        }
    });

    it('registerBlock excludes entries from selection', async () => {
        const endpoints = ['e0', 'e1', 'e2'];
        const future = new Date(); future.setFullYear(future.getFullYear() + 10);
        const rule = { balancing: [ { index: 0, weight: 10, registerBlock: { dateBefore: future.toISOString() } }, { index: 1, weight: 1 }, { index: 2, weight: 1 } ] };

        const mod = await resetEnvAndImport(endpoints, rule);
        const { RedisClient } = mod as any;

        const trials = 300;
        for (let i = 0; i < trials; i++) {
            const c = new RedisClient();
            expect(c.redisIndex).not.toBe(0);
        }
    });

    it('migration weight changes are applied according to dates', async () => {
        const endpoints = ['e0', 'e1', 'e2'];
        const past = new Date(); past.setFullYear(past.getFullYear() - 1);
        const rule = { balancing: [ { index: 0, weight: 1, migration: { dateAfter: past.toISOString(), weight: 20 } }, { index: 1, weight: 1 }, { index: 2, weight: 1 } ] };

        const mod = await resetEnvAndImport(endpoints, rule);
        const { RedisClient } = mod as any;

        const trials = 2000;
        const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
        for (let i = 0; i < trials; i++) {
            const c = new RedisClient();
            counts[c.redisIndex] = (counts[c.redisIndex] ?? 0) + 1;
        }

        // index 0 should be selected far more often due to migration weight
        expect(counts[0]).toBeGreaterThan(counts[1] * 5);
    });

    it('respects registerBlock.dateAfter (blocks when now >= dateAfter)', async () => {
        const endpoints = ['e0', 'e1'];
        const past = new Date();
        past.setFullYear(past.getFullYear() - 1);

        const rule = {
            balancing: [
                { index: 0, weight: 1, registerBlock: { dateAfter: past.toISOString() } },
                { index: 1, weight: 1 },
            ],
        };

        const mod = await resetEnvAndImport(endpoints, rule);
        const { RedisClient } = mod as any;

        const trials = 200;
        for (let i = 0; i < trials; i++) {
            const c = new RedisClient();
            expect(c.redisIndex).not.toBe(0);
        }
    });

    it('applies migration.dateBefore weight when now < dateBefore', async () => {
        const endpoints = ['e0', 'e1', 'e2'];
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);

        const rule = {
            balancing: [
                { index: 0, weight: 1, migration: { dateBefore: future.toISOString(), weight: 20 } },
                { index: 1, weight: 1 },
                { index: 2, weight: 1 },
            ],
        };

        const mod = await resetEnvAndImport(endpoints, rule);
        const { RedisClient } = mod as any;

        const trials = 2000;
        const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
        for (let i = 0; i < trials; i++) {
            const c = new RedisClient();
            counts[c.redisIndex] = (counts[c.redisIndex] ?? 0) + 1;
        }

        expect(counts[0]).toBeGreaterThan(counts[1] * 5);
    });
});
