//@ts-check

//Dependancies
const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const config = require('./config.js');
const db = require('./db.js');

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

//Express
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, '../', "public")));
app.use(function (req, res, next) {
    const reqConfig = Object.create(config.get());
    delete reqConfig['database'];
    delete reqConfig['instance'];

    res.locals.config = reqConfig;
    res.locals.path = req.path.slice(1);
    next();
});

app.listen(launchConfig.instance.port, ()=>{
    console.log(`VACenter listening on port ${launchConfig.instance.port}`)
});

//API
app.get("*", (req,res, next)=>{
    if(req.path.slice(0,5) == "/api/"){
        switch(req.path.slice(1)){
            default:
                res.status(404);
                res.send("API path not found.")
        }
    }else{
        next();
    }
});

app.post("*", async (req, res, next)=>{
    if(req.path.slice(0,5) == "/api/"){
        switch(req.path.slice(1)){
            case "api/dirtySetup":
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
                    process.exit();
                }else{
                    res.status(400);
                    res.send("Missing information from form. Please go back, check the settings, and resubmit.");
                }
                break;
            case "api/normalSetup":
                if (req.body.analytics && req.body.vaname && req.body.vacode && req.body.defaultUser && req.body.defaultPWD) {
                    const currentConfig = config.get();
                    console.log(currentConfig);
                    currentConfig.instance.analytics = req.body.anlytics == "true" ? true : false;
                    currentConfig.instance.setup = true;
                    currentConfig.vaInfo.name = req.body.vaname;
                    currentConfig.vaInfo.code = req.body.vacode;
                    db.users.create({
                        pilotID: req.body.defaultUser,
                        name: "Default User",
                        password: bcrypt.hashSync(req.body.defaultPWD, 10),
                        rank: 0
                    }).then((result, err) =>{
                        console.log(result);
                        console.log(err);
                        if(err){
                            console.error(err);
                            res.statusMessage = "Error from VACenter, check server console.";
                            res.sendStatus(500);
                            res.send("Error from VACenter, check server console.");
                        }else{
                            config.update(currentConfig);
                            res.sendStatus(200);
                            process.exit();
                        }
                    });
                } else {
                    res.status(400);
                    res.send("Missing information from form. Please go back, check the settings, and resubmit.");
                }
                break;
            case "api/login":
                if(req.body.pilotID && req.body.pwd){
                    const pilot = (await db.users.get({
                        pilotID: req.body.pilotID
                    })).results[0];
                    console.log(req.body);
                    console.log(pilot);
                    if(pilot){
                        if(bcrypt.compareSync(req.body.pwd, pilot.password) == true){
                            console.log("VALID")
                            const tokenID = makeid(100);
                            authenticationTokens.set(tokenID,{
                                token: tokenID,
                                pilotID: pilot.pilotID
                            });
                            res.cookie('vacenterAUTHTOKEN', tokenID, { maxAge: 1000 * 60 * 60 * 24 * 14}).redirect("/dashboard");
                        }else{
                            console.log("INVALID")
                            res.status(401);
                            res.redirect("/login?invalid=1");    
                        }
                    }else{
                        res.status(401);
                        res.redirect("/login?invalid=1");
                    }
                }else{
                    res.status(400);
                    res.send("The PilotID and Password are required fields. Please do not remove them from the form.");
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
        console.log(req.path)
        const user = await authenticate(req);
        const parsedUser = user ? Object.create(user) : null;
        if(parsedUser){
            delete parsedUser['password'];
            delete parsedUser['changePWD'];
            delete parsedUser['revoked'];
        }
        if(user == false){
            res.clearCookie("vacenterAUTHTOKEN").redirect(req.path);
        }else{
            switch (req.path) {
                case "/":
                case "/login":
                    if (user == null) {
                        res.render("login");
                    } else {
                        res.redirect("/dashboard");
                    }
                    console.log(user);
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
                default:
                    res.render('404');
                    break;
            }
        }
    }else{
        //Reset PWD Page
    }
})

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

            return pilot;

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