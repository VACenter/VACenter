var bar = new ProgressBar.Line(document.getElementById("progressBar"), {
    strokeWidth: 4,
    easing: 'easeInOut',
    duration: 1000,
    color: '#0d6efd',
    trailColor: '#eee',
    trailWidth: 1,
    svgStyle: { width: '100%', height: '100%' }
});
const percent = 1.0;
bar.animate(percent);  // Number from 0.0 to 1.0

const settingsConfig = {
    analytics: null,
    vaName: null,
    vaCode: null,
    user: {
        pilotid: null,
        password: null
    }
}

const stages = [
    {
        icon: 'pc-display',
        title: "VACenter",
        description: "",
        percent: 0.0,
        iconOveride: true,
        settingID: "stage_SET_intro"
    },
    {
        icon: 'bar-chart-fill',
        title: "Analytics",
        description: "",
        percent: 0.2,
        iconOveride: false,
        settingID: "stage_SET_analytics"
    },
    {
        icon: 'type',
        title: "VA Name",
        description: "<strong>Example:</strong> Qatar Airways Virtual",
        percent: 0.4,
        iconOveride: false,
        settingID: "stage_SET_name"
    },
    {
        icon: 'type-bold',
        title: "VA Code",
        description: "<strong>Example:</strong> QRVA",
        percent: 0.6,
        iconOveride: false,
        settingID: "stage_SET_code"
    },
    {
        icon: 'person-circle',
        title: "Default Account",
        description: `Set the password for the default account.`,
        percent: 0.8,
        iconOveride: false,
        settingID: "stage_SET_acc"
    },
    {
        icon: 'list-check',
        title: "Review",
        description: `Review settings for your crew center.`,
        percent: 1,
        iconOveride: false,
        settingID: "stage_SET_review",
        loadFunc: function (){
            //Show Analytics
            if(settingsConfig.analytics === true || settingsConfig.analytics === false){
                document.getElementById("staticReviewAnalytics").value = settingsConfig.analytics === true ? "Allow" : "Denied";
            }

            //Show Name
            if (typeof settingsConfig.vaName === "string") {
                document.getElementById("staticReviewName").value = settingsConfig.vaName;
            }

            //Show Code
            if (typeof settingsConfig.vaCode === "string") {
                document.getElementById("staticReviewCode").value = settingsConfig.vaCode;
            }
            
            //Show User
            if (typeof settingsConfig.user.pilotid === "string") {
                document.getElementById("staticReviewUser").value = `Pilot ID: ${settingsConfig.user.pilotid}`;
            }
        }
    }
]

let stageNumber = 0;
function goToStage(stageNum){
    const stage = stages[stageNum];

    if(stage.iconOveride){
        document.getElementById("stage_ICON").className = `d-none`;
        document.getElementById("stage_IMAGE").className = "";
    }else{
        document.getElementById("stage_ICON").className = `bi bi-${stage.icon}  text-primary display-1`;
        document.getElementById("stage_IMAGE").className = "d-none";
    }
    
    document.getElementById("stage_TITLE").innerHTML = stage.title;
    document.getElementById("stage_DESC").innerHTML = stage.description;
    bar.animate(stage.percent);

    stages.forEach(stageItem =>{
        document.getElementById(stageItem.settingID).classList.add("d-none");
    })
    document.getElementById(stage.settingID).classList.remove("d-none");

    if(stage.loadFunc){
        stage.loadFunc()
    }
}

function nextStage(){
    stageNumber++;
    goToStage(stageNumber);
}
function prevStage(){
    stageNumber--;
    goToStage(stageNumber);
}

setTimeout(goToStage, 1250, 0);

function processAnalytics(state){
    settingsConfig.analytics = state;
    nextStage();
}

function processName(){
    let name = document.getElementById("vaName").value;
    swal({
        title: "Are you sure?",
        text: `Your VA name will be set as "${name}", this can not be changed.`,
        icon: 'info',
        buttons: true
    }).then(result => {
        if (result) {
            settingsConfig.vaName = name;
            nextStage();
        }
    })
}

function processCode() {
    let code = document.getElementById("vaCode").value.toUpperCase();
    swal({
        title: "Are you sure?",
        text: `Your VA code will be set as "${code}", this can not be changed.`,
        icon: 'info',
        buttons: true
    }).then(result => {
        if (result) {
            settingsConfig.vaCode = code;
            nextStage();
        }
    })
}

function setPilotID() {
    const randomNumber = (Math.floor((Math.random() * 99999) + 1)).toString();
    console.log(randomNumber);
    document.getElementById("staticPilotID").value = randomNumber.padStart(5, '0');
    settingsConfig.user.pilotid = randomNumber.padStart(5, '0');
}

setPilotID();

function processDefault(){
    let pwd = document.getElementById("inputPassword").value;
    let pwdConfirm = document.getElementById("inputPasswordConfirm").value;
    if(pwd != ""){
        if (pwd == pwdConfirm) {
            settingsConfig.user.password = pwd;
            nextStage();
        } else {
            swal({
                title: "Password mismatch",
                text: "Those passwords do not match.",
                icon: "error"
            });
        }
    }else{
        swal({
            title: "Empty Password",
            text: "You can not have an empty password.",
            icon: "error"
        });
    }
}

function finish(){
    swal({
        title: "Are you sure?",
        text: "Are you sure you want to setup VACenter?",
        icon: "info",
        buttons: {
            cancel: true,
            yes: {
                text: "Setup",
                closeModal: false
            }
        }
    }).then(value =>{
        if(value){
            const data = `analytics=${settingsConfig.analytics}&vaname=${settingsConfig.vaName}&vacode=${settingsConfig.vaCode}&defaultUser=${settingsConfig.user.pilotid}&defaultPWD=${settingsConfig.user.pwd}`;

            const xhr = new XMLHttpRequest();
            xhr.withCredentials = true;

            xhr.addEventListener("readystatechange", function () {
                if (this.readyState === this.DONE) {
                    console.log(this)
                    if(this.status == 200){
                        setTimeout(() => {
                            window.location.href = "/";
                        }, 10000);
                        document.getElementById("finalSetupBTN").setAttribute("disabled", "disabled");
                        document.getElementById("finalRestartBTN").setAttribute("disabled", "disabled");
                        document.getElementById("finalDescriptionTEXT").innerHTML = "Please wait..."
                        swal({
                            title: "Hooray!",
                            text: "VACenter was successfully setup, this page will reload shortly.",
                            icon: "success"
                        });
                    }else{
                        swal({
                            title: "Oh no!",
                            text: "An error occured during setup! Check the console!",
                            icon: "error"
                        });
                        console.table(["Bad response from VACenter", this.statusText, this.responseText])
                    }
                }
            });

            xhr.open("POST", "/api/normalSetup");
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

            xhr.send(data);
        }
    });
}