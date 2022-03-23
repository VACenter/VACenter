//@ts-check

//Dependancies
const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const config = require('./config.js');

//Config
const launchConfig = config.get();

//Setup
let dirtySetupRequired = true;
let normalSetupRequired = true;

function checkDirtySetup(){
    let databaseConfig = launchConfig.database;
    if (databaseConfig.host && databaseConfig.port && databaseConfig.username && databaseConfig.password && databaseConfig.database){
        dirtySetupRequired = false;
    }else{
        console.warn("WARN: Dirty Setup Required");
    }
}
checkDirtySetup();

//Express
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, '../', "public")))

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

app.post("*", (req, res, next)=>{
    if(req.path.slice(0,5) == "/api/"){
        switch(req.path.slice(1)){
            case "api/dirtySetup":
                if(req.body.username && req.body.host && req.body.password && req.body.port && req.body.database){
                    const currentConfig = config.get();
                    currentConfig.database.username = req.body.username;
                    currentConfig.database.host = req.body.host;
                    currentConfig.database.port = parseInt(req.body.port.toString());
                    currentConfig.database.password = req.body.password;
                    currentConfig.database.database = req.body.database;
                    config.update(currentConfig);
                    res.status(200);
                    res.render("setup/dirty/success.ejs");
                    process.exit(11);
                }else{
                    res.status(400);
                    res.send("Missing information from form. Please go back, check the settings, and resubmit.");
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
        res.render("setup/normal/main")
    }else{
        next();
    }
})

//MAIN
app.get("*", (req,res)=>{
    const currentConfig = config.get();
    if(req.path.slice(0,5) == "/api/"){

    }else{
        if(currentConfig){

        }
    }
})