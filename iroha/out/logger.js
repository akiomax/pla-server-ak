"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLogLevel = exports.checkLogLevel = exports.logger = void 0;
const tslib_1 = require("tslib");
const winston_1 = require("winston");
const config_1 = tslib_1.__importDefault(require("./config"));
const transport = new winston_1.transports.Console();
transport.handleExceptions = true;
transport.handleRejections = true;
exports.logger = (0, winston_1.createLogger)({
    transports: [transport],
    format: winston_1.format.combine(winston_1.format.timestamp(), winston_1.format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`)),
});
exports.logger.exceptions.handle();
exports.logger.rejections.handle();
// "ed25519.js" sets up "uncaughtException" and "unhandledRejection" and kills process.
// Logger must load before "ed25519.js" to set up those listeners early and get the event.
// https://github.com/soramitsu/iroha-ed25519.js/blob/3da98309f2fb4cd3e1ad66de56039ab58f95ef6b/lib/ed25519.js#L104
if (require.resolve('ed25519.js') in require.cache) {
    throw new Error(`"${__filename}" must be imported before "ed25519.js"`);
}
const checkLogLevel = level => /^(error|warn|info|debug)$/i.test(level);
exports.checkLogLevel = checkLogLevel;
function setLogLevel(level) {
    if (!(0, exports.checkLogLevel)(level)) {
        throw new Error(`Unrecognized "LOG_LEVEL=${level}"`);
    }
    exports.logger.level = level.toLowerCase();
}
exports.setLogLevel = setLogLevel;
setLogLevel(config_1.default.logLevel);
//# sourceMappingURL=logger.js.map