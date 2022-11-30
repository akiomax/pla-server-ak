"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connect = exports.db = exports.pool = void 0;
const tslib_1 = require("tslib");
const slonik_1 = require("slonik");
const config_1 = tslib_1.__importDefault(require("./config"));
const iroha_db_1 = require("./iroha-db");
const logger_1 = require("./logger");
exports.pool = (0, slonik_1.createPool)(config_1.default.postgres);
exports.db = new iroha_db_1.IrohaDb(exports.pool);
async function connect() {
    try {
        await exports.pool.query((0, slonik_1.sql) `SELECT 1`);
    }
    catch (error) {
        logger_1.logger.error('database connection failed');
        throw error;
    }
}
exports.connect = connect;
//# sourceMappingURL=db.js.map