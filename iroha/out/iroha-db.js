"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IrohaDb = exports.getBlockTransactions = void 0;
const tslib_1 = require("tslib");
const autobind_decorator_1 = tslib_1.__importDefault(require("autobind-decorator"));
const crypto_1 = require("crypto");
const DataLoader = require("dataloader");
const get_1 = tslib_1.__importDefault(require("lodash/get"));
const keyBy_1 = tslib_1.__importDefault(require("lodash/keyBy"));
const last_1 = tslib_1.__importDefault(require("lodash/last"));
const slonik_1 = require("slonik");
const files_1 = require("./files");
const iroha_api_1 = require("./iroha-api");
const logger_1 = require("./logger");
const array = (items, type) => slonik_1.sql.raw(`$1::${type}[]`, [items]);
const anyOrOne = (items, type) => items.length === 1 ? (0, slonik_1.sql) `(${items[0]})` : (0, slonik_1.sql) `ANY(${array(items, type)})`;
const map = (f) => (xs) => xs.map(f);
const byKeys = (keyOf, keys) => (items) => {
    const lookup = (0, keyBy_1.default)(items, keyOf);
    return keys.map(key => (0, get_1.default)(lookup, key, null));
};
const sqlAnd = (parts) => parts.length ? parts.reduce((a, x) => (0, slonik_1.sql) `${a} AND ${x}`) : (0, slonik_1.sql) `1 = 1`;
function getBlockTransactions(block) {
    const blockPayload = block.getBlockV1().getPayload();
    const time = dateValue(blockPayload.getCreatedTime());
    const block_height = (0, iroha_api_1.blockHeight)(block);
    return blockPayload.getTransactionsList().map(protobuf => ({ protobuf, time, block_height }));
}
exports.getBlockTransactions = getBlockTransactions;
const parseBlock = protobuf => iroha_api_1.BlockProto.deserializeBinary(new Uint8Array(protobuf));
const parseTransaction = ({ index, protobuf, time, block_height }) => ({
    index,
    protobuf: iroha_api_1.TransactionProto.deserializeBinary(new Uint8Array(protobuf)),
    time: dateValue(time),
    block_height,
});
const bytesValue = (value) => slonik_1.sql.raw('$1', [Buffer.from(value)]);
const dateValue = (value) => new Date(value).toISOString();
class IrohaDb {
    static async init(pool) {
        const fileHash = (0, crypto_1.createHash)('md5').update(files_1.postgresSql).digest('hex');
        const versionTableName = 'schema_version';
        const versionTable = slonik_1.sql.raw(versionTableName);
        try {
            if (await pool.oneFirst((0, slonik_1.sql) `SELECT to_regclass(${versionTableName}) IS NULL`)) {
                await pool.query((0, slonik_1.sql) `${slonik_1.sql.raw(files_1.postgresSql)}`);
                await pool.query((0, slonik_1.sql) `INSERT INTO ${versionTable} (hash) VALUES (${fileHash})`);
            }
            else {
                const dbHash = await pool.maybeOneFirst((0, slonik_1.sql) `SELECT hash FROM ${versionTable}`);
                if (dbHash !== fileHash) {
                    throw new Error(`IrohaDb.init: expected db schema version ${fileHash} but got ${dbHash}`);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('IrohaDb.init: please check that db is empty or recreate it');
            throw error;
        }
    }
    constructor(pool) {
        this.pool = pool;
        this.blockCount = IrohaDb.makeCount('block');
        this.transactionCount = IrohaDb.makeCount('transaction');
        this.accountCount = IrohaDb.makeCount('account');
        this.peerCount = IrohaDb.makeCount('peer');
        this.roleCount = IrohaDb.makeCount('role');
        this.domainCount = IrohaDb.makeCount('domain');
        this.peerList = IrohaDb.makePagedList('peer', ['address', 'public_key']);
        this.roleList = IrohaDb.makePagedList('role', ['name', 'permissions']);
        this.domainList = IrohaDb.makePagedList('domain', ['id', 'default_role']);
        this.blockLoader = new DataLoader(this.blocksByHeight);
        this.transactionLoader = new DataLoader(this.transactionsByHash);
        this.accountLoader = new DataLoader(this.accountsById);
        this.peerLoader = new DataLoader(this.peersByPublicKey);
        this.roleLoader = new DataLoader(this.rolesByName);
        this.domainLoader = new DataLoader(this.domainsById);
    }
    fork() {
        return new IrohaDb(this.pool);
    }
    applyBlock(block) {
        return this.pool.transaction(async (pool) => {
            const db = new IrohaDb(pool);
            const blockPayload = block.getBlockV1().getPayload();
            const blockTransactions = blockPayload.getTransactionsList();
            const blockTime = dateValue(blockPayload.getCreatedTime());
            await pool.query((0, slonik_1.sql) `
        INSERT INTO block (protobuf, height, created_time, transaction_count) VALUES (
          ${bytesValue(Buffer.from(block.serializeBinary()))},
          ${blockPayload.getHeight()},
          ${blockTime},
          ${blockTransactions.length}
        )
      `);
            let transactionIndex = await db.transactionCount();
            let accountIndex = await db.accountCount();
            let peerIndex = await db.peerCount();
            let roleIndex = await db.roleCount();
            let domainIndex = await db.domainCount();
            for (const transaction of blockTransactions) {
                const creatorId = transaction.getPayload().getReducedPayload().getCreatorAccountId() || null;
                transactionIndex += 1;
                await pool.query((0, slonik_1.sql) `
          INSERT INTO transaction (protobuf, index, hash, creator_id, creator_domain, block_height, time) VALUES (
            ${bytesValue(transaction.serializeBinary())},
            ${transactionIndex},
            ${(0, iroha_api_1.transactionHash)(transaction)},
            ${creatorId},
            ${creatorId && (0, iroha_api_1.accountDomain)(creatorId)},
            ${(0, iroha_api_1.blockHeight)(block)},
            ${blockTime}
          )
        `);
                for (const command of transaction.getPayload().getReducedPayload().getCommandsList()) {
                    if (command.hasCreateAccount()) {
                        const createAccount = command.getCreateAccount();
                        const domain = await db.domainLoader.load(createAccount.getDomainId());
                        accountIndex += 1;
                        await pool.query((0, slonik_1.sql) `
              INSERT INTO account (index, id, quorum, roles, permissions_granted) VALUES (
                ${accountIndex},
                ${`${createAccount.getAccountName()}@${createAccount.getDomainId()}`},
                1,
                ARRAY[${domain.default_role}],
                ARRAY[]::JSON[]
              )
            `);
                    }
                    else if (command.hasSetAccountQuorum()) {
                        const setAccountQuorum = command.getSetAccountQuorum();
                        await pool.query((0, slonik_1.sql) `
              UPDATE account SET quorum = ${setAccountQuorum.getQuorum()}
              WHERE id = ${setAccountQuorum.getAccountId()}
            `);
                    }
                    else if (command.hasAddPeer()) {
                        const addPeer = command.getAddPeer();
                        peerIndex += 1;
                        await pool.query((0, slonik_1.sql) `
              INSERT INTO peer (index, address, public_key) VALUES (
                ${peerIndex},
                ${addPeer.getPeer().getAddress()},
                ${addPeer.getPeer().getPeerKey()}
              )
            `);
                    }
                    else if (command.hasCreateRole()) {
                        const createRole = command.getCreateRole();
                        roleIndex += 1;
                        await pool.query((0, slonik_1.sql) `
              INSERT INTO role (index, name, permissions) VALUES (
                ${roleIndex},
                ${createRole.getRoleName()},
                ${array(createRole.getPermissionsList(), 'INT')}
              )
            `);
                    }
                    else if (command.hasCreateDomain()) {
                        const createDomain = command.getCreateDomain();
                        const domain = {
                            default_role: createDomain.getDefaultRole(),
                            id: createDomain.getDomainId(),
                        };
                        domainIndex += 1;
                        await pool.query((0, slonik_1.sql) `
              INSERT INTO domain (index, id, default_role) VALUES (
                ${domainIndex},
                ${domain.id},
                ${domain.default_role}
              )
            `);
                        db.domainLoader.prime(domain.id, domain);
                    }
                    else if (command.hasAppendRole() || command.hasDetachRole()) {
                        const append = command.hasAppendRole();
                        const appendDetach = append ? command.getAppendRole() : command.getDetachRole();
                        await pool.query((0, slonik_1.sql) `
              UPDATE account SET roles = ${slonik_1.sql.raw(append ? 'ARRAY_APPEND' : 'ARRAY_REMOVE')}(roles, ${appendDetach.getRoleName()})
              WHERE id = ${appendDetach.getAccountId()}
            `);
                    }
                    else if (command.hasGrantPermission() || command.hasRevokePermission()) {
                        const grant = command.hasGrantPermission();
                        const grantRevoke = grant ? command.getGrantPermission() : command.getRevokePermission();
                        const permissionGranted = {
                            by: creatorId,
                            to: grantRevoke.getAccountId(),
                            permission: grantRevoke.getPermission(),
                        };
                        await pool.query((0, slonik_1.sql) `
              UPDATE account
              SET permissions_granted = ${slonik_1.sql.raw(grant ? 'ARRAY_APPEND' : 'ARRAY_REMOVE')}(
                  permissions_granted::TEXT[],
                  ${JSON.stringify(permissionGranted)}
                )::JSON[]
              WHERE id = ${permissionGranted.by} OR id = ${permissionGranted.to}
            `);
                    }
                }
            }
        });
    }
    static makeCount(table) {
        return function () {
            return this.pool.oneFirst((0, slonik_1.sql) `
        SELECT COUNT(1) FROM ${slonik_1.sql.raw(table)}
      `);
        };
    }
    blocksByHeight(heights) {
        return this.pool.anyFirst((0, slonik_1.sql) `
      SELECT protobuf FROM block
      WHERE height = ${anyOrOne(heights, 'BIGINT')}
    `).then(map(parseBlock)).then(byKeys(iroha_api_1.blockHeight, heights));
    }
    transactionsByHash(hashes) {
        return this.pool.any((0, slonik_1.sql) `
      SELECT protobuf, time, block_height FROM transaction
      WHERE hash = ${anyOrOne(hashes, 'TEXT')}
    `).then(map(parseTransaction)).then(byKeys(x => (0, iroha_api_1.transactionHash)(x.protobuf), hashes));
    }
    accountsById(ids) {
        return this.pool.any((0, slonik_1.sql) `
      SELECT id, quorum, roles, permissions_granted FROM account
      WHERE id = ${anyOrOne(ids, 'TEXT')}
    `).then(byKeys('id', ids));
    }
    peersByPublicKey(publicKeys) {
        return this.pool.any((0, slonik_1.sql) `
      SELECT address, public_key FROM peer
      WHERE public_key = ${anyOrOne(publicKeys, 'TEXT')}
    `).then(byKeys('public_key', publicKeys));
    }
    rolesByName(names) {
        return this.pool.any((0, slonik_1.sql) `
      SELECT name, permissions FROM role
      WHERE name = ${anyOrOne(names, 'TEXT')}
    `).then(byKeys('name', names));
    }
    domainsById(ids) {
        return this.pool.any((0, slonik_1.sql) `
      SELECT id, default_role FROM domain
      WHERE id = ${anyOrOne(ids, 'TEXT')}
    `).then(byKeys('id', ids));
    }
    static makePagedList(table, fields) {
        return async function (query) {
            const after = query.after || 0;
            const items = await this.pool.any((0, slonik_1.sql) `
        SELECT ${slonik_1.sql.raw(fields.join(', '))} FROM ${slonik_1.sql.raw(table)}
        WHERE index > ${after}
        ORDER BY index
        LIMIT ${query.count}
      `);
            return {
                items,
                nextAfter: after + items.length,
            };
        };
    }
    async blockList(query) {
        const after = (query.after === undefined || query.after === null) ? (query.reverse ? 0x7FFFFFFF : 0) : query.after;
        const where = [];
        where.push((0, slonik_1.sql) `height ${slonik_1.sql.raw(query.reverse ? '<' : '>')} ${after}`);
        if (query.timeAfter) {
            where.push((0, slonik_1.sql) `created_time >= ${query.timeAfter}`);
        }
        if (query.timeBefore) {
            where.push((0, slonik_1.sql) `created_time < ${query.timeBefore}`);
        }
        const items = await this.pool.anyFirst((0, slonik_1.sql) `
      SELECT protobuf FROM block
      WHERE ${sqlAnd(where)}
      ORDER BY height ${slonik_1.sql.raw(query.reverse ? 'DESC' : 'ASC')}
      LIMIT ${query.count}
    `).then(map(parseBlock));
        return {
            items,
            nextAfter: after + items.length,
        };
    }
    async transactionList(query) {
        const after = (query.after === undefined || query.after === null) ? 0 : query.after;
        const where = [];
        where.push((0, slonik_1.sql) `index > ${after}`);
        if (query.timeAfter) {
            where.push((0, slonik_1.sql) `time >= ${query.timeAfter}`);
        }
        if (query.timeBefore) {
            where.push((0, slonik_1.sql) `time < ${query.timeBefore}`);
        }
        if (query.creatorId) {
            where.push((0, slonik_1.sql) `creator_id = ${query.creatorId}`);
        }
        const items = await this.pool.any((0, slonik_1.sql) `
      SELECT index, protobuf, time, block_height FROM transaction
      WHERE ${sqlAnd(where)}
      ORDER BY index
      LIMIT ${query.count}
    `).then(map(parseTransaction));
        return {
            items,
            nextAfter: items.length ? (0, last_1.default)(items).index : after,
        };
    }
    async accountList(query) {
        const after = (query.after === undefined || query.after === null) ? 0 : query.after;
        const where = [];
        where.push((0, slonik_1.sql) `index > ${after}`);
        if (query.id) {
            where.push((0, slonik_1.sql) `id ILIKE ${`%${query.id.replace(/[_%]/g, x => `\\${x}`)}%`}`);
        }
        const items = await this.pool.any((0, slonik_1.sql) `
      SELECT index, id, quorum, roles, permissions_granted FROM account
      WHERE ${sqlAnd(where)}
      ORDER BY index
      LIMIT ${query.count}
    `);
        return {
            items,
            nextAfter: items.length ? (0, last_1.default)(items).index : after,
        };
    }
    transactionCountPerMinute(count) {
        return this.countPerBucket('transaction', 'minute', count);
    }
    transactionCountPerHour(count) {
        return this.countPerBucket('transaction', 'hour', count);
    }
    blockCountPerMinute(count) {
        return this.countPerBucket('block', 'minute', count);
    }
    blockCountPerHour(count) {
        return this.countPerBucket('block', 'hour', count);
    }
    transactionCountPerDomain() {
        return this.pool.any((0, slonik_1.sql) `
      SELECT creator_domain AS domain, COUNT(1) AS count FROM transaction
      GROUP BY creator_domain
    `);
    }
    countPerBucket(what, unit, count) {
        const after = (0, slonik_1.sql) `DATE_TRUNC(${unit}, NOW()) - ${`${count - 1} ${unit}`}::INTERVAL`;
        return this.pool.anyFirst((0, slonik_1.sql) `
      WITH buckets AS (
        SELECT generate_series(
          ${after},
          DATE_TRUNC(${unit}, NOW()),
          ${`1 ${unit}`}::INTERVAL
        ) AS bucket
      )
      SELECT ${what === 'block' ? (0, slonik_1.sql) `COUNT(block.*)` : (0, slonik_1.sql) `COALESCE(SUM(transaction_count), 0)`}
      FROM buckets LEFT JOIN block ON DATE_TRUNC(${unit}, created_time) = bucket
        AND created_time > ${after}
      GROUP BY bucket
      ORDER BY bucket
    `);
    }
}
tslib_1.__decorate([
    autobind_decorator_1.default
], IrohaDb.prototype, "fork", null);
tslib_1.__decorate([
    autobind_decorator_1.default
], IrohaDb.prototype, "blocksByHeight", null);
tslib_1.__decorate([
    autobind_decorator_1.default
], IrohaDb.prototype, "transactionsByHash", null);
tslib_1.__decorate([
    autobind_decorator_1.default
], IrohaDb.prototype, "accountsById", null);
tslib_1.__decorate([
    autobind_decorator_1.default
], IrohaDb.prototype, "peersByPublicKey", null);
tslib_1.__decorate([
    autobind_decorator_1.default
], IrohaDb.prototype, "rolesByName", null);
tslib_1.__decorate([
    autobind_decorator_1.default
], IrohaDb.prototype, "domainsById", null);
exports.IrohaDb = IrohaDb;
//# sourceMappingURL=iroha-db.js.map