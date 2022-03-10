// Dependencies

const express = require('express');
const btoa = require('btoa');
const atob = require('atob');
require('dotenv').config();
const chalk = require('chalk');
const config = require('./config.js');
const fs = require('fs');
const path = require('path');

//Instance State
const readyForUse = config.get().instance.setup;

//App
const app = express();
app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, "../", 'output'))
app.engine('html', require('ejs').renderFile);
const serverPort = config.get().instance.port;
app.listen(serverPort, ()=>{
    console.log(chalk.blue(`Listening on ${serverPort}`))
});

app.get("*", (req,res, next)=>{
    let currentConfig = config.get();
    if(req.path.slice(0,8) == "/assets/"){
        console.log(path.join(__dirname, '../', 'output', req.path))
        if(fs.existsSync(path.join(__dirname, '../', 'output', req.path))){
            res.sendFile(path.join(__dirname, '../', 'output', req.path));
        }else{
            res.sendStatus(404);
        }
    }else{
        switch(req.path){
            case "/":
                res.render("login.html", {
                    va: currentConfig.vaInfo,
                    bg: currentConfig.customizations.bg
                });
                break;
            default:
                res.render("404.html", {
                    va: currentConfig.vaInfo,
                    bg: currentConfig.customizations.bg
                });
                break;
        }
    }
})
