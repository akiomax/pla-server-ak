"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const graphql_1 = require("graphql");
const graphql_tag_1 = tslib_1.__importDefault(require("graphql-tag"));
const last_1 = tslib_1.__importDefault(require("lodash/last"));
const slonik_1 = require("slonik");
const graphql_2 = require("../graphql");
const iroha_api_1 = require("../iroha-api");
const iroha_db_1 = require("../iroha-db");
const iroha_data_1 = require("./util/iroha-data");
const postgres_container_1 = require("./util/postgres-container");
describe('graphql', () => {
    let postgres = null;
    let pool = null;
    let db = null;
    const step = (0, last_1.default)(iroha_data_1.steps);
    async function query(ast, variables = {}) {
        const res = await (0, graphql_1.graphql)(graphql_2.schema, (0, graphql_1.print)(ast), null, db, variables);
        expect(res.errors).toBeUndefined();
        expect(res.data).not.toBeNull();
        return res.data;
    }
    beforeAll(async () => {
        postgres = await postgres_container_1.PostgresContainer.create('postgres');
        pool = (0, slonik_1.createPool)(postgres.url.href);
        await iroha_db_1.IrohaDb.init(pool);
        db = new iroha_db_1.IrohaDb(pool);
        for (const step of iroha_data_1.steps) {
            await db.applyBlock(step.block);
        }
    }, 60000);
    afterAll(async () => {
        if (postgres) {
            await postgres.stop();
        }
    });
    test('count', async () => {
        expect(await query((0, graphql_tag_1.default) `query {
      blockCount
      transactionCount
      accountCount
    }`)).toEqual({
            blockCount: step.blocks.length,
            transactionCount: step.transactions.length,
            accountCount: Object.keys(step.accountQuorum).length,
        });
    });
    async function testList(name, field) {
        const ast = (0, graphql_tag_1.default) `query($after: Int, $count: Int!) {
      list: ${name}(after: $after, count: $count) {
        items { ${field} }
        nextAfter
      }
    }`;
        const res1 = await query(ast, { count: 1 });
        const res12 = await query(ast, { count: 2 });
        const res2 = await query(ast, { after: res1.list.nextAfter, count: 1 });
        expect(res1.list.items).toHaveLength(1);
        expect(res12.list.items).toHaveLength(2);
        expect(res2.list.items).toHaveLength(1);
        expect([...res1.list.items, ...res2.list.items]).toEqual(res12.list.items);
    }
    test('block list', () => testList('blockList', 'hash'));
    test('transaction list', () => testList('transactionList', 'hash'));
    test('account list', () => testList('accountList', 'id'));
    test('block', async () => {
        for (const block of step.blocks) {
            const height = (0, iroha_api_1.blockHeight)(block);
            const hash = (0, iroha_api_1.blockHash)(block);
            const transactionCount = block.getBlockV1().getPayload().getTransactionsList().length;
            expect(await query((0, graphql_tag_1.default) `query($height: Int!) {
          blockByHeight(height: $height) {
            height
            hash
            transactionCount
          }
        }`, { height })).toEqual({ blockByHeight: { height, hash, transactionCount } });
        }
    });
    test('transaction', async () => {
        for (const transaction of step.transactions) {
            const hash = (0, iroha_api_1.transactionHash)(transaction);
            const createdBy = { id: transaction.getPayload().getReducedPayload().getCreatorAccountId() };
            expect(await query((0, graphql_tag_1.default) `query($hash: String!) {
          transactionByHash(hash: $hash) {
            hash
            createdBy { id }
          }
        }`, { hash })).toEqual({ transactionByHash: { hash, createdBy } });
        }
    });
    test('account', async () => {
        for (const [id, quorum] of Object.entries(step.accountQuorum)) {
            expect(await query((0, graphql_tag_1.default) `query($id: String!) {
          accountById(id: $id) {
            id
            quorum
          }
        }`, { id })).toEqual({ accountById: { id, quorum } });
        }
    });
});
//# sourceMappingURL=graphql.test.js.map