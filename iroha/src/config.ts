export default {
	iroha: {
		host: "localhost:50051",
		admin: {
			accountId: "admin@test",
			privateKey:
				"f101537e319568c765b2cc89698325604991dca57b9716b58016b253506cab70",
		},
	},
	postgres: "postgres://postgres:mysecretpassword@localhost/postgres",
	disableSync: false,
	logLevel: process.env.LOG_LEVEL || "info",
};
