//@ts-check

// Console Module
require("./console.js");
//@ts-ignore
console.file("vacenter.log");
process.on('uncaughtException', (err) => {
    // Console Module
    require("./console.js");
    //@ts-ignore
    console.file("vacenter.log");
    console.error(err);

});

//Updates
let updateInProgress = false;

//Dependancies
const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const http = require('http');
const {Server} = require('socket.io');
const perms = require("./perms.js");
const config = require('./config.js');
const db = require('./db.js');
const update = require('./../updates/update.js');
const request = require('request');
const fetch = require('node-fetch');
const morgan = require("morgan");
const cors = require("cors");
const utils = require("./utils.js");

//Config
const launchConfig = config.get();

//Setup
let dirtySetupRequired = true;
let normalSetupRequired = true;

function checkDirtySetup(){
    let databaseConfig = launchConfig.database;
    if (databaseConfig.host && databaseConfig.port && databaseConfig.user && databaseConfig.password && databaseConfig.database){
        dirtySetupRequired = false;
    }else{
        console.warn("WARN: Dirty Setup Required");
    }
}

function checkNormalSetup(){
    let instanceConfig = launchConfig.instance;
    if(dirtySetupRequired == false){
        db.init();
    }
    if(instanceConfig.setup){
        normalSetupRequired = false;
    }else{
        console.warn("WARN: Normal Setup Required");
    }
    
}

checkDirtySetup();
checkNormalSetup();

// Token Store
const authenticationTokens = new Map();

//Express, HTTP, Socket.IO

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

io.use(async (socket, next) => {
    console.log(socket.handshake.auth)
    const cookie = socket.handshake.auth.token;
    if (cookie) {
        if (authenticationTokens.has(cookie)) {
            const sessionInfo = authenticationTokens.get(cookie);
            let error = false;
            let response;
            try {
                response = await db.users.get({pilotID: sessionInfo.pilotID});
            } catch (err) {
                error = true;
                next(new Error("Failed Authentication"));
            }
            if(error == false){
                socket.data.user = response.results[0];
                next();
            }
        } else {
            next(new Error("Failed Authentication"));
        }
    } else {
        next(new Error("Failed Authentication"));
    }
});
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(cors());
app.use("/public", express.static(path.join(__dirname, '../', "public")));
app.use(function (req, res, next) {
    const reqConfig = Object.create(config.get());
    delete reqConfig['database'];
    delete reqConfig['instance'];

    res.locals.config = reqConfig;
    res.locals.path = req.path.slice(1);
    res.locals.permsHandler = perms;
    next();
});

server.listen(launchConfig.instance.port, ()=>{
    console.log(`VACenter listening on port ${launchConfig.instance.port}`)
});

//API
app.get("*", async (req,res, next)=>{
    if(req.path.slice(0,5) == "/api/"){
        switch(req.path.slice(1)){
            case "api/ranks/all": {
                const pilot = await authenticate(req);
                if (pilot) {
                    db.ranks.get({}).then((result,err)=>{
                        if (err) {
                            console.error(err);
                            res.statusMessage = "Error from VACenter, check server console.";
                            res.sendStatus(500);
                            res.send("Error from VACenter, check server console.");
                        } else {
                            res.json({
                                data: result.results
                            })
                        }
                    });
                } else {
                    res.status(401);
                    res.send("Not signed in.")
                }
                }break;
            case "api/codeshare/all": {
                const pilot = await authenticate(req);
                if (pilot) {
                    db.operators.get({}).then((result, err) => {
                        if (err) {
                            console.error(err);
                            res.statusMessage = "Error from VACenter, check server console.";
                            res.sendStatus(500);
                            res.send("Error from VACenter, check server console.");
                        } else {
                            res.json({
                                data: result.results
                            })
                        }
                    });
                } else {
                    res.status(401);
                    res.send("Not signed in.")
                }
            } break;
            case "api/aircraft/all": {
                const pilot = await authenticate(req);
                if (pilot) {
                    db.aircraft.get({}).then((result, err) => {
                        if (err) {
                            console.error(err);
                            res.statusMessage = "Error from VACenter, check server console.";
                            res.sendStatus(500);
                            res.send("Error from VACenter, check server console.");
                        } else {
                            res.json({
                                data: result.results
                            })
                        }
                    });
                } else {
                    res.status(401);
                    res.send("Not signed in.")
                }
            } break;
            case "api/webhooks/all": {
                const pilot = await authenticate(req);
                if (pilot) {
                    const userPerms = new perms.Perm(pilot.permissions);
                    if (userPerms.has("MANAGE_SITE") || userPerms.has("SUPER_USER")) {
                        db.webhooks.get({}).then((result, err) => {
                            if (err) {
                                console.error(err);
                                res.statusMessage = "Error from VACenter, check server console.";
                                res.sendStatus(500);
                                res.send("Error from VACenter, check server console.");
                            } else {
                                res.json({
                                    data: result.results
                                })
                            }
                        });
                    }else{
                        res.status(403);
                        res.send("Not authorised to view this content.")
                    }
                } else {
                    res.status(401);
                    res.send("Not signed in.")
                }
            } break;
            case "api/links/all": {
                const pilot = await authenticate(req);
                if (pilot) {
                    const reqConfig = config.get();
                    res.json({
                        data: reqConfig.links
                    })
                } else {
                    res.status(401);
                    res.send("Not signed in.")
                }
            } break;
            case "api/pilots/all": {
                const pilot = await authenticate(req);
                if (pilot) {
                    db.users.get({}).then((result, err) => {
                        if (err) {
                            console.error(err);
                            res.statusMessage = "Error from VACenter, check server console.";
                            res.sendStatus(500);
                            res.send("Error from VACenter, check server console.");
                        } else {
                            res.json({
                                data: result.results
                            })
                        }
                    });
                } else {
                    res.status(401);
                    res.send("Not signed in.")
                }
            }
            break;
            default:
                res.status(404);
                res.send("API path not found.");
                break;
        }
    }else{
        next();
    }
});

app.post("*", async (req, res, next)=>{
    if(req.path.slice(0,5) == "/api/"){
        const cookies = getAppCookies(req);
        switch(req.path.slice(1)){
            case "api/dirtySetup": {
                if(req.body.username && req.body.host && req.body.password && req.body.port && req.body.database){
                    const currentConfig = config.get();
                    currentConfig.database.user = req.body.username;
                    currentConfig.database.host = req.body.host;
                    currentConfig.database.port = parseInt(req.body.port.toString());
                    currentConfig.database.password = req.body.password;
                    currentConfig.database.database = req.body.database;
                    config.update(currentConfig);
                    res.status(200);
                    res.render("setup/dirty/success.ejs");
                    await db.init();
                    process.send("restartReq");
                }else{
                    res.status(400);
                    res.send("Missing information from form. Please go back, check the settings, and resubmit.");
                }
                }break;
            case "api/normalSetup": {
                if (req.body.analytics && req.body.vaname && req.body.vacode && req.body.defaultUser && req.body.defaultPWD) {
                    const currentConfig = config.get();
                    currentConfig.instance.analytics = req.body.anlytics == "true" ? true : false;
                    currentConfig.instance.setup = true;
                    currentConfig.vaInfo.name = req.body.vaname;
                    currentConfig.vaInfo.code = req.body.vacode;
                    const perm = new perms.Perm();
                    perm.set('SUPER_USER');
                    perm.set("MANAGE_AIRCRAFT");
                    perm.set("MANAGE_ROUTE");
                    perm.set("MANAGE_PIREP");
                    perm.set("MANAGE_EVENT");
                    perm.set("MANAGE_SITE");
                    perm.set("MANAGE_PILOT");
                    perm.set("MANAGE_LOA");
                    perm.set("MANAGE_RANK");
                    perms.set("MANAGE_CODESHARE");
                    db.users.create({
                        pilotID: req.body.defaultUser,
                        name: "Default User",
                        password: bcrypt.hashSync(req.body.defaultPWD, 10),
                        rank: 0,
                        callsign: "0",
                        permissions: perm.value()
                    }).then((result, err) =>{
                        if(err){
                            console.error(err);
                            res.statusMessage = "Error from VACenter, check server console.";
                            res.sendStatus(500);
                            res.send("Error from VACenter, check server console.");
                        }else{
                            db.operators.create({
                                name: req.body.vaname,
                                code: req.body.vacode,
                                ownVA: 1
                            }).then((result, err) => {
                                if (err) {
                                    console.error(err);
                                    res.statusMessage = "Error from VACenter, check server console.";
                                    res.sendStatus(500);
                                    res.send("Error from VACenter, check server console.");
                                } else {
                                    //Report to VACenter API
                                    const options = {
                                        method: 'POST',
                                        url: `https://v4.api.va-center.com/v4/register`,
                                        headers: {'Content-Type': 'x-www-form-urlencoded'},
                                        form:{
                                            acceptAnalytics: currentConfig.instance.analytics,
                                            airlineName: currentConfig.vaInfo.name,
                                            airlineCode: currentConfig.vaInfo.code,
                                            version: '4.0.0'
                                        }
                                    };

                                    request(options, function (error, response, body) {
                                        if (error || response.statusCode != 200) {
                                            res.status(500);
                                            res.send("Was unable to register with VACenter API.");
                                            console.error(error);
                                            if(response){
                                                console.error([response.statusCode, response.statusMessage]);
                                            }
                                        } else {
                                            const data = JSON.parse(body);
                                            currentConfig.ident = data.data.CCIdent;
                                            config.update(currentConfig);
                                            res.sendStatus(200);
                                            process.send("restartReq")
                                        }
                                    });
                                }
                            });
                        }
                    });
                } else {
                    res.status(400);
                    res.send("Missing information from form. Please go back, check the settings, and resubmit.");
                }
                }break;
            case "api/resetForce": {
                if(req.body.pwd){
                    const pilot = await authenticate(req);
                    if(pilot){
                        if(pilot.changePWD == 1){
                            db.users.update({
                                fields: {
                                    password: bcrypt.hashSync(req.body.pwd, 10),
                                    changePWD: 0
                                },
                                where: {
                                    field: "pilotID",
                                    operator: "=",
                                    value: pilot.pilotID
                                }
                            });
                            res.status(200);
                            res.clearCookie('vacenterAUTHTOKEN');
                            res.redirect("/login");
                        }else{
                            res.status(403);
                            res.send("Not needed. Please use standard password reset.");
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                }else{
                    res.sendStatus(400);
                }
            }break;
            case "api/login": {
                if(req.body.pilotID && req.body.pwd){
                    const pilot = (await db.users.get({
                        pilotID: req.body.pilotID
                    })).results[0];
                    if(pilot){
                        if(pilot.revoked == 0){
                            if (bcrypt.compareSync(req.body.pwd, pilot.password) == true) {
                                const tokenID = makeid(100);
                                authenticationTokens.set(tokenID, {
                                    token: tokenID,
                                    pilotID: pilot.pilotID
                                });
                                res.cookie('vacenterAUTHTOKEN', tokenID, { maxAge: 1000 * 60 * 60 * 24 * 14 }).redirect("/dashboard");
                            } else {
                                res.status(401);
                                res.redirect("/login?r=ii");
                            }
                        }else{
                            res.status(403);
                            res.redirect("/login?r=ro");
                        }
                    }else{
                        res.status(401);
                        res.redirect("/login?r=ii");
                    }
                }else{
                    res.status(400);
                    res.redirect("/login?r=ni")
                }
                }break;
            case "api/profile/update/pictures": {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        if(req.body.profilePIC){
                            pilot.profilePicture = req.body.profilePIC;
                        }
                        if (req.body.profileBanner) {
                            pilot.banner = req.body.profileBanner;
                        }
                        db.users.update({
                            fields: {
                                banner: pilot.banner,
                                profilePicture: pilot.profilePicture
                            },
                            where: {
                                field: "pilotID",
                                operator: "=",
                                value: pilot.pilotID
                            }
                        });
                        res.status(200);
                        res.redirect("/me");
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                }break;
            case "api/profile/update/info": {
                if(req.body.name){
                    const pilot = await authenticate(req);
                    if (pilot) {
                        db.users.update({
                            fields: {
                                name: req.body.name,
                            },
                            where: {
                                field: "pilotID",
                                operator: "=",
                                value: pilot.pilotID
                            }
                        });
                        res.status(200);
                        res.redirect("/me");
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                }else{
                    res.status(400);
                    res.send("Need all fields.")
                }
                }break;
            case "api/security/signMeOut": {
                const pilot = await authenticate(req);
                if (pilot) {
                    authenticationTokens.forEach(token=>{
                        if(token.pilotID == pilot.pilotID){
                            authenticationTokens.delete(token.token);
                        }
                    });
                    res.status(200);
                    res.redirect("/me");
                } else {
                    res.status(401);
                    res.send("Not signed in.")
                }
            }break;
            case "api/security/resetPWD": {
                if (req.body.oldPWD && req.body.newPWD && req.body.newPWDC) {
                    if(req.body.newPWD == req.body.newPWDC){
                        const pilot = await authenticate(req);
                        if (pilot) {
                            if(bcrypt.compareSync(req.body.oldPWD, pilot.password)){
                                db.users.update({
                                    fields: {
                                        password: bcrypt.hashSync(req.body.newPWD, 10),
                                    },
                                    where: {
                                        field: "pilotID",
                                        operator: "=",
                                        value: pilot.pilotID
                                    }
                                });
                                const authCookie = cookies.vacenterAUTHTOKEN;
                                if (authCookie) {
                                    authenticationTokens.delete(authCookie)
                                }
                                res.clearCookie("vacenterAUTHTOKEN");
                                res.status(200);
                                res.redirect("/");
                            }else{
                                res.status(403);
                                res.send("Incorrect password.")
                            }
                            
                        } else {
                            res.status(401);
                            res.send("Not signed in.")
                        }
                    }else{
                        res.status(400);
                        res.send("Your new password doesn't match the confirm password.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            }break;
            case "api/pilots/resetPWD": {
                if (req.body.pilot) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_PILOT") || userPerms.has("SUPER_USER")) {
                            if((await db.users.get({pilotID: req.body.pilot})).results.length > 0){
                                const target = (await db.users.get({pilotID: req.body.pilot})).results[0];
                                let newPassword = utils.randomString(25);
                                target.password = bcrypt.hashSync(newPassword, 10);
                                target.changePWD = 1;
                                authenticationTokens.forEach(token =>{
                                    if(token.pilotID == target.pilotID){
                                        authenticationTokens.delete(token.token);
                                    }
                                })
                                db.users.update({
                                    fields: {
                                        password: target.password,
                                        changePWD: target.changePWD
                                    },
                                    where: {
                                        field: "pilotID",
                                        operator: "=",
                                        value: target.pilotID
                                    }
                                });
                                res.status(200);
                                res.send(`This user's password is now: ${newPassword}, they must change it on next login.`);
                            }else{
                                res.status(404);
                                res.send("Unknown target");
                            }
                        } else {
                            res.status(403);
                            res.send("Not authorised to edit users.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            }break;
            case "api/pilots/permissions": {
                if (req.body.pilot) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("SUPER_USER")) {
                            if ((await db.users.get({ pilotID: req.body.pilot })).results.length > 0) {
                                const target = (await db.users.get({ pilotID: req.body.pilot })).results[0];
                                const prevPerms = new perms.Perm(target.permissions);
                                const targetPermissions = new perms.Perm();
                                
                                if(req.body.manage_aircraft) targetPermissions.set('MANAGE_AIRCRAFT');
                                if (req.body.manage_route) targetPermissions.set('MANAGE_ROUTE');
                                if (req.body.manage_pirep) targetPermissions.set('MANAGE_PIREP');
                                if (req.body.manage_event) targetPermissions.set('MANAGE_EVENT');
                                if (req.body.manage_loa) targetPermissions.set('MANAGE_LOA');
                                if (req.body.manage_rank) targetPermissions.set('MANAGE_RANK');
                                if (req.body.manage_codeshare) targetPermissions.set('MANAGE_CODESHARE');
                                if (req.body.manage_pilot) targetPermissions.set('MANAGE_PILOT');
                                if (req.body.manage_site) targetPermissions.set('MANAGE_SITE');
                                if (prevPerms.has('SUPER_USER')) targetPermissions.set('SUPER_USER');

                                db.users.update({
                                    fields: {
                                        permissions: targetPermissions.value()
                                    },
                                    where: {
                                        field: "pilotID",
                                        operator: "=",
                                        value: target.pilotID
                                    }
                                });
                                res.status(200);
                                res.redirect(`/admin/pilot/view?id=${target.pilotID}`)
                            } else {
                                res.status(404);
                                res.send("Unknown target");
                            }
                        } else {
                            res.status(403);
                            res.send("Not authorised to edit users.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            } break;
            case "api/pilots/callsign": {
                if (req.body.pilot && req.body.callsign) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("SUPER_USER") || userPerms.has("MANAGE_PILOT")) {
                            if ((await db.users.get({ pilotID: req.body.pilot })).results.length > 0) {
                                const target = (await db.users.get({ pilotID: req.body.pilot })).results[0];
                                db.users.update({
                                    fields: {
                                        callsign: req.body.callsign.toString()
                                    },
                                    where: {
                                        field: "pilotID",
                                        operator: "=",
                                        value: target.pilotID
                                    }
                                });
                                res.status(200);
                                res.redirect(`/admin/pilot/view?id=${target.pilotID}`)
                            } else {
                                res.status(404);
                                res.send("Unknown target");
                            }
                        } else {
                            res.status(403);
                            res.send("Not authorised to edit users.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            } break;
            case "api/pilots/new": {
                if (req.body.pilotCallsign && req.body.pilotName && req.body.pilotHours) {
                    const user = await authenticate(req);
                    if (user) {
                        const userPerms = new perms.Perm(user.permissions);
                        if (userPerms.has("SUPER_USER") || userPerms.has("MANAGE_PILOT")) {
                            const loginInfo = {
                                pid: await generateValidPID(),
                                password: utils.randomString(50)
                            }
                            //Permissions
                            const targetPermissions = new perms.Perm(0);
                            if(userPerms.has("SUPER_USER")) {
                                if (req.body.manage_aircraft) targetPermissions.set('MANAGE_AIRCRAFT');
                                if (req.body.manage_route) targetPermissions.set('MANAGE_ROUTE');
                                if (req.body.manage_pirep) targetPermissions.set('MANAGE_PIREP');
                                if (req.body.manage_event) targetPermissions.set('MANAGE_EVENT');
                                if (req.body.manage_loa) targetPermissions.set('MANAGE_LOA');
                                if (req.body.manage_rank) targetPermissions.set('MANAGE_RANK');
                                if (req.body.manage_codeshare) targetPermissions.set('MANAGE_CODESHARE');
                                if (req.body.manage_pilot) targetPermissions.set('MANAGE_PILOT');
                                if (req.body.manage_site) targetPermissions.set('MANAGE_SITE');
                            }
                            //Rank
                            let rankID = 0;
                            let manualRank = false;
                            if(req.body.manualRank){
                                manualRank = true;
                                rankID = req.body.rank ? parseInt(req.body.rank) : 0;
                            }else{
                                rankID = await determineRank(parseFloat(req.body.pilotHours));
                            }
                            
                            db.users.create({
                                pilotID: loginInfo.pid,
                                name: req.body.pilotName,
                                password: bcrypt.hashSync(loginInfo.password, 10),
                                rank: rankID,
                                manualRank: manualRank ? 1 : 0,
                                callsign: req.body.pilotCallsign,
                                permissions: targetPermissions.value()
                            }).then((result, err) => {
                                if(err){
                                    console.error(err);
                                    res.status(500);
                                    res.send("Internal Error");
                                }else{
                                    res.status(200);
                                    res.send(`Success! The user was created! Here are their credentials (Password must be changed on login): PilotID: ${loginInfo.pid}, PWD: ${loginInfo.password}`)
                                }
                            });
                        } else {
                            res.status(403);
                            res.send("Not authorised to edit users.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            }break;
            case "api/ranks/new": {
                if (req.body.rankName && (req.body.manualRank || req.body.rankHours)) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if(userPerms.has("MANAGE_RANK") || userPerms.has("SUPER_USER")){
                            db.ranks.create({
                                label: req.body.rankName,
                                manual: req.body.manualRank ? 1 : 0,
                                minHours: req.body.manualRank ? -1 : parseFloat(req.body.rankHours)
                            }).then((result, err) => {
                                if (err) {
                                    console.error(err);
                                    res.statusMessage = "Error from VACenter, check server console.";
                                    res.sendStatus(500);
                                    res.send("Error from VACenter, check server console.");
                                } else {
                                    res.redirect("/admin/ranks");
                                }
                            });
                        }else{
                            res.status(403);
                            res.send("Not authorised to edit ranks.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            }break;
            case "api/codeshare/new": {
                if (req.body.operatorName && req.body.operatorCode) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_CODESHARE") || userPerms.has("SUPER_USER")) {
                            db.operators.create({
                                name: req.body.operatorName,
                                code: req.body.operatorCode
                            }).then((result, err) => {
                                if (err) {
                                    console.error(err);
                                    res.statusMessage = "Error from VACenter, check server console.";
                                    res.sendStatus(500);
                                    res.send("Error from VACenter, check server console.");
                                } else {
                                    res.redirect("/admin/codeshare");
                                }
                            });
                        } else {
                            res.status(403);
                            res.send("Not authorised to edit codeshare.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            } break;
            case "api/aircraft/new": {
                if (req.body.aircraftID && req.body.liveryID && req.body.minRank) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_AIRCRAFT") || userPerms.has("SUPER_USER")) {
                            const options = {
                                method: 'GET',
                                url: `https://v4.api.va-center.com/v4/aircraft/${req.body.aircraftID}/livery/${req.body.liveryID}`
                            };

                            request(options, function (error, response, body) {
                                if(error || response.statusCode != 200){
                                    res.status(500);
                                    res.send("Was unable to retrieve information on that aircraft.");
                                    console.error(error);
                                    console.error([response.statusCode, response.statusMessage]);
                                }else{
                                    const liveryObject = JSON.parse(body);
                                    db.aircraft.create({
                                        liveryID: req.body.liveryID,
                                        aircraftID: req.body.aircraftID,
                                        minHours: parseFloat(req.body.minRank),
                                        aircraftName: liveryObject.aircraftName,
                                        liveryName: liveryObject.liveryName
                                    }).then((result, err) => {
                                        if (err) {
                                            console.error(err);
                                            res.statusMessage = "Error from VACenter, check server console.";
                                            res.sendStatus(500);
                                            res.send("Error from VACenter, check server console.");
                                        } else {
                                            res.redirect("/admin/aircraft");
                                        }
                                    });
                                }

                            });
                        } else {
                            res.status(403);
                            res.send("Not authorised to edit codeshare.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            } break;
            case "api/webhooks/new": {
                if (req.body.webhookName && req.body.hookURL && req.body.hookEvents) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_SITE") || userPerms.has("SUPER_USER")) {
                            const hookEvents = [];
                            if(Array.isArray(req.body.hookEvents)) {
                                req.body.hookEvents.forEach(event => {
                                    hookEvents.push(event);
                                });
                            }else{
                                hookEvents.push(req.body.hookEvents);
                            }
                            db.webhooks.create({
                                label: req.body.webhookName,
                                url: req.body.hookURL,
                                discord: req.body.discordHook ? 1 : 0,
                                events: JSON.stringify(hookEvents)
                            }).then((result, err) => {
                                if (err) {
                                    console.error(err);
                                    res.statusMessage = "Error from VACenter, check server console.";
                                    res.sendStatus(500);
                                    res.send("Error from VACenter, check server console.");
                                } else {
                                    res.redirect("/admin/settings");
                                }
                            });
                        } else {
                            res.status(403);
                            res.send("Not authorised to edit webhooks.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            } break;
            case "api/links/new": {
                if (req.body.linkLabel && req.body.linkURL) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_SITE") || userPerms.has("SUPER_USER")) {
                            const reqConfig = config.get();
                            reqConfig.links.push({
                                id: reqConfig.links.length,
                                label: req.body.linkLabel,
                                url: req.body.linkURL
                            });
                            config.update(reqConfig);
                            res.redirect("/admin/settings");
                        } else {
                            res.status(403);
                            res.send("Not authorised to edit webhooks.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            } break;
            case "api/updates/beta": {
                const pilot = await authenticate(req);
                if (pilot) {
                    const userPerms = new perms.Perm(pilot.permissions);
                    if (userPerms.has("MANAGE_SITE") || userPerms.has("SUPER_USER")) {
                        const canChange = await update.checkBetaChange();
                        if (canChange[1] === true){
                            if(req.body.updateBetaSwitch){
                                let tempConfig = config.get();
                                tempConfig.instance.betaEnrolled = true;
                                config.update(tempConfig);
                                res.status(200);
                                res.redirect("/admin/settings");
                            }else{
                                let tempConfig = config.get();
                                tempConfig.instance.betaEnrolled = false;
                                config.update(tempConfig);
                                res.status(200);
                                res.redirect("/admin/settings");
                            }
                        }else{
                            res.status(403);
                            res.send("Unable to change beta due to versioning restrictions.");
                        }
                    }else{
                        res.redirect("/admin");
                    }
                }else{
                    res.clearCookie("vacenterAUTHTOKEN");
                    res.redirect("/");
                }
            }
            break;
            default:
                res.status(404);
                res.send("API path not found.")
        }
    }else{
        next();
    }
})

app.delete("*", async (req, res, next) => {
    if (req.path.slice(0, 5) == "/api/") {
        switch (req.path.slice(1)) {
            case "api/ranks/delete": {
                if(req.body.rankID){
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_RANK") || userPerms.has("SUPER_USER")) {
                            db.ranks.delete({
                                id: parseInt(req.body.rankID)
                            }).then((result, err) => {
                                if (err) {
                                    console.error(err);
                                    res.statusMessage = "Error from VACenter, check server console.";
                                    res.sendStatus(500);
                                    res.send("Error from VACenter, check server console.");
                                } else {
                                    res.sendStatus(200);
                                }
                            });
                        }else{
                            res.status(403);
                            res.send("Not allowed to modify ranks.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                }else{
                    res.status(400);
                    res.send("Missing Rank ID");
                }
            } break;
            case "api/codeshare/delete": {
                if (req.body.opID) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_CODESHARE") || userPerms.has("SUPER_USER")) {
                            db.operators.delete({
                                id: parseInt(req.body.opID)
                            }).then((result, err) => {
                                if (err) {
                                    console.error(err);
                                    res.statusMessage = "Error from VACenter, check server console.";
                                    res.sendStatus(500);
                                    res.send("Error from VACenter, check server console.");
                                } else {
                                    res.sendStatus(200);
                                }
                            });
                        } else {
                            res.status(403);
                            res.send("Not allowed to modify codeshare.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Missing Codeshare ID");
                }
            } break;
            case "api/aircraft/delete": {
                if (req.body.liveryID) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_AIRCRAFT") || userPerms.has("SUPER_USER")) {
                            db.aircraft.delete({
                                liveryID: req.body.liveryID
                            }).then((result, err) => {
                                if (err) {
                                    console.error(err);
                                    res.statusMessage = "Error from VACenter, check server console.";
                                    res.sendStatus(500);
                                    res.send("Error from VACenter, check server console.");
                                } else {
                                    res.sendStatus(200);
                                }
                            });
                        } else {
                            res.status(403);
                            res.send("Not allowed to modify aircraft.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Missing Livery ID");
                }
            } break;
            case "api/webhooks/delete": {
                if (req.body.hookID) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_SITE") || userPerms.has("SUPER_USER")) {
                            db.webhooks.delete({
                                id: parseInt(req.body.hookID)
                            }).then((result, err) => {
                                if (err) {
                                    console.error(err);
                                    res.statusMessage = "Error from VACenter, check server console.";
                                    res.sendStatus(500);
                                    res.send("Error from VACenter, check server console.");
                                } else {
                                    res.sendStatus(200);
                                }
                            });
                        }else{
                            res.status(403);
                            res.send("Not allowed to modify webhooks.")
                        }                        
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Missing Rank ID");
                }
            } break;
            case "api/links/delete": {
                if (req.body.linkID) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("MANAGE_SITE") || userPerms.has("SUPER_USER")) {
                            const reqConfig = config.get();
                            
                            reqConfig.links.splice(reqConfig.links.findIndex(v => v.id === parseInt(req.body.linkID)), 1)
                            res.sendStatus(200);
                        } else {
                            res.status(403);
                            res.send("Not allowed to modify links.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Missing Rank ID");
                }
            } break;
            case "api/pilots/revoke": {
                if (req.body.userID) {
                    const pilot = await authenticate(req);
                    if (pilot) {
                        const userPerms = new perms.Perm(pilot.permissions);
                        if (userPerms.has("SUPER_USER") || userPerms.has("MANAGE_PILOT")) {
                            if ((await db.users.get({ pilotID: req.body.userID })).results.length > 0) {
                                const target = (await db.users.get({ pilotID: req.body.userID })).results[0];
                                //const targetPerms = new perms.Perm(target.permissions);
                                if(target.permissions == 0 || (target.permissions > 0 && userPerms.has("SUPER_USER"))){
                                    db.users.update({
                                        fields: {
                                            revoked: target.revoked == 1 ? 0 : 1
                                        },
                                        where: {
                                            field: "pilotID",
                                            operator: "=",
                                            value: target.pilotID
                                        }
                                    });
                                    res.sendStatus(200);
                                }else{
                                    res.status(403);
                                    res.send("Not authorised to edit users.")
                                }
                                
                            } else {
                                res.status(404);
                                res.send("Unknown target");
                            }
                        } else {
                            res.status(403);
                            res.send("Not authorised to edit users.")
                        }
                    } else {
                        res.status(401);
                        res.send("Not signed in.")
                    }
                } else {
                    res.status(400);
                    res.send("Need all fields.")
                }
            } break;
            default:
                res.status(404);
                res.send("API path not found.");
                break;
        }
    } else {
        next();
    }
});

//SETUP
app.get("*", (req,res, next)=>{
    if(dirtySetupRequired){
        res.render("setup/dirty/main");
    }else if(normalSetupRequired){
        res.render("setup/normal/main");
    }else{
        next();
    }
})

//MAIN
app.get("*", async (req,res)=>{
    const currentConfig = config.get();
    const cookies = getAppCookies(req);
    if(req.path != "/resetPWD"){
        const user = await authenticate(req);
        const parsedUser = user ? Object.create(user) : null;
        if(parsedUser){
            delete parsedUser['password'];
        }
        if(!user && cookies.vacenterAUTHTOKEN){
            res.clearCookie("vacenterAUTHTOKEN").redirect(req.path);
        }else if (user && parsedUser.changePWD == 1){
            res.redirect("/resetPWD");
        }else{
            switch (req.path) {
                case "/":
                case "/login":
                    if (user == null) {
                        res.render("login");
                    } else {
                        res.redirect("/dashboard");
                    }
                    break;
                case "/report":
                    res.redirect("https://github.com/VACenter/VACenter/issues/new?assignees=&labels=bug&template=bug_report.md&title=Bug+Report%3A")
                    break;
                case "/signout":
                    const authCookie = cookies.vacenterAUTHTOKEN;
                    if(authCookie){
                        authenticationTokens.delete(authCookie)
                    }
                    res.clearCookie("vacenterAUTHTOKEN").redirect("/");
                    break;
                case "/dashboard":
                    if(user == null){
                        res.redirect("/login");
                    }else{
                        res.render("dashboard", {
                            user: parsedUser,
                            contentInteger: random(1, 3)
                        })
                    }
                    break;
                case "/me":
                    if(user == null){
                        res.redirect("/login");
                    }else{
                        res.render("profile", {
                            user: parsedUser
                        })

                    }
                    break;
                case "/admin":
                    if(user == null){
                        res.redirect("/login");
                    }else{
                        if(user.permissions != 0){
                            res.render("admin/dashboard", {
                                user: parsedUser,
                                userPerms: new perms.Perm(user.permissions)
                            })
                        }else{
                            res.redirect("/");
                        }                   
                    }
                    break;
                case "/admin/ranks":
                    if (user == null) {
                        res.redirect("/login");
                    } else {
                        const userPerms = new perms.Perm(user.permissions);
                        if(userPerms.has("MANAGE_RANK") || userPerms.has("SUPER_USER")){
                            res.render("admin/ranks", {
                                user: parsedUser,
                                userPerms: userPerms
                            })
                        }else{
                            if(user.permissions != 0){
                                res.redirect("/admin")
                            }else{
                                res.redirect("/");
                            }
                        }
                    }
                    break;
                case "/admin/aircraft":
                    if (user == null) {
                        res.redirect("/login");
                    } else {
                        const userPerms = new perms.Perm(user.permissions);
                        if (userPerms.has("MANAGE_AIRCRAFT") || userPerms.has("SUPER_USER")) {
                            
                            res.render("admin/aircraft", {
                                user: parsedUser,
                                userPerms: userPerms,
                                ranks: (await db.ranks.get({})).results
                            })
                        } else {
                            if (user.permissions != 0) {
                                res.redirect("/admin")
                            } else {
                                res.redirect("/");
                            }
                        }
                    }
                    break;
                case "/admin/codeshare":
                    if (user == null) {
                        res.redirect("/login");
                    } else {
                        const userPerms = new perms.Perm(user.permissions);
                        if (userPerms.has("MANAGE_CODESHARE") || userPerms.has("SUPER_USER")) {
                            res.render("admin/codeshare", {
                                user: parsedUser,
                                userPerms: userPerms
                            })
                        } else {
                            if (user.permissions != 0) {
                                res.redirect("/admin")
                            } else {
                                res.redirect("/");
                            }
                        }
                    }
                    break;
                case "/admin/pilot":
                    if (user == null) {
                        res.redirect("/login");
                    } else {
                        const userPerms = new perms.Perm(user.permissions);
                        if (userPerms.has("MANAGE_PILOT") || userPerms.has("SUPER_USER")) {
                            res.render("admin/pilots", {
                                user: parsedUser,
                                userPerms: userPerms,
                                ranks: (await db.ranks.get({})).results
                            })
                        } else {
                            if (user.permissions != 0) {
                                res.redirect("/admin")
                            } else {
                                res.redirect("/");
                            }
                        }
                    }
                    break;
                case "/admin/pilot/view":
                    if (user == null) {
                        res.redirect("/login");
                    } else {
                        const userPerms = new perms.Perm(user.permissions);
                        if (userPerms.has("MANAGE_PILOT") || userPerms.has("SUPER_USER")) {
                            if(req.query.id){
                                if((await db.users.get({pilotID: req.query.id})).results.length > 0){
                                    const targetUser = await db.users.get({pilotID: req.query.id});
                                    res.render("admin/pilot", {
                                        user: parsedUser,
                                        userPerms: userPerms,
                                        target: targetUser.results[0],
                                        targetPerms: new perms.Perm(targetUser.results[0].permissions),
                                        ranks: (await db.ranks.get({})).results
                                    })
                                }else{
                                    res.sendStatus(404);
                                }
                            }else{
                                res.sendStatus(400);
                            }
                        } else {
                            if (user.permissions != 0) {
                                res.redirect("/admin")
                            } else {
                                res.redirect("/");
                            }
                        }
                    }
                    break;
                case "/admin/settings":
                    if (user == null) {
                        res.redirect("/login");
                    } else {
                        const userPerms = new perms.Perm(user.permissions);
                        if (userPerms.has("MANAGE_SITE") || userPerms.has("SUPER_USER")) {
                            res.render("admin/settings", {
                                user: parsedUser,
                                userPerms: userPerms,
                                betaChange: await update.checkBetaChange()
                            })
                        } else {
                            if (user.permissions != 0) {
                                res.redirect("/admin")
                            } else {
                                res.redirect("/");
                            }
                        }
                    }
                    break;
                case "/logFile":
                    if (user == null) {
                        res.redirect("/login");
                    } else {
                        const userPerms = new perms.Perm(user.permissions);
                        if (userPerms.has("SUPER_USER")) {
                            res.sendFile(path.join(__dirname, "vacenter.log"));
                        } else {
                            if (user.permissions != 0) {
                                res.redirect("/admin")
                            } else {
                                res.redirect("/");
                            }
                        }
                    }
                    break;
                default:
                    res.render('404');
                    break;
            }
        }
    }else{
        //Reset PWD Page
        const user = await authenticate(req);
        const parsedUser = user ? Object.create(user) : null;
        if (parsedUser) {
            delete parsedUser['password'];
        }
        if (!user) {
            res.clearCookie("vacenterAUTHTOKEN").redirect("/login");
        }else{
            res.render("resetPWD", {
                user: parsedUser
            })
        }
    }
})

//SOCKET.IO
io.on('connection', (socket) => {
    console.log("NEW CONN");
    socket.on('checkUpdate', async ()=>{
        console.log("Check update req")
        if(socket.data.user){
            if (socket.data.user.permissions){
                const userPerms = new perms.Perm(socket.data.user.permissions);
                if(userPerms.has('MANAGE_SITE') || userPerms.has("SUPER_USER")){
                    const candidates = await update.checkNewVersion();
                    if(candidates[0] == true){
                        let candidate = (candidates[1].sort(update.updateSort))[0];
                        socket.emit('checkUpdateRes', [true, candidate.semver]);
                    }else{
                        socket.emit('checkUpdateRes', [false, 'noUpdate']);
                    }
                }else{
                    socket.emit('checkUpdateRes', [false, 'noPerms']);
                }
            }else{
                socket.emit('checkUpdateRes', [false, 'noUser']);
            }
        }else{
            socket.emit("checkUpdateRes", [false, 'idk'])
        }
    })
    socket.on('update', async (vnum) => {
        console.log("Update req")
        if (socket.data.user) {
            if (socket.data.user.permissions) {
                const userPerms = new perms.Perm(socket.data.user.permissions);
                if (userPerms.has('MANAGE_SITE') || userPerms.has("SUPER_USER")) {
                    const candidates = await update.checkNewVersion();
                    if (candidates[0] == true) {
                        let candidate = (candidates[1].sort(update.updateSort))[0];
                        if(candidate.semver == vnum){
                            const configFile = config.get();
                            //The real business
                            updateInProgress = true;

                            //Download Update File
                            socket.emit('updateRes', [true, 'downloadingUpdateFile']);
                            const updateFile = await update.getUpdate(configFile.instance.betaEnrolled ? "beta":"prod", candidate.semver);
                            if(updateFile){
                                //Download SQL
                                socket.emit('updateRes', [true, 'downloadSQL']);
                                let url = updateFile.sqlFile;

                                let options = {
                                    method: 'GET'
                                };
                                let sqlDownloadError = false;
                                try{
                                    //@ts-ignore
                                    var sqlFile = await fetch(url, options);
                                }catch(err){
                                    sqlDownloadError = true;
                                    console.error(err);
                                }
                                if(sqlDownloadError == false){
                                    const SQL = await sqlFile.text();
                                    const Queries = SQL.split('\n');
                                    //Execute SQL
                                    socket.emit('updateRes', [true, 'executeSQL']);
                                    let SQLExecutionFailure = false;
                                    Queries.forEach(query =>{
                                        try{
                                            db.sql(query);
                                        }catch(err){
                                            SQLExecutionFailure = true;
                                            console.error(err);        
                                        }
                                    });
                                    if(SQLExecutionFailure === false){
                                        //Delete Files
                                        socket.emit('updateRes', [true, 'deleteFiles']);
                                        
                                    }
                                }
                            }else{

                            }


                        }else{
                            socket.emit("updateRes", [false, 'badAlign']);
                        }
                    } else {
                        socket.emit('updateRes', [false, 'noUpdate']);
                    }
                } else {
                    socket.emit('updateRes', [false, 'noPerms']);
                }
            } else {
                socket.emit('updateRes', [false, 'noUser']);
            }
        } else {
            socket.emit("updateRes", [false, 'idk'])
        }
    })
});

//Authentication

async function authenticate(req){
    const cookies = getAppCookies(req);

    if(cookies['vacenterAUTHTOKEN']){
        const token = cookies['vacenterAUTHTOKEN'];

        if(authenticationTokens.has(token)){
            const pilotID = (authenticationTokens.get(token)).pilotID;
            const pilot = (await db.users.get({
                pilotID: pilotID
            })).results[0];
            if(pilot.revoked == 1){
                return false;   
            }else{
                return pilot;
            }

        }else{
            return false;    
        }
    }else{
        return null;
    }
}

//Utils

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

function random(min, max){
    return Math.floor(Math.random() * max) + min;
}

function generateValidPID(){
    return new Promise(async (resolve, reject) => {
        let id = utils.genPilotID();
        if((await db.users.get({pilotID: id})).results.length > 0){
            resolve(await generateValidPID());
        }else{
            resolve(id);
        }
    })
}

function determineRank(hours){
    return new Promise(async (resolve, reject) => {
        const rankList = (await db.ranks.get({})).results;
        
        rankList.sort((a,b)=>{
            if(a.minHours > b.minHours){
                return 1;
            }else if(a.minHours < b.minHours){
                return -1;
            }else{
                return 0;
            }
        });

        let rankID = 0;
        rankList.forEach(rank =>{
            if(hours >= rank.minHours && rank.manual == 0){
                rankID = rank.id;
            }
        })
        resolve(rankID);
    })    
}

setTimeout(determineRank, 2500, 12)