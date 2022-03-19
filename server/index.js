//@ts-check

//Dependancies
const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const config = require('./config.js');

//Config
const launchConfig = config.get();

//Express
const app = express();
app.listen(launchConfig.instance.port, ()=>{
    console.log(`VACenter listening on port ${launchConfig.instance.port}`)
});