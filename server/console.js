const fs = require("fs");
const pathModule = require("path");
const { keys } = Object;
const { Console } = console;

/**
 * Redirect console to a file.  Call without path or with false-y
 * value to restore original behavior.
 * @param {string} [path]
 */
function file(path) {
    const con = path ? new Console(fs.createWriteStream(pathModule.join(__dirname, path), { flags: 'a' })) : null;

    if(path){
        //Add prefix (LOG)
        var originalConsoleLog = con.log;
        con.log = function () {
            args = [];
            args.push(`[LOG, ${new Date().toISOString()}]`);
            // Note: arguments is part of the prototype
            for (var i = 0; i < arguments.length; i++) {
                args.push(arguments[i]);
            }
            originalConsoleLog.apply(console, args);
        };
        //Add prefix (ERROR)
        var originalConsoleError = con.error;
        con.error = function () {
            args = [];
            args.push(`[ERROR, ${new Date().toISOString()}]`);
            // Note: arguments is part of the prototype
            for (var i = 0; i < arguments.length; i++) {
                args.push(arguments[i]);
            }
            originalConsoleError.apply(console, args);
        };
        //Add prefix (WARN)
        var originalConsoleWarn = con.warn;
        con.warn = function () {
            args = [];
            args.push(`[WARN, ${new Date().toISOString()}]`);
            // Note: arguments is part of the prototype
            for (var i = 0; i < arguments.length; i++) {
                args.push(arguments[i]);
            }
            originalConsoleWarn.apply(console, args);
        };
        //Add prefix (INFO)
        var originalConsoleInfo = con.info;
        con.info = function () {
            args = [];
            args.push(`[INFO, ${new Date().toISOString()}]`);
            // Note: arguments is part of the prototype
            for (var i = 0; i < arguments.length; i++) {
                args.push(arguments[i]);
            }
            originalConsoleInfo.apply(console, args);
        };
    }

    keys(Console.prototype).forEach(key => {
        if (path) {
            this[key] = (...args) => con[key](...args);
        } else {
            delete this[key];
        }
    });
};

// patch global console object and export
module.exports = console.file = file;