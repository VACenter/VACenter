//@ts-check

//Dependancies
const path = require('path');
const fs = require('fs');
const config = require('./../server/config.js');
const request = require('request');
const semver = require('semver');
const localUpdates = require("./updates.json");
let localConfig = config.get();

config.eventListener.on('configChange', ()=>{
    localConfig = config.get();
})

//Check for new update
function checkForUpdate(overrideVersion = null, overrideEnrollment = null){
    return new Promise((resolve, reject) =>{
        const options = {
            method: 'GET',
            url: 'https://raw.githubusercontent.com/VACenter/VACenter/VACenter-4/updates/updates.json'
        };
        request(options, function (error, response, rawBody) {
            if (error || response.statusCode != 200) {
                reject("Failed to get information from Github.");
                console.error([response.statusCode, response.statusMessage]);
            } else {
                const body = JSON.parse(rawBody);
                let updateCandidates = [];
                //Beta Program
                if (overrideEnrollment != null ? overrideEnrollment : localConfig.instance.betaEnrolled == true){
                    body.beta.list.forEach(element=>{
                        //Check if already recieved updates

                        //Currently: Beta
                        console.log(semver.prerelease(overrideVersion != null ? overrideVersion : localConfig.instance.version.semver) != null && (semver.prerelease(overrideVersion != null ? overrideVersion : localConfig.instance.version.semver) || semver.prerelease(overrideVersion != null ? overrideVersion : localConfig.instance.version.semver)[0] == "rc"))
                        if (semver.prerelease(overrideVersion != null ? overrideVersion : localConfig.instance.version.semver) != null && (semver.prerelease(overrideVersion != null ? overrideVersion : localConfig.instance.version.semver) || semver.prerelease(overrideVersion != null ? overrideVersion : localConfig.instance.version.semver)[0] == "rc")) {
                            //Check element is ahead of current version
                            if(semver.gt(element.semver, overrideVersion != null ? overrideVersion : localConfig.instance.version.semver)){
                                updateCandidates.push(element);
                            }
                        //Currently: Prod
                        } else {
                            //Check allowed to move up
                            console.log([element.prodUpgrade, localConfig.instance.version.semver, element.prodUpgrade == (overrideVersion != null ? overrideVersion : localConfig.instance.version.semver)])
                            if (element.prodUpgrade == (overrideVersion != null ? overrideVersion : localConfig.instance.version.semver)) {
                                updateCandidates.push(element);
                            }
                        }
                    });

                //Production
                }else{
                    body.prod.list.forEach(element =>{
                        //Check if already recieved updates

                        //Currently: Prod
                        if(semver.prerelease(overrideVersion != null ? overrideVersion : localConfig.instance.version.semver) == null){
                            //Check element is ahead of current version
                            if(semver.gt(element.semver, overrideVersion != null ? overrideVersion : localConfig.instance.version.semver)){
                                updateCandidates.push(element);
                            }

                        //Currently: Beta
                        }else{
                            //Check allowed to move down

                            //Check is on valid downgrade version
                            if(element.betaDowngrade == (overrideVersion != null ? overrideVersion : localConfig.instance.version.semver)){
                                updateCandidates.push(element);
                            }
                        }
                    })
                }
                console.log(updateCandidates);
                resolve([updateCandidates.length > 0, updateCandidates]);
            }
        });
    })
}

//Check if possible to change beta status
function checkBetaChange(){
    return new Promise(async function(resolve, reject) {
        if (localConfig.instance.betaEnrolled) {
            const updateCandidates = await checkForUpdate(null, false);
            resolve([localConfig.instance.betaEnrolled, updateCandidates[0]]);
        } else {
            const updateCandidates = await checkForUpdate(null, true);
            resolve([localConfig.instance.betaEnrolled, updateCandidates[0]]);
        }
    })
    
}

//Sort updates
function updateSort(a, b){
    if(semver.gt(a.semver, b.semver)){
        return 1;
    }else if(semver.gt(b.semver, a.semver)){
        return -1;
    }else{
        return 0;
    }
}

//Get Update
function getUpdate(branch = "prod", version){
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            url: 'https://raw.githubusercontent.com/VACenter/VACenter/VACenter-4/updates/updates.json'
        };
        request(options, function (error, response, rawBody) {
            if (error || response.statusCode != 200) {
                reject("Failed to get information from Github.");
                console.error([response.statusCode, response.statusMessage]);
            } else {
                console.log("3");
                const body = JSON.parse(rawBody);
                console.log("4");
                if(branch == 'prod'){
                    console.log("5");
                    let resolved = false;
                    console.log(body);
                    body.prod.list.forEach(element =>{
                        console.log(element.semver);
                        if(element.semver == version){
                            resolved = true;
                            resolve(element);
                        }
                    });
                    if(resolved == false){
                        resolve(null);
                    }
                }else if(branch == 'beta'){
                    let resolved = false;
                    body.beta.list.forEach(element => {
                        if (element.semver == version) {
                            resolved = true;
                            resolve(element);
                        }
                    });
                    if (resolved == false) {
                        resolve(null);
                    }
                }else{
                    reject();
                }
                
            }
        });
    })
}

//Exports
module.exports = {
    checkNewVersion: checkForUpdate,
    checkBetaChange,
    updateSort,
    getUpdate
};