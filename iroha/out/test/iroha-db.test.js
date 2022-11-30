"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const slonik_1 = require("slonik");
const iroha_api_1 = require("../iroha-api");
const iroha_db_1 = require("../iroha-db");
const iroha_data_1 = require("./util/iroha-data");
const postgres_container_1 = require("./util/postgres-container");
describe('iroha db', () => {
    let postgres = null;
    let pool = null;
    let db = null;
    let step = null;
    let pagedListAfterLast = null;
    async function checkAccount(id) {
        const accounts = await db.accountsById([id]);
        expect(accounts).toHaveLength(1);
        if (id in step.accountQuorum) {
            expect(accounts[0]).not.toBeNull();
            expect(accounts[0].id).toBe(id);
            expect(accounts[0].quorum).toBe(step.accountQuorum[id]);
        }
        else {
            expect(accounts[0]).toBeNull();
        }
    }
    beforeAll(async () => {
        postgres = await postgres_container_1.PostgresContainer.create('postgres');
        pool = (0, slonik_1.createPool)(postgres.url.href);
        await iroha_db_1.IrohaDb.init(pool);
        db = new iroha_db_1.IrohaDb(pool);
    }, 60000);
    afterAll(async () => {
        if (postgres) {
            await postgres.stop();
        }
    });
    test('no blocks', async () => {
        expect(await db.blockCount()).toBe(0);
        expect(await db.transactionCount()).toBe(0);
        expect(await db.accountCount()).toBe(0);
    });
    test('add first block', async () => {
        step = iroha_data_1.steps[0];
        await db.applyBlock(step.block);
    });
    test('one block', async () => {
        expect(await db.blockCount()).toBe(1);
        expect(await db.transactionCount()).toBe(1);
        expect(await db.accountCount()).toBe(1);
        await checkAccount(iroha_data_1.account1);
    });
    test('paged list after last', async () => {
        const list1 = await db.accountList({ after: null, count: 1 });
        expect(list1.items).toHaveLength(1);
        const list2 = await db.accountList({ after: list1.nextAfter, count: 1 });
        expect(list2.items).toHaveLength(0);
        pagedListAfterLast = list2.nextAfter;
        expect(list2.nextAfter).toBe(list1.nextAfter);
    });
    test('add second block', async () => {
        step = iroha_data_1.steps[1];
        await db.applyBlock(step.block);
    });
    test('paged list after last inserted', async () => {
        const list2 = await db.accountList({ after: pagedListAfterLast, count: 1 });
        expect(list2.items).toHaveLength(1);
    });
    test('two blocks', async () => {
        expect(await db.blockCount()).toBe(2);
        expect(await db.transactionCount()).toBe(3);
        expect(await db.accountCount()).toBe(2);
        await checkAccount(iroha_data_1.account1);
        await checkAccount(iroha_data_1.account2);
    });
    test('block by height', async () => {
        expect(await db.blocksByHeight([100, 100])).toEqual([null, null]);
        for (const expected of step.blocks) {
            const blocks = await db.blocksByHeight([(0, iroha_api_1.blockHeight)(expected)]);
            expect(blocks).toHaveLength(1);
            expect(blocks[0]).not.toBeNull();
            expect((0, iroha_api_1.blockHash)(blocks[0])).toBe((0, iroha_api_1.blockHash)(expected));
        }
    });
    test('transaction by hash', async () => {
        expect(await db.transactionsByHash(['', ''])).toEqual([null, null]);
        for (const hash of step.transactions.map(iroha_api_1.transactionHash)) {
            const transactions = await db.transactionsByHash([hash]);
            expect(transactions).toHaveLength(1);
            expect(transactions[0]).not.toBeNull();
            expect((0, iroha_api_1.transactionHash)(transactions[0].protobuf)).toBe(hash);
        }
    });
    test('account by id', async () => {
        expect(await db.accountsById(['', ''])).toEqual([null, null]);
    });
    test('add third block', async () => {
        step = iroha_data_1.steps[2];
        await db.applyBlock(step.block);
    });
    test('block list', async () => {
        const blocks1 = await db.blockList({ after: null, count: 1 });
        expect(blocks1.items).toHaveLength(1);
        expect((0, iroha_api_1.blockHeight)(blocks1.items[0])).toBe(1);
        expect(blocks1.nextAfter).toBe(1);
        const blocks23 = await db.blockList({ after: blocks1.nextAfter, count: 2 });
        expect(blocks23.items).toHaveLength(2);
        expect((0, iroha_api_1.blockHeight)(blocks23.items[0])).toBe(2);
        expect((0, iroha_api_1.blockHeight)(blocks23.items[1])).toBe(3);
        expect(blocks23.nextAfter).toBe(3);
    });
    test('trasaction list', async () => {
        const transactions1 = await db.transactionList({ after: null, count: 1 });
        expect(transactions1.items).toHaveLength(1);
        expect((0, iroha_api_1.transactionHash)(transactions1.items[0].protobuf)).toBe((0, iroha_api_1.transactionHash)(step.transactions[0]));
        const transactions23 = await db.transactionList({ after: transactions1.nextAfter, count: 2 });
        expect(transactions23.items).toHaveLength(2);
        expect((0, iroha_api_1.transactionHash)(transactions23.items[0].protobuf)).toBe((0, iroha_api_1.transactionHash)(step.transactions[1]));
        expect((0, iroha_api_1.transactionHash)(transactions23.items[1].protobuf)).toBe((0, iroha_api_1.transactionHash)(step.transactions[2]));
    });
    test('account list', async () => {
        const accountSet = new Set(Object.keys(step.accountQuorum));
        const accounts1 = await db.accountList({ after: null, count: 1 });
        expect(accounts1.items).toHaveLength(1);
        expect(accountSet.delete(accounts1.items[0].id)).toBe(true);
        const accounts23 = await db.accountList({ after: accounts1.nextAfter, count: 2 });
        expect(accounts23.items).toHaveLength(2);
        expect(accountSet.delete(accounts23.items[0].id)).toBe(true);
        expect(accountSet.delete(accounts23.items[1].id)).toBe(true);
    });
    test('transaction count per minute per hour', async () => {
        await pool.query((0, slonik_1.sql) `BEGIN`);
        try {
            await pool.query((0, slonik_1.sql) `
        CREATE OR REPLACE FUNCTION pg_catalog.NOW()
        RETURNS TIMESTAMP WITH TIME ZONE
        LANGUAGE SQL
        AS $$ SELECT '2019-01-01T12:00'::TIMESTAMP WITH TIME ZONE $$
      `);
            const perMinute = await db.transactionCountPerMinute(5);
            expect(perMinute).toEqual([0, 2, 0, 1, 0]);
            const perHour = await db.transactionCountPerHour(5);
            expect(perHour).toEqual([0, 1, 0, 3, 0]);
        }
        finally {
            await pool.query((0, slonik_1.sql) `ROLLBACK`);
        }
    });
});
//# sourceMappingURL=iroha-db.test.js.map