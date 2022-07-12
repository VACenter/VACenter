//@ts-check
//Dependancies
const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');

//Vars
let state = false;
const command = "node";
const params = [path.resolve('server/index.js')];
let child = null;

//Functions
function startVACenter(){
    console.log("starting VACenter")
    child = spawn(command, params, {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });
    state = true;
}

function restartVACenter(){
    console.log("Restarting VACenter")
    state = false;
    child.kill();
    setTimeout(startVACenter, 1500);
}

//Init
startVACenter();

//IPC
if(child){
    //@ts-ignore
    child.on('message', message => {
        if(state){
            switch(message){
                case "restartReq":
                    restartVACenter();
                    break;
                default:
                    console.log(message);
            }
            console.log(message);
        }
    });
}