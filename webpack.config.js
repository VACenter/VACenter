const path = require('path');

module.exports = {
    entry: './src/assets/index.js',
    output: {
        filename: 'assets/index.js',
        path: path.resolve(__dirname, 'output'),
    },
};