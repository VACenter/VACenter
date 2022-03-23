let currentPage = 0;
const pageList = ["setupWelcome", "analyticsSetup", "nameSetup", "codeSetup", "defaultAccountSetup", "finalSetup"];

const setupConfig = {
    analytics: false,
    name: "",
    user: {
        pilotID: "",
        password: ""
    }
}

function setPilotID(){
    const randomNumber = (Math.floor((Math.random() * 99999) + 1)).toString();
    console.log(randomNumber);
    document.getElementById("setupInputUserID").value = randomNumber.padStart(5,'0');
    setupConfig.user.pilotID = randomNumber.padStart(5, '0');
}

setPilotID();

function analytics(state){
    setupConfig.analytics = state;
    nextPage();
}

function setName(){
    setupConfig.name = document.getElementById("setupInputName").value;
    nextPage();
}

function setCode(){
    setupConfig.code = document.getElementById("setupInputCode").value;
    nextPage();
}

function setUser(){
    setupConfig.user.password = document.getElementById("setupInputUserPassword").value;
    nextPage();
}

function nextPage(){
    pageList.forEach(page =>{
        document.getElementById(page).style.display = "none";
    });
    currentPage ++;
    document.getElementById(pageList[currentPage]).style.display = "inline-block";
}
function prevPage(){
    pageList.forEach(page => {
        document.getElementById(page).style.display = "none";
    });
    currentPage--;
    document.getElementById(pageList[currentPage]).style.display = "inline-block";
}

function setup(){
    
}