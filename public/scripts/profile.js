document.getElementById("profilePIC").oninput = (ev) =>{
    const newURL = document.getElementById("profilePIC").value;
    document.getElementById("profilePICPreview").setAttribute("src",newURL);
    document.getElementById("profilePICPreview").style.height = `${document.getElementById("profilePICPreview").offsetWidth}px`;
} 

document.getElementById("profileBanner").oninput = (ev) => {
    const newURL = document.getElementById("profileBanner").value;
    document.getElementById("profileBannerPreview").setAttribute("src", newURL);
} 