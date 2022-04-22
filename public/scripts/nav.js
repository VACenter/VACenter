function openPage(url){
    swal({
        title: "Are you sure?",
        icon: "warning",
        text: `You are about to leave VACenter to visit: ${url}`,
        buttons: true,
    }).then(val=>{
        if(val){
            window.location.href = url;
        }
    })
}