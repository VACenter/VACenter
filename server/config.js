const { EventEmitter } = require('events');
const eventEmit = new EventEmitter();
const fs = require('fs');
const path = require('path');
let cachedConfig = null;
let recache = true;

// Get Config
function getConfig() {
    if (cachedConfig && recache == false) {
        return cachedConfig;
    } else {
        cachedConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));
        recache = false;
        return cachedConfig;
    }
}

//Update Config
function updateConfig(config) {
    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
    recache = true;
    eventEmit.emit("configChange");
}


module.exports = {
    get: getConfig,
    update: updateConfig,
    eventListener: eventEmit
}