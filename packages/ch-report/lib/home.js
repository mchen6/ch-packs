'use strict';
// Where the launcher keeps its files: $COUNTINGHOUSE_HOME, else ~/.countinghouse.
const os = require('node:os');
const path = require('node:path');

module.exports = {home: () => process.env.COUNTINGHOUSE_HOME || path.join(os.homedir(), '.countinghouse')};
