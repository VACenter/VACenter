const path = require('path');
const config = require('config');


function handle(req, res, next, config) {
    res.render(path.join(__dirname, '../../', 'output', "login.html"), {
        va: config.vaInfo,
        bg: config.customizations.bg
    })
}

module.exports = {
    handle
}