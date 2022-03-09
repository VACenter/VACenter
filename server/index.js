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
        try{
            if(req.path == "/"){
                let NFPage = require(path.join(__dirname, "routes", "index.js"));
                NFPage.handle(req, res, next, currentConfig);
            }else{
                let NFPage = require(path.join(__dirname, "routes", req.path.slice(1, req.path.length) + ".js"));
                NFPage.handle(req, res, next, currentConfig);
            }
            
        }catch(err){
            let NFPage = require(path.join(__dirname, 'routes', '404.js'));
            NFPage.handle(req,res,next, currentConfig);
        }
    }
})
