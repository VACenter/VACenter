//@ts-check

//Dependancies
const fs = require('fs');
var sanitizer = require('sanitizer');
const path = require('path');
const bcrypt = require('bcrypt');
const chalk = require('chalk');
var bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const rateLimit = require("express-rate-limit");
const checkDiskSpace = require("check-disk-space").default;
var multer = require('multer');
const OS = require('os');
require('dotenv').config()
const tinify = require("tinify");
tinify.key = "KfplF6KmZjMWXfFx8vqrXM8r4Wbtyqtp";
const express = require('express');
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");
const csv = require('csvtojson')
const request = require('request');
const atob = require('atob');
let operatorSearchable = new Map();

let hosting = process.env.HOSTFLAG ? true : false;



//Storage
let store = [];
let rootPath = "";
switch(OS.type()){
    case "Windows_NT":
        rootPath = ((__dirname).split(':'))[0] + ":/";
        break;
    case "Darwin":
        rootPath = "/";
        break;
    case "Linux":
        rootPath = "/";
        break;
}
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, `${__dirname}/../data/images/`)
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}`) //Appending extension
    }
})
var upload = multer({ storage: storage });

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
checkDiskSpace(rootPath).then((diskSpace) => {
    store.push(((diskSpace.size - diskSpace.free) / diskSpace.size ) * 100)
    store.push(formatBytes((diskSpace.size - diskSpace.free), 2))
    store.push(formatBytes(diskSpace.size, 2))
})

//Parts
const { FileWrite, FileRead, FileExists, FileRemove } = require('./fileFunctions.js')
const { JSONReq, URLReq, MethodValues } = require("./urlreqs")
const { 
        db, GetPPURL,
        GetAircraft, GetAircrafts, CreateAircraft, DeleteAircraft,
        GetEvent, GetEvents, CreateEvent, DeleteEvent,
        GetNotifications, CreateNotification, DeleteNotification, DeleteUsersNotifications,
        GetOperatorByName, GetOperator, GetOperators, CreateOperator, DeleteOperator,
        GetPirep, GetUsersPireps, GetPireps, CreatePirep, UpdatePirep,
        GetRank, GetRanks, UpdateRank, CreateRank, DeleteRank,
        GetRoute, GetRoutes, GetRouteByNum, CreateRoute, UpdateRoute, DeleteRoute,
        GetStats, UpdateStat, DeleteStat,
        GetToken, CreateToken, DeleteTokens,
        GetUser, GetUsers, CreateUser, UpdateUser, DeleteUser, run,
        GetLinks, CreateLink, DeleteLink,
        CreateSession, GetSession, GetSessionByPilot, UpdateSession, DeleteSession,
        CreateMulti, GetMultipliers, GetMultiplier, GetMultiplierByLabel, DeleteMulti
    } = require("./db")
const { getVersionInfo } = require("./update");
const { getVANetData, getVANetUser, createVANetPirep } = require('./vanet.js');
const webhook = require("./webhook.js");
//update();

let routeSearchable = new Map();
function resetRoutes(){
    routeSearchable = new Map();
    GetRoutes().then(list =>{
        list.forEach(route =>{
            routeSearchable.set(route.id, route)
        })
        
    })
}

resetRoutes();

function resetOperators(){
    operatorSearchable = new Map();
    GetOperators().then(list => {
        list.forEach(op=>{
            operatorSearchable.set(op.id, op)
        })
    })
}
resetOperators()

async function reloadUserRanks(){
    (await GetUsers()).forEach(async user =>{
        //@ts-ignore
        user.rank = await testRank(user);
        //@ts-ignore
        UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked, user.VANetID, user.manualRank)
    })
}
reloadUserRanks()


let rankMap = new Map();
function loadRanksMap(){
    rankMap = new Map();
    GetRanks().then(list =>{
        list.forEach(rank =>{
            rankMap.set(rank.label, rank);
        })
    })
}
loadRanksMap();

//Versioning
let branch = getVersionInfo().branch;
let cvn = getVersionInfo().version;
let cvnb = branch == "beta" ? `${cvn}B` : (branch == "alpha" ? `${cvn}A` : `${cvn}M`)
/**
 * Used for checking the version info
 */
function reloadVersion(){
    cvn = getVersionInfo().version;
    cvnb = branch == "beta" ? `${cvn}B` : (branch == "alpha" ? `${cvn}A` : `${cvn}M`)
}

reloadVersion();

/**
 * @typedef {import('./types.js').user} user
 * @typedef {import('./types.js').aircraft} aircraft
 * @typedef {import('./types.js').event} event
 * @typedef {import('./types.js').gate} gate
 * @typedef {import('./types.js').notification} notification
 * @typedef {import('./types.js').operator} operator
 * @typedef {import('./types.js').PIREP} PIREP
 * @typedef {import('./types.js').rank} rank
 * @typedef {import('./types.js').route} route
 * @typedef {import('./types.js').statistic} statistic
 * @typedef {import('./types.js').link} link
 * @typedef {import('./types.js').fsession} fsession
 * @typedef {import('./types.js').Multiplier} Multiplier
 */
function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

function randomizator(a, b) {
    return Math.floor(Math.random() * b) + a;
}
const getAppCookies = (req) => {
    if (req.headers.cookie) {
        // We extract the raw cookies from the request headers
        const rawCookies = req.headers.cookie.split('; ');
        // rawCookies = ['myapp=secretcookie, 'analytics_cookie=beacon;']

        const parsedCookies = {};
        rawCookies.forEach(rawCookie => {
            const parsedCookie = rawCookie.split('=');
            // parsedCookie = ['myapp', 'secretcookie'], ['analytics_cookie', 'beacon']
            parsedCookies[parsedCookie[0]] = parsedCookie[1];
        });
        return parsedCookies;
    } else {
        return {};
    }
};
function mode(array) {
    if (array.length == 0)
        return null;
    var modeMap = {};
    var maxEl = array[0], maxCount = 1;
    for (var i = 0; i < array.length; i++) {
        var el = array[i];
        if (modeMap[el] == null)
            modeMap[el] = 1;
        else
            modeMap[el]++;
        if (modeMap[el] > maxCount) {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    return maxEl;
}

//Config
let config = {
    other: {
        rates: 100,
        applications:{
            state: false,
            link: ""
        }
    }
};

function getConfig() {
    // @ts-ignore
    return JSON.parse(fs.readFileSync(`${__dirname}/../config.json`));
    //return require("./../config.json");
}

/**
 * Reloads Config
 * @name Reload Config
 */
function reloadConfig(){
    return new Promise((resolve, error)=>{
            config = getConfig();
            resolve(true);
    })
    
}



reloadConfig()
setInterval(reloadConfig, 15000);

let stats = {};

/**
 * Reload Stats for VA
 * @returns {Promise}
 */

function reloadStats(){
    return new Promise(async (resolve) => {
        stats = await GetStats();
        resolve(true);
    })
}

function compareRanks(a, b) {
    if (a.minH < b.minH) {
        return -1;
    }
    if (a.minH > b.minH) {
        return 1;
    }
    return 0;
}

/**
 * 
 * @param {user} ownerObj 
 * @returns {Promise<(any)>}
 */
const testRank = async (ownerObj) =>{
    let store = ownerObj.rank;
    return new Promise(async resolve =>{
        if(ownerObj){
            if(ownerObj.manualRank != 1){
                const ranks = await GetRanks();
                ranks.sort(compareRanks);
                for (var i = 0; i < ranks.length; i++){
                    let rank = ranks[i];
                    if(rank.manual == 0){
                        if(ownerObj.hours >= rank.minH){
                            ownerObj.rank = rank.label;
                        }
                    }
                }
                if (store != ownerObj.rank && config.other) {
                    webhook.send({ title: "Rank up!", description: `${config.code}${ownerObj.username} has achieved the rank of ${ownerObj.rank}` });
                }
                resolve(ownerObj.rank);
            }else{
                resolve(ownerObj.rank)
            }
        }else{
            resolve(false);
        }
    })
}

const updateStats = async () => {
    //Craft
    let craftArray = [];
    stats.popularCraft = "";
    (await GetPireps()).forEach(pirep => {
        craftArray.push(pirep.vehiclePublic)
    })
    stats.popularCraft = mode(craftArray);
    //Lead Pilots
    stats.leadPilot = ["Unknown", 0];
    (await GetUsers()).forEach(user => {
        if(stats.leadPilot[0] == "Unknown"){
            // @ts-ignore
            stats.leadPilot = [user.username, user.hours];
        }
        // @ts-ignore
        if(user.hours > stats.leadPilot[1]){
            // @ts-ignore
            stats.leadPilot = [user.username, user.hours];
        }
        
    })
    //Hours + PIREPS
    stats.totalHours = 0;
    stats.pirepsLength = 0;
    (await GetPireps()).forEach(pirep =>{
        stats.pirepsLength++;
        if(pirep.status == "a"){
            stats.totalHours = stats.totalHours + (pirep.flightTime)/60
        }
    })
}
setInterval(updateStats, 120000)
updateStats();

let vanetCraft = new Map();


setInterval(async () => {
    if (config.other) {
        if (config.other.ident) {
            vanetCraft = (await getVANetData());
        }
    }
}, 1000 * 60 * 30);
setTimeout(async () => {
    if (config.other) {
        if(config.other.ident){
            vanetCraft = (await getVANetData());
        }
    }
}, 5000);




//App
const app = express();
//Sentry
Sentry.init({
    dsn: "https://770628b2aa5447f8906e75e5c4904c48@o996992.ingest.sentry.io/5955471",
    integrations: [
        // enable HTTP calls tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // enable Express.js middleware tracing
        new Tracing.Integrations.Express({ app }),
    ],
    environment: "Production",
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
});
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
app.set('view engine', "ejs");
app.set('views', path.join(__dirname, '/../views'));
console.log(chalk.green("Starting VACenter"))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(function(req,res,next){
    res.locals.rank_search = rankMap;
    res.locals.version = cvnb;
    res.locals.operator_search = operatorSearchable;
    res.locals.route_search = routeSearchable;
    next();
})
let limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200 // limit each IP to 200 requests per windowMs
});
app.use(limiter);
//app.use(cookieParser());

//Util Funcs


/**
 * Removes the pain of foreign languages
 * @param {String} str 
 * @returns {String}
 */
function removeDiacritics(str) {

    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "")

}

/**
 * GetConfig - Used for every request;
 * @returns {Object}
 */


//Test for Applications
let appConfig = getConfig();
if(appConfig.other){
    if(appConfig.other.applications){

    } else {
        appConfig.other.applications = {
            state: false,
            link: ""
        }
        fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(appConfig, null, 2));
    }
}

/**
 * CheckCPWD - Used for checking if a user needs to change their password.
 * @param {Object} cookies 
 * @returns {Promise<boolean>}
 */
function checkForCPWD(cookies) {
    return new Promise((async resolve => {
        if (cookies.authToken) {
            const UID = await GetToken(cookies.authToken)
            if (UID) {
                if(UID.user){
                const user = await GetUser(UID.user);
                if (user) {
                    if (user.cp) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            }else{
                resolve(false)
            }
            } else {
                resolve(false);
            }
        } else {
            resolve(false);
        }
    }))
}

/**
 * Check for User
 * @param {Object} cookies 
 * @returns {Promise<boolean|Object>} User Obj, or False
 */
function checkForUser(cookies){
    return new Promise((async resolve => {
        if(cookies.authToken){
            const Token = await GetToken(cookies.authToken)
            if (Token) {
                if(Token.user){
                    const user = await GetUser(Token.user);
                    if (user) {
                        resolve(user);
                    } else {
                        resolve(false);
                    }
                }else{
                    resolve(false)
                }
            } else {
                resolve(false);
            }
        }else{
            resolve(false);
        }
    }))
}

/**
 * Add a users notifications to an object
 * @param {user} userObj 
 * @param {array} flags
 * @returns {Promise<user>} User with Flagged data
 */
async function getUserWithObjs(userObj, flags){
    return new Promise((async resolve => {
        if(flags.includes('notifications')){
            const notfs = await GetNotifications(userObj.username)
            userObj.notifications = notfs;
        }
        if(flags.includes('pireps')){
            const pireps = await GetUsersPireps(userObj.username)
            userObj.pireps = pireps;
        }
        resolve(userObj);
    }))
}

async function getRoutesWithOperator(){
    return new Promise(async (resolve, error)=>{
        try{
            const routes = await GetRoutes();
            let ticker = 0;
            routes.forEach(async route => {
                route.operatorPublic = (await GetOperator(route.operator)).name;
                route.operatorCode = (await GetOperator(route.operator)).code;
                ticker++;
            })
            let checker = setInterval(() => {
                if (ticker >= routes.length) {
                    clearInterval(checker);
                    resolve(routes);
                }
            }, 100);
        }catch(err){
            console.error(err);
        }
    })
}

async function getRouteWithOperator(id){
    return new Promise(async (resolve, error) => {
        const route = await GetRoute(id);
        route.operatorPublic = (await GetOperator(route.operator)).name;
        route.operatorCode = (await GetOperator(route.operator)).code;
        resolve(route);
    })
}

//Basic Routes

app.get('/api/data/user/:callsign', async (req, res) => {
    if(req.query.auth){
        if(req.query.auth == config.other.ident.slice(0,5)){
            if (req.params.callsign) {
                let callsign = req.params.callsign.toString();
                if (callsign.toString().slice(0, 4) == config.code) {
                    callsign = callsign.slice(4, callsign.length);
                }
                let user = await GetUser(callsign)
                if (user) {
                    user = await getUserWithObjs(await GetUser(callsign), ["pireps"])
                    delete user['password'];
                    delete user['admin'];
                    delete user['VANetID'];
                    delete user['cp'];
                    delete user['llogin'];
                    delete user['revoked'];
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).end(JSON.stringify(user, null, 2));
                } else {
                    res.sendStatus(404);
                }
            } else {
                res.sendStatus(400);
            }
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(401);
    }
})
app.get('/api/data/pirep/:id', async (req, res) => {
    if (req.query.auth) {
        if (req.query.auth == config.other.ident.slice(0, 5)) {
            if (req.params.id) {
                let id = req.params.id;
                let pirep = await GetPirep(id);
                if (pirep) {
                    // delete user['password'];
                    // delete user['admin'];
                    // delete user['VANetID'];
                    // delete user['cp'];
                    // delete user['llogin'];
                    // delete user['revoked'];
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).end(JSON.stringify(pirep, null, 2));
                } else {
                    res.sendStatus(404);
                }
            } else {
                res.sendStatus(400);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(401);
    }
})
app.get('/api/data/stats', async (req, res) => {
    if (req.query.auth) {
        if (req.query.auth == config.other.ident.slice(0, 5)) {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).end(JSON.stringify(stats, null, 2));
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(401);
    }
})
app.get('/api/data/config', async (req, res) =>{
    if (req.query.auth) {
        if (req.query.auth == config.other.ident.slice(0, 5)) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200);
            const newObj = config;
            delete newObj.other.ident;
            delete newObj.other.webhook;
            if(newObj.key){
                delete newObj.key;
                delete newObj.key;
                delete newObj.boostingTier;
            }
            res.end(JSON.stringify(newObj, null, 2));
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(401);
    }
})

app.post('/import/:comp', upload.single('csv'), async (req, res) => {
    const cookies = getAppCookies(req);
    if(((!config.code) && req.path != "/setup")){
        if((!config.code) && req.path != "/setup"){
            res.redirect('/setup')
        }else{
            res.redirect("/?r=ue")
        }
    }else{
        const changePWD = await checkForCPWD(cookies);
        let user = await checkForUser(cookies);
        if(user){
            user = await getUserWithObjs(user, ["notifications", "pireps"]);
        }
        if(changePWD == true && req.path != "/changePWD"){
            res.redirect('/changePWD');
        }else if(user.revoked == 1){
            res.clearCookie('authToken').redirect("/?r=ro")
        }else{
            switch(req.params.comp){
                case "routes":
                    let errorAllReadySent = false;
                    if(req.file){
                        let ticker = 0;
                        let max = 0;
                        csv().fromFile(req.file.path).then((jsonObj) => {
                            max = jsonObj.length;
                            jsonObj.forEach(async row => {
                                    ticker++;
                                    if (row.num && row.flightTime && row.operator && row.aircraftID && row.depICAO && row.arrICAO && row.rank) {
                                        const aircraft = await GetAircraft(row.aircraftID);
                                        if (aircraft) {
                                            const rank = await GetRank(row.rank);
                                            if (rank) {
                                                if (Array.isArray(rank) == false) {
                                                    if(errorAllReadySent == false){
                                                        console.log(row.operator);
                                                    }
                                                    
                                                    const operator = await GetOperatorByName(row.operator);;
                                                    if (operator) {
                                                                if (errorAllReadySent == false) {
                                                                    CreateRoute(makeid(50), row.num, parseInt(row.flightTime), operator.id, aircraft.livID, row.depICAO, row.arrICAO, aircraft.publicName, rank.minH.toString());
                                                                };
                                                    } else {
                                                        if (errorAllReadySent == false) {
                                                            errorAllReadySent = true;
                                                            res.status(404);
                                                            res.send(`Could not find Operator with the name: ${sanitizer.sanitize(row.operator)} (On ${row.num}, ${row.depICAO}, ${row.arrICAO})`)
                                                        }
                                                    }
                                                } else {
                                                    if (errorAllReadySent == false) {
                                                        errorAllReadySent = true;
                                                        res.status(400);
                                                        res.send(`Found 2 Ranks with the name: ${sanitizer.sanitize(row.rank)}, please update your ranks.`)
                                                    }
                                                }
                                            } else {
                                                if (errorAllReadySent == false) {
                                                    errorAllReadySent = true;
                                                    res.status(404);
                                                    res.send(`Can't find rank by the name: ${sanitizer.sanitize(row.rank)}`)
                                                }
                                            }
                                        } else {
                                            if (errorAllReadySent == false) {
                                                errorAllReadySent = true;
                                                res.status(404);
                                                res.send(`Can't find aircraft with the ID: ${sanitizer.sanitize(row.aircraftID)}. Check the aircraft is in your fleet.`);
                                            }
                                        }
                                    } else {
                                        if(errorAllReadySent == false){
                                            errorAllReadySent = true;
                                            res.status(400);
                                            res.send("Oh no! One of your rows was missing some data, please check you have used the template correctly.");
                                        }
                                    }
                                    console.log(max, ticker)
                                    if (errorAllReadySent == false && ticker == max) {
                                        res.redirect("/admin/routes");
                                    }
                            })
                        })
                    }else{
                        res.status(400).send("Missing file.")
                    }
                    break;
            }
        }
    }
});

app.get('*', async (req, res, next)=>{
    const cookies = getAppCookies(req)
    if (req.path.slice(0, 8) == "/public/") {
        if (await FileExists(path.join(__dirname, "..", req.path))) {
            res.sendFile(path.join(__dirname, "..", req.path));
        } else {
            res.sendStatus(404);
        }
    } else if (req.path.slice(0, 6) == "/data/") {
        if (await FileExists(path.join(__dirname, "..", req.path))) {
            res.sendFile(path.join(__dirname, "..", req.path));
        } else {
            res.sendStatus(404);
        }
    }else if(req.path == '/mirrorContent'){
        const safedContent = sanitizer.sanitize(atob(req.query.content.toString()));
        res.render("contentMirror", {
            content: safedContent
        })
    } else {

        //Check for setup
        if (((!config.code) && req.path != "/setup")) {
            if ((!config.code) && req.path != "/setup") {
                res.redirect('/setup')
            } else {
                res.redirect("/?r=ue")
            }
        } else {
            const changePWD = await checkForCPWD(cookies);
            let user = await checkForUser(cookies);
            if (user) {
                user = await getUserWithObjs(user, ["notifications", "pireps"]);
                delete user['password'];
                seenUser(user.username);
            }
            if (changePWD == true && req.path != "/changePWD") {
                res.redirect('/changePWD');
            } else if (user.revoked == 1) {
                res.clearCookie('authToken').redirect("/?r=ro")
            } else {
                let sesID;
                let session;
                if (req.path.toUpperCase().includes("SLOT")) {
                    sesID = parseInt(req.query.ses.toString());
                    //Get Session Obj
                    session = await GetSession(sesID);
                }
                switch (req.path) {
                    case "/login":
                    case "/":
                        if (user) {
                            res.redirect("/home");
                        } else {
                            res.render("login", {
                                config: getConfig(),
                                version: cvnb
                            })
                        }
                        break;
                    case "/home":
                        if (user) {
                            let vics = [];
                            let currentSession = null;
                            (await GetSessionByPilot(user.username)).every(session => {
                                if (session.active) {
                                    currentSession = session;
                                    return false;
                                }
                                return true;
                            });
                            (await GetUsersPireps(user.username)).forEach(pirep => {
                                vics.push(pirep.vehiclePublic)
                            })
                            res.render("home", {
                                active: req.path,
                                title: "Dashboard",
                                user: user,
                                config: getConfig(),
                                vics: vics,
                                mode: mode,
                                currentSession: currentSession,
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }

                        break;
                    case "/newPirep":
                        if (user) {
                            let activeFlight = {
                                id: -1
                            };
                            let activeFlightBool = false;
                            (await GetSessionByPilot(user.username)).every(session => {
                                if (session.active) {
                                    activeFlightBool = true;
                                    activeFlight = session;
                                    return false;
                                }
                                return true;
                            })
                            res.render("npirep", {
                                active: req.path,
                                title: "New Flight",
                                user: user,
                                routes: await getRoutesWithOperator(),
                                craft: await GetAircrafts(),
                                ops: await GetOperators(),
                                config: getConfig(),
                                multipliers: await GetMultipliers(),
                                allowNSession: !(activeFlightBool),
                                activeFlight: activeFlight
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }

                        break;
                    case "/oldPirep":
                        if (user) {
                            res.render("opirep", {
                                active: req.path,
                                title: "Previous Flights",
                                user: user,
                                pireps: await GetUsersPireps(user.username),
                                config: getConfig()
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/events":
                        if (user) {
                            res.render("events", {
                                active: req.path,
                                title: "Events",
                                user: user,
                                events: await GetEvents(),
                                config: getConfig()
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/links":
                        if (user) {
                            res.render("links", {
                                active: req.path,
                                title: "Links",
                                user: user,
                                links: await GetLinks(),
                                config: getConfig()
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/stats/me":
                        if (user) {
                            delete user['password'];
                            res.render("stats/me", {
                                active: req.path,
                                title: "My Stats",
                                user: user,
                                config: getConfig(),
                                stats: stats
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/stats/va":
                        if (user) {
                            const specConfig = getConfig();
                            delete specConfig.other['ident'];
                            delete specConfig['key'];
                            delete specConfig['id'];
                            res.render("stats/va", {
                                active: req.path,
                                title: "VA Stats",
                                user: user,
                                config: specConfig,
                                stats: stats,
                                aircraft: await GetAircrafts(),
                                routes: await getRoutesWithOperator(),
                                pireps: await GetPireps(),
                                pilotSize: (await GetUsers()).length
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/account":
                        if (user) {
                            res.render("account", {
                                active: req.path,
                                title: "Account",
                                user: user,
                                config: getConfig()
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/aircraft":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/aircraft", {
                                    active: req.path,
                                    title: "Admin - Aircraft",
                                    user: user,
                                    activer: "/admin",
                                    aircraft: await GetAircrafts(),
                                    listCraft: vanetCraft,
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/events":

                        if (user) {

                            if (user.admin == true) {
                                res.render("admin/events", {
                                    active: req.path,
                                    title: "Admin - Events",
                                    user: user,
                                    activer: "/admin",
                                    aircraft: await GetAircrafts(),
                                    events: await GetEvents(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/pireps":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/pireps", {
                                    active: req.path,
                                    title: "Admin - PIREPS",
                                    user: user,
                                    activer: "/admin",
                                    aircraft: await GetAircrafts(),
                                    pireps: await GetPireps(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/ranks":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/ranks", {
                                    active: req.path,
                                    title: "Admin - Ranks",
                                    user: user,
                                    activer: "/admin",
                                    aircraft: await GetAircrafts(),
                                    ranks: await GetRanks(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/routes":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/routes", {
                                    active: req.path,
                                    title: "Admin - Routes",
                                    user: user,
                                    activer: "/admin",
                                    craft: await GetAircrafts(),
                                    ops: await GetOperators(),
                                    routes: await getRoutesWithOperator(),
                                    ranks: await GetRanks(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/users":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/users", {
                                    active: req.path,
                                    title: "Admin - Users",
                                    user: user,
                                    activer: "/admin",
                                    ranks: await GetRanks(),
                                    users: await GetUsers(),
                                    ops: await GetOperators(),
                                    routes: await GetRoutes(),
                                    config: getConfig(),
                                    pireps: await GetPireps()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                        break;
                    case "/admin/links":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/links", {
                                    active: req.path,
                                    title: "Admin - Links",
                                    user: user,
                                    activer: "/admin",
                                    links: await GetLinks(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/multi":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/multi", {
                                    active: req.path,
                                    title: "Admin - Multi",
                                    user: user,
                                    activer: "/admin",
                                    Multipliers: await GetMultipliers(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }

                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;

                    case "/admin/import":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/import", {
                                    active: req.path,
                                    title: "Admin - Import",
                                    user: user,
                                    activer: "/admin",
                                    config: getConfig(),
                                    listCraft: vanetCraft
                                })
                            } else {
                                res.sendStatus(403);
                            }
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/codeshare":
                        if (user) {
                            if (user.admin == true) {
                                res.render("admin/codeshare", {
                                    active: req.path,
                                    title: "Admin - Operators",
                                    user: user,
                                    activer: "/admin",
                                    operators: await GetOperators(),
                                    config: getConfig()
                                })
                            } else {
                                res.sendStatus(403);
                            }
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin/settings":
                        if (user) {
                            if (user.admin == true) {
                                res.setHeader("Access-Control-Allow-Origin", "*");
                                res.render("admin/settings", {
                                    active: req.path,
                                    title: "Admin - Settings",
                                    user: user,
                                    activer: "/admin",
                                    operators: await GetOperators(),
                                    config: getConfig(),
                                    cv: cvnb,
                                    store: store,
                                    hosting: hosting
                                })
                            } else {
                                res.sendStatus(403);
                            }
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/report":
                        res.redirect("https://github.com/VACenter/VACenter/issues/new?assignees=&labels=bug&template=bug_report.md&title=")
                        break;
                    case '/changePWD':
                        if (user) {
                            res.render("changePWD", {
                                config: getConfig()
                            })
                        }
                        break;
                    case "/setup":
                        if (config.other) {
                            res.redirect("/")
                        } else {
                            res.render("setup", {
                                hosting: hosting
                            })
                        }
                        break;
                    case "/getLivData":
                        res.send(JSON.stringify(vanetCraft.get(req.query.liv)))
                        break;
                    case "/logout":
                        res.clearCookie("authToken").redirect("/");
                        break;
                    case "/cancelSlot":
                        if (session) {
                            if (session.pilot == user.username) {
                                await DeleteSession(sesID.toString());
                                res.redirect('/home');
                            } else {
                                res.status(403).send("You aren't the designated pilot for this session.");
                            }

                        } else {
                            res.status(404).send("Cant find session with ID: " + sesID);
                        }
                        break;
                    case "/slotUI":
                        if (session) {
                            if (session.pilot == user.username) {
                                res.render('slotUI', {
                                    user: user,
                                    config: getConfig(),
                                    session: session,
                                    aircraft: await GetAircrafts(),
                                    route: await GetRoute(session.route),
                                    vehicleUsed: await GetAircraft(session.aircraft),
                                    multipliers: await GetMultipliers()
                                })
                            } else {
                                res.status(403).send("You aren't the designated pilot for this session.");
                            }

                        } else {
                            res.status(404).send("Cant find session with ID: " + sesID);
                        }
                        break;
                    case "/newFlightUI":
                        const routeNum = req.query.route.toString();
                        //Get Route Obj
                        const route = await GetRouteByNum(routeNum);
                        if (route) {
                            //Create Session
                            const sesID = await CreateSession(user.username, route.id.toString())
                            res.redirect(`/slotUI?ses=${sesID.toString()}`)
                        } else {
                            res.status(404).send("Cant find route with ID: " + sanitizer.sanitize(routeNum));
                        }
                        break;
                    default:
                        next();
                        break;
                }
            }
        }
    }
})

app.get("/debug-sentry", function mainHandler(req, res) {
    throw new Error("An error occured!");
});

app.get("*", (req, res, next) => {
    res.render("404", {
        config: getConfig()
    })
})


app.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    res.statusCode = 500;
    res.end(res.sentry + "\n");
});

app.listen(process.env.PORT, () => {
    console.log(chalk.green("Listening on port " + process.env.PORT));
});

//login
app.post("/login", async (req,res) =>{
    if(req.body.user && req.body.pwd){
        const user = await GetUser(req.body.user);
        if (user){
            if(user.revoked != 1){
                if (bcrypt.compareSync(req.body.pwd, user.password) == true) {
                    const token = makeid(50);
                    CreateToken(token, user.username);
                    res.cookie("authToken", token, { maxAge: new Date().getTime() + (10 * 365 * 24 * 60 * 60) }).redirect("/home")
                } else {
                    res.redirect('/?r=ii');
                }
            }else{
                res.redirect('/?r=ro');
            }
        }else{
            res.redirect('/?r=ii')
        }
    }else{
        res.sendStatus(400)
    }
})

//setup
app.post('/setup', async (req,res)=>{
    if ((!config.code)){
    if(req.body.key){
        const Req = await URLReq(MethodValues.GET, "https://api.vanet.app/airline/v1/profile", { 'X-Api-Key': req.body.key}, null, null)
        if(Req[0]){
            res.status(500).send(Req[0]);
        }
        if(Req[1].statusCode == 200){
            const newConfig = JSON.parse(Req[1].body).result;
            newConfig.key = req.body.key;
            newConfig.other = {
                bg: "/public/images/stockBG2.jpg",
                logo: "https://va-center.com/public/images/logo.webp",
                rates: 100,
                navColor: ["dark", "dark", "primary"],
                applications: {
                    state: false,
                    link: ""
                },
                btnColor: false,
                ident: makeid(25),
                pirepPic: false,
                pirepPicExpire: 86400000,
            }
            await FileWrite(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            setTimeout(async () => {
                await reloadConfig();
                setTimeout(async () => {
                    const regReq = await URLReq(MethodValues.POST, "https://admin.va-center.com/stats/instances/new", null, null, {
                        version: `${cvnb}`,
                        airline: config.name,
                        vanetKey: config.key,
                        type: "VANET",
                        wholeConfig: JSON.stringify(config)
                    });
                    config.other.ident = regReq[2];
                    await FileWrite(`${__dirname}/../config.json`, JSON.stringify(config, null, 2));
                    setTimeout(async () => {
                        vanetCraft = await getVANetData();
                    }, 1000)
                    CreateOperator(config.name, 1, newConfig.code);
                    if (regReq[1].statusCode == 200) {
                        await reloadConfig();
                        res.sendStatus(200);
                    } else {
                        await reloadConfig();
                        res.status(regReq[1].statusCode).send(regReq[2])
                    }
                }, 1000);
                
            }, 2000);
            
        }else{
            res.status(Req[1].statusCode).send(Req[2]);
        }
    }else{
        res.sendStatus(400)
    }
    }
})
app.post('/setupNVN', async (req, res) => {
    try{
        if (req.body.data) {
            const data = JSON.parse(req.body.data);
            const newConfig = {
                code: data.code,
                name: data.name
            };
            newConfig.key = req.body.key;
            newConfig.other = {
                bg: "/public/images/stockBG2.jpg",
                logo: "https://va-center.com/public/images/logo.webp",
                rates: 100,
                navColor: ["dark", "dark", "primary"],
                applications: {
                    state: false,
                    link: ""
                },
                btnColor: false,
                ident: makeid(25),
                pirepPic: hosting ? false : data.pirepPictures,
                pirepPicExpire: 86400000,
                webhook: data.webhook
            }
            newConfig.other.navColor = [];
            newConfig.other.navColor.push(data.colors.main.value);
            if (data.colors.main.value == "light") {
                newConfig.other.navColor.push("light");
            } else {
                newConfig.other.navColor.push("dark");
            }
            newConfig.other.navColor.push(data.colors.buttons.value);

            await FileWrite(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            setTimeout(async () => {
                await reloadConfig();
                setTimeout(async () => {
                    const regReq = await URLReq(MethodValues.POST, "https://admin.va-center.com/stats/instances/new", null, null, {
                        version: `${cvnb}`,
                        airline: config.name,
                        vanetKey: config.key,
                        type: "NVANET",
                        wholeConfig: JSON.stringify(config)
                    });
                    config.other.ident = regReq[2];
                    await FileWrite(`${__dirname}/../config.json`, JSON.stringify(config, null, 2));
                    vanetCraft = await getVANetData();
                    CreateOperator(config.name, 1, newConfig.code);
                    webhook.send({ title: "Webhook Setup", description: `Your webhook has been setup successfully!` })
                    res.sendStatus(200);
                }, 1000);

            }, 2000);
        }
    }catch(err){
        res.status(500);
        console.error(err);
        Sentry.captureException(err);
        res.send("err");
    }
    
})

app.post('/OSOR', async(req, res)=>{
    const cookies = getAppCookies(req)
    let user = await checkForUser(cookies);
    if (user) {
        await DeleteTokens(user.username);
        res.redirect("/")
    }else{
        res.sendStatus(401);
    }
})

app.post('/user/update', async(req, res) =>{
    const cookies = getAppCookies(req)
    if (req.body.display && req.body.url) {
        let user = await checkForUser(cookies);
        if (user) {
            if(user.display != req.body.display){
                user.display = req.body.display;
            }
            if(user.profileURL != req.body.url){
                user.profileURL = req.body.url
            }
            await UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked, user.VANetID, user.manualRank)
            res.redirect("/account")
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(400);
    }
})

app.post('/CPWD', async(req, res)=>{
    const cookies = getAppCookies(req)
    if(req.body.npwd){
        let user = await checkForUser(cookies);
        if (user) {
//                if(bcrypt.comuser.password)
                user.password = bcrypt.hashSync(req.body.npwd, 10);
            await UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, false, user.revoked, user.VANetID, user.manualRank)
                await DeleteTokens(user.username);
                res.redirect("/");
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(400);
    }
})

app.post("/newPIREP", upload.single('pirepImg'), async (req, res) => {
    const cookies = getAppCookies(req);
    console.log(req.body)
    if (req.body.routeActual && req.body.aircraft && req.body.ft && req.body.fuel && req.body.depT && (config.other.pirepImg == true ? req.file.path : true)) {
        const route = await GetRoute(req.body.routeActual);
        if(route){
            let user = await checkForUser(cookies);
            if (user) {
                let list = await GetAircrafts();
                let backup = req.body.aircraft;
                req.body.aircraft = null;
                list.forEach(vic => {
                    if (vic.publicName == backup) {
                        req.body.aircraft = vic.livID;
                        return;
                    }
                })
                if (req.body.aircraft) {
                        if (req.file) {
                            fs.readFile(req.file.path, function (err, sourceData) {
                                Sentry.captureException(err);
                                tinify.fromBuffer(sourceData).toBuffer(function (err, resultData) {
                                    Sentry.captureException(err);
                                    fs.unlinkSync(`${req.file.path}`);
                                    req.file.path = req.file.path + ".webp";
                                    fs.writeFileSync(`${req.file.path}`, resultData);
                                })
                            })
                        }
                        let ft = req.body.ft;
                        let comment = req.body.comments ? req.body.comments : "No Comment";
                        if (req.body.multi) {
                            let multi = await GetMultiplierByLabel(req.body.multi)
                            if (multi) {
                                ft = ft * parseFloat((multi.amount).toString());
                                if (comment == "No Comment") {
                                    comment = `Used Multiplier: ${multi.label} (${multi.amount}x)`;
                                } else {
                                    comment += `\n \n Used Multiplier: ${multi.label} (${multi.amount}x)`;
                                }
                            }
                        }
                        if (config.key && user.VANetID) {
                            await createVANetPirep(user.VANetID, route.depICAO, route.arrICAO, (new Date()).toString(), req.body.fuel, ft, req.body.aircraft)
                        }
                        await CreatePirep(req.body.aircraft, (await GetAircraft(req.body.aircraft)).publicName, user.username, route.operator, route.depICAO, route.arrICAO, req.body.route, ft, comment, "n", req.body.fuel, (new Date(req.body.depT)).toString(), (req.file ? `/data/images/${req.file.filename}` : null));
                        webhook.send({ title: "PIREP Submitted", "description": `${config.code}${user.username} has submitted a PIREP, and is awaiting action.` })
                        res.redirect("/");
                } else {
                    res.status(404).send("No aircraft found.")
                }

            } else {
                res.sendStatus(401);
            }
        }else{
            res.status(404);
            res.send("No route found.")
        }
        
    }else{
        res.sendStatus(400);
    }
})



//Data Reqs
//Events
app.post("/admin/events/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.title && req.body.desc && req.body.aircraft && req.body.server && req.body.gates && req.body.depICAO && req.body.arrICAO && req.body.date){
        let user = await checkForUser(cookies);
        if (user) {
            if(user.admin == true){
                await CreateEvent(req.body.title, req.body.desc, req.body.arrICAO, req.body.depICAO, req.body.date, req.body.aircraft, (await GetAircraft(req.body.aircraft)).publicName , req.body.server, req.body.gates.split(","))
                res.redirect("/admin/events");
                webhook.send({ title: "New Event!", description: `A new event has been scheduled (${req.body.title})! Check it out!` });
            }else{
                res.sendStatus(403);
            }
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(400)
    }
})
app.delete("/admin/events/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteEvent(req.body.id);
                res.redirect("/admin/events")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})

//Operators
app.post("/admin/codeshare/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.airName && req.body.airCode) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await CreateOperator(req.body.airName, 0, req.body.airCode)
                res.redirect("/admin/codeshare");
                resetOperators()
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.delete("/admin/codeshare/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteOperator(req.body.id);
                res.redirect("/admin/codeshare");
                resetOperators();
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})

//Rank
app.post("/admin/ranks/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.name && req.body.min) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await CreateRank(req.body.name, req.body.manual ? 1 : 0, req.body.min)
                res.redirect("/admin/ranks");
                loadRanksMap();
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.delete("/admin/ranks/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteRank(req.body.id);
                res.redirect("/admin/ranks");
                loadRanksMap();
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})

//Aircraft
app.post("/admin/aircraft/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.airID && req.body.livID) {
        let user = await checkForUser(cookies);
        let aircraft = vanetCraft.get(req.body.airID)
        if(aircraft){
            let checker = false;
            aircraft.livery.forEach(async liv => {
                if (liv.id == req.body.livID) {
                    checker = true;
                    if (user) {
                        if (user.admin == true) {
                            await CreateAircraft(req.body.livID, req.body.airID, liv.name, (vanetCraft.get(req.body.airID)).name, liv.name + " - " + (vanetCraft.get(req.body.airID)).name)
                            res.redirect("/admin/aircraft");
                            webhook.send({ title: "New Aircraft!", description: `The ${liv.name + " - " + (vanetCraft.get(req.body.airID)).name} has been added to our fleet!` });
                        } else {
                            res.sendStatus(403);
                        }
                    } else {
                        res.sendStatus(401);
                    }
                }
            });
            setTimeout(() => {
                if(checker == false){
                    res.sendStatus(404);
                }
            }, 10000);
        }else{
            res.sendStatus(404);
        }
    } else {
        res.sendStatus(400)
    }
})
app.delete("/admin/aircraft/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteAircraft(req.body.id);
                res.redirect("/admin/aircraft")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
}) 

//Routes
app.post("/admin/routes/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.num && req.body.aircraft && req.body.ft && req.body.depIcao && req.body.arrIcao && req.body.op && req.body.minH) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                let routeID = makeid(50);
                let vehiclePublic = [];
                let counter = 0;
                if (Array.isArray(req.body.aircraft) == false) {
                    let backup = req.body.aircraft;
                    req.body.aircraft = []
                    req.body.aircraft.push(backup);
                }
                req.body.aircraft.forEach(async vic =>{
                    vehiclePublic.push((await GetAircraft(vic)).publicName)
                    counter++;
                })
                let checker = setInterval(async ()=>{
                    if(counter == req.body.aircraft.length) {
                        clearInterval(checker);
                        let vehiclePublicList = vehiclePublic.join(", ");
                        await CreateRoute(routeID, req.body.num, req.body.ft, parseInt(req.body.op), req.body.aircraft.join(','), req.body.depIcao, req.body.arrIcao, vehiclePublicList, req.body.minH.toString());
                        resetRoutes()
                        res.redirect("/admin/routes");
                    }
                }, 250)
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/routes/update", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id && req.body.num && req.body.aircraft && req.body.ft && req.body.depIcao && req.body.arrIcao && req.body.op) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                if(await GetRoute(req.body.id)){
                    let vehiclePublic = [];
                    let counter = 0;
                    if(Array.isArray(req.body.aircraft) == false){
                        let backup = req.body.aircraft;
                        req.body.aircraft = []
                        req.body.aircraft.push(backup);
                    }
                    req.body.aircraft.forEach(async vic => {
                        vehiclePublic.push((await GetAircraft(vic)).publicName)
                        counter++;
                    })
                    let checker = setInterval(async () => {
                        if (counter == req.body.aircraft.length) {
                            clearInterval(checker);
                            let vehiclePublicList = vehiclePublic.join(", ");
                            await UpdateRoute(req.body.id, req.body.num, req.body.ft, req.body.op, req.body.aircraft.join(','), req.body.depIcao, req.body.arrIcao, vehiclePublicList, req.body.rankReq);
                            resetRoutes()
                            res.redirect("/admin/routes")
                        }
                    }, 250)
                }else{
                    res.sendStatus(404);
                }
                
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.delete("/admin/routes/remove", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const route = await GetRoute(req.body.id);
                await DeleteRoute(req.body.id);
                resetRoutes()
                res.redirect("/admin/routes")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})

//Users
app.post("/admin/users/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.username && req.body.password && req.body.IFC && req.body.Name) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const checkForTarget = ((await GetUser(req.body.username)) == undefined)
                if(checkForTarget){
                    let pilotID;
                    try{
                        if(config.key){
                            pilotID = (await getVANetUser(req.body.IFC));
                        }
                    }catch(err) {
                        Sentry.captureException(err);
                        res.status(500).send(sanitizer.sanitize(err));
                    }
                    let vanetid = {
                        status: pilotID ? true: false,
                        id: pilotID ? pilotID : null,
                    }

                    await CreateUser(req.body.username, 0, req.body.manual ? 1 : 0, req.body.admin ? true : false, bcrypt.hashSync(req.body.password, 10), req.body.Name, "/public/images/defaultPP.png", req.body.hours ? req.body.hours : 0, (new Date()).toString(), (new Date(0).toString()), true, 0, vanetid.id)
                    await UpdateUser(req.body.username, await testRank(await GetUser(req.body.username)), req.body.admin ? true : false, bcrypt.hashSync(req.body.password, 10), req.body.Name, "/public/images/defaultPP.png", req.body.hours ? req.body.hours : 0, (new Date()).toString(), (new Date(0).toString()), true, 0, vanetid.id, user.manualRank)
                    
                    res.redirect("/admin/users");
                    webhook.send({ title: "New Pilot!", description: `Welcome ${req.body.Name} (${config.code}${req.body.username}) to the VA!` });
                }else{
                    res.sendStatus(409);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/users/update", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.name && req.body.uid) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const checkForTarget = ((await GetUser(req.body.uid)) != undefined)
                if (checkForTarget) {
                    const target = await GetUser(req.body.uid)
                    if(req.body.name != target.display){
                        target.display = req.body.name;
                    }
                    await UpdateUser(req.body.uid, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, target.cp, target.revoked, target.VANetID, user.manualRank)
                    res.redirect("/admin/users")
                } else {
                    res.sendStatus(409);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/users/rankChange", async function (req, res){
    const cookies = getAppCookies(req)
    if (req.body.uid && req.body.rank) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const target = await GetUser(req.body.uid);
                if(target){
                    target.manualRank = req.body.manual ? 1 : 0;
                    if(target.manualRank == 1){
                        target.rank = (await GetRank(req.body.rank)).label;
                    }else{
                        target.rank = await testRank(target);
                    }
                    UpdateUser(target.username, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, target.cp, target.revoked, target.VANetID, target.manualRank)
                    res.redirect("/admin/users")
                }else{
                    res.sendStatus(404);
                }
            }else{
                res.sendStatus(403)
            }
        }else{
            res.sendStatus(401)
        }
    }else{
        res.sendStatus(400)
    }
})
app.post("/admin/users/revoke", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.uid) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const checkForTarget = ((await GetUser(req.body.uid)) != undefined)
                if (checkForTarget) {
                    const target = await GetUser(req.body.uid)
                    await UpdateUser(req.body.uid, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, target.cp, 1, target.VANetID, user.manualRank)
                    res.redirect("/admin/users")
                } else {
                    res.sendStatus(409);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/users/unrevoke", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.uid) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const checkForTarget = ((await GetUser(req.body.uid)) != undefined)
                if (checkForTarget) {
                    const target = await GetUser(req.body.uid)
                    await UpdateUser(req.body.uid, target.rank, target.admin, bcrypt.hashSync(`VACENTER_REVOKED_PASSWORD`, 10), target.display, target.profileURL, target.hours, target.created, target.llogin, true, 0, target.VANetID, user.manualRank)
                    res.redirect("/admin/users")
                } else {
                    res.sendStatus(409);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400)
    }
})
app.post("/admin/users/resetPWD", async function (req, res){
    const cookies = getAppCookies(req)
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                if (req.body.uid && req.body.newpwd) {
                    let target = await GetUser(decodeURIComponent(req.body.uid));
                    if (target) {
                        target.password = bcrypt.hashSync(decodeURIComponent(req.body.newpwd), 10);
                        await UpdateUser(target.username, target.rank, target.admin, target.password, target.display, target.profileURL, target.hours, target.created, target.llogin, true, target.revoked, target.VANetID, user.manualRank)
                        await DeleteTokens(target.username);
                        res.sendStatus(200);
                    } else {
                        res.sendStatus(404);
                    }
                }else{
                    res.sendStatus(400);
                }
            }else{
                res.sendStatus(403);
            }
        }else{
            res.sendStatus(401);
        }
})
app.post("/users/linkVANet", async function (req, res){
    const cookies = getAppCookies(req)
    let user = await checkForUser(cookies);
    if (user) {
        if (req.body.ifcname) {
            try{
                const pilotID = (await getVANetUser(req.body.ifcname));
                user.vanetID = pilotID;
                await UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked, pilotID, user.manualRank);
                res.redirect("/");
            }catch(err){
                Sentry.captureException(err);
                res.redirect("/account");
            }
        }else{
            res.sendStatus(400);
        }
    }else{
        res.sendStatus(401);
    }
})

//Settings
app.post("/admin/settings/logo", async function (req, res) {
    const cookies = getAppCookies(req)
    if(req.body.value){
    let user = await checkForUser(cookies);
    if (user) {
        if (user.admin == true) {
            const newConfig = getConfig();
            newConfig.other.logo = req.body.value;
            fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            setTimeout(()=>{
                reloadConfig();
                res.redirect("/admin/settings")
            }, 1000)
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(401);
    }
    }else{
        res.sendStatus(400);
    }
})
app.post("/admin/settings/pirepPic", async function (req, res) {
    const cookies = getAppCookies(req)
    let user = await checkForUser(cookies);
    if (user) {
        if (user.admin == true) {
            if(req.body.imgExpireDays){
                const newConfig = getConfig();
                newConfig.other.pirepPic = hosting ? false : (req.body.state == "on" ? true: false);
                newConfig.other.pirepPicExpire = ((((parseFloat(req.body.imgExpireDays) * 24) * 60) * 60) * 1000);
                fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig));
                setTimeout(() => {
                    reloadConfig();
                    res.redirect("/admin/settings");
                    if(req.body.state == "on"){
                        webhook.send({title: "PIREP Images Enabled", description: `${config.name} has turned on PIREP images, now you can submit an image as part of your PIREP.`})
                    }
                }, 1000)
            }
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(401);
    }
})
app.post("/admin/settings/bg", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.value) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const newConfig = getConfig();
                newConfig.other.bg = req.body.value;
                fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig));
                res.redirect("/admin/settings")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})
app.post("/admin/settings/webhook", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.value) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const newConfig = getConfig();
                newConfig.other.webhook = req.body.value;
                fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
                res.redirect("/admin/settings");
                webhook.send({ title: "Webhook Setup", description: `Your webhook has been setup successfully!` })
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})
app.post("/admin/settings/accent", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.accent) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const newConfig = getConfig();
                newConfig.other.navColor = [];
                newConfig.other.navColor.push(req.body.accent);
                if(req.body.accent == "light" || req.body.accent == "white"){
                    newConfig.other.navColor.push("light");
                }else{
                    newConfig.other.navColor.push("dark");
                }
                if(req.body.state && req.body.accent != "danger" && req.body.accent != "light"){
                    newConfig.other.navColor.push(req.body.accent);
                    newConfig.other.btnColor = true;
                }else{
                    newConfig.other.navColor.push("primary");
                    newConfig.other.btnColor = false;
                }
                
                fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
                res.redirect("/admin/settings")
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})

//PIREPS
app.post("/admin/pireps/apr", async function (req, res){
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const targetPIREP = await GetPirep(req.body.id)
                if(targetPIREP){
                    targetPIREP.status = "a";
                    updateStats();
                    if(config.other.pirepPic == true){
                        setTimeout(() => {
                            FileRemove(`${__dirname}/..${targetPIREP.pirepImg}.webp`)
                            UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.operator, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, targetPIREP.status, targetPIREP.fuel, targetPIREP.filed, null, "REMOVED");
                        }, config.other.pirepPicExpire);
                    }
                    await UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.operator, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "a", targetPIREP.fuel, targetPIREP.filed,null, targetPIREP.pirepImg);
                    const owner = await GetUser(targetPIREP.author);
                    if(owner){
                        owner.hours = owner.hours + (targetPIREP.flightTime / 60);
                        owner.rank = await testRank(owner)
                        await UpdateUser(owner.username, owner.rank, owner.admin, owner.password, owner.display, owner.profileURL, owner.hours, owner.created, owner.llogin, owner.cp, owner.revoked, owner.VANetID, user.manualRank)
                        res.redirect("/admin/pireps");
                        
                        webhook.send({title:"PIREP Approved", description: `${config.code}${owner.username}'s PIREP (${targetPIREP.depICAO}=>${targetPIREP.arrICAO}) has been approved!`})

                    }else{
                        res.sendStatus(500);
                    }
                    
                }else{
                    res.sendStatus(404);
                }
            }else{
                res.sendStatus(403);
            }
        }else{
            res.sendStatus(401);
        }
    }else{
        res.sendStatus(400);
    }
})
app.post("/admin/pireps/den", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id && req.body.rejectReason) {    
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                const targetPIREP = await GetPirep(req.body.id)
                if (targetPIREP) {
                    targetPIREP.status = "d";
                    targetPIREP.rejectReason = Buffer.from(req.body.rejectReason, 'base64').toString()
                    if (config.other.pirepPic == true) {
                        setTimeout(() => {
                            FileRemove(`${__dirname}/..${targetPIREP.pirepImg}.webp`)
                            UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.operator, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "d", targetPIREP.fuel, targetPIREP.filed, Buffer.from(req.body.rejectReason, 'base64').toString(), "REMOVED");
                        }, config.other.pirepPicExpire);
                    }
                    await UpdatePirep(targetPIREP.id, targetPIREP.vehicle, targetPIREP.vehiclePublic, targetPIREP.author, targetPIREP.operator, targetPIREP.depICAO, targetPIREP.arrICAO, targetPIREP.route, targetPIREP.flightTime, targetPIREP.comments, "d", targetPIREP.fuel, targetPIREP.filed, Buffer.from(req.body.rejectReason, 'base64').toString(), targetPIREP.pirepImg);
                    res.redirect("/admin/pireps")
                } else {
                    res.sendStatus(404);
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})

//Links
app.post("/admin/links/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.title && req.body.url) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                    await CreateLink(req.body.title, req.body.url);
                    res.redirect("/admin/links");
            }else{
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})
app.post("/admin/links/rem", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteLink(parseInt(req.body.id));
                res.redirect("/admin/links");
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})

//Multi
app.post("/admin/multi/new", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.label && req.body.amount) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                if(!(await GetMultiplierByLabel(req.body.label))){
                    await CreateMulti(req.body.label, req.body.amount);
                    res.redirect("/admin/multi");
                }else{
                    res.status(409);
                    res.send("This Already Exists.")
                }
                
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})
app.post("/admin/multi/rem", async function (req, res) {
    const cookies = getAppCookies(req)
    if (req.body.id) {
        let user = await checkForUser(cookies);
        if (user) {
            if (user.admin == true) {
                await DeleteMulti(parseInt(req.body.id));
                res.redirect("/admin/multi");
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
})

app.post("/admin/applications/config", async (req, res) =>{
    const cookies = getAppCookies(req);
    let user = await checkForUser(cookies);
    if (user) {
        if (user.admin == true) {
            const newConfig = getConfig();
            if(req.body.state){
                if(req.body.link){
                    newConfig.other.applications.state = true;
                    newConfig.other.applications.link = req.body.link;
                }else{
                    res.status(400);
                    res.send("Missing Link");
                }
            }else{
                newConfig.other.applications.state = false;
            }
            fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            res.redirect("/admin/settings#apps");
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(401);
    }
})

app.post('/updateSlot', async (req, res) => {
    const cookies = getAppCookies(req);
    //Check for setup
    if (((!config.code) && req.path != "/setup")) {
        if ((!config.code) && req.path != "/setup") {
            res.redirect('/setup')
        } else {
            res.redirect("/?r=ue")
        }
    } else {
        const changePWD = await checkForCPWD(cookies);
        let user = await checkForUser(cookies);
        if (user) {
            user = await getUserWithObjs(user, ["notifications", "pireps"]);
        }
        if (changePWD == true && req.path != "/changePWD") {
            res.redirect('/changePWD');
        } else {
            const sesID = parseInt(req.query.ses.toString());
            //Get Session Obj
            const session = await GetSession(sesID);
            if (session) {
                switch (req.query.state) {
                    case "NI":
                        if (req.body.aircraft) {
                            const aircraft = await GetAircraft(req.body.aircraft);
                            if (aircraft) {
                                await UpdateSession(session.id.toString(), session.pilot, session.route, aircraft.livID, session.depTime, session.arrTime, session.active == true ? 1 : 0, "AS");
                                res.redirect(`/slotUI?ses=${session.id}`)
                            } else {
                                res.status(404).send("Can't find aircraft with that ID");
                            }
                        } else {
                            res.status(400).send("No aircraft provided.")
                        }
                        break;
                    case "SF":
                        await UpdateSession(session.id.toString(), session.pilot, session.route, session.aircraft, (new Date()).toString(), session.arrTime, 1, "FS");
                        res.sendStatus(200);
                        break;
                    case "EF":
                        await UpdateSession(session.id.toString(), session.pilot, session.route, session.aircraft, session.depTime, (((new Date().getTime() - new Date(session.depTime).getTime()) / 1000) / 60).toString(), 1, "FF");
                        res.sendStatus(200);
                        break;
                    default:
                        res.status(400).send("No state provided");
                        break;
                }
            } else {
                res.status(404).send("Cant find session with ID: " + sesID);
            }
        }
    }
})

app.post('/finSlot', upload.single('pirepImg'), async (req, res) => {
    const cookies = getAppCookies(req);
    //Check for setup
    if (((!config.code) && req.path != "/setup")) {
        if ((!config.code) && req.path != "/setup") {
            res.redirect('/setup')
        } else {
            res.redirect("/?r=ue")
        }
    } else {
        const changePWD = await checkForCPWD(cookies);
        let user = await checkForUser(cookies);
        if (user) {
            user = await getUserWithObjs(user, ["notifications", "pireps"]);
        }
        if (changePWD == true && req.path != "/changePWD") {
            res.redirect('/changePWD');
        } else {
            const sesID = parseInt(req.query.ses.toString());
            //Get Session Obj
            const session = await GetSession(sesID);
            if (session) {
                const route = await GetRoute(session.route);
                if (req.body.fuel) {
                    if(req.file){
                        fs.readFile(req.file.path, function (err, sourceData) {
                            Sentry.captureException(err);
                            tinify.fromBuffer(sourceData).toBuffer(function (err, resultData) {
                                Sentry.captureException(err);
                                fs.unlinkSync(`${req.file.path}`);
                                req.file.path = req.file.path + ".webp";
                                fs.writeFileSync(`${req.file.path}`, resultData);
                            })
                        })
                    }
                    let ft = parseInt(session.arrTime);
                    let comment = req.body.comments;
                    if (req.body.multi) {
                        let multi = await GetMultiplierByLabel(req.body.multi);
                        if (multi) {
                            ft = ft * parseFloat((multi.amount).toString());
                            if (comment == "No Comment") {
                                comment = `Used Multiplier: ${multi.label} (${multi.amount}x)`;
                            } else {
                                comment += `\n \n Used Multiplier: ${multi.label} (${multi.amount}x)`;
                            }
                        }
                    }
                    //@ts-ignore
                    CreatePirep(session.aircraft, (await GetAircraft(session.aircraft)).publicName, session.pilot, route.operator, route.depICAO, route.arrICAO, operatorSearchable.get(parseInt(route.operator)).code + route.num.toString(), ft, comment, "n", req.body.fuel, new Date().toString(), (req.file ? `/data/images/${req.file.filename}` : null));
                    webhook.send({ title: "PIREP Submitted", "description": `${config.code}${user.username} has submitted a PIREP, and is awaiting action.` })
                    UpdateSession(session.id.toString(), session.pilot, session.route, session.aircraft, session.depTime, session.arrTime, 0, "PF");
                    res.redirect("/home");
                    
                }else{
                    res.sendStatus(400);
                }
                // @ts-ignore
                
            } else {
                res.status(404).send("Cant find session with ID: " + sesID);
            }
        }
    }
})


async function seenUser(userID){
    const user = await GetUser(userID);
    if (((new Date()).getTime() - new Date(user.llogin).getTime()) > (1000 * 60 * 10)){
        user.llogin = (new Date()).toString();
        UpdateUser(user.username, user.rank, user.admin, user.password, user.display, user.profileURL, user.hours, user.created, user.llogin, user.cp, user.revoked, user.VANetID, user.manualRank);
    }
    
}
