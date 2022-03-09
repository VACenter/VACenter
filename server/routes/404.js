const path = require('path');

function handle(req,res,next, config){
    res.render(path.join(__dirname, '../../', 'output', "404.html"), {
        va: config.vaInfo,
        bg: config.customizations.bg
    })
}

module.exports = {
    handle
}