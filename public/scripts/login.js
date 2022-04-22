// Example starter JavaScript for disabling form submissions if there are invalid fields
(function () {
    'use strict'

    // Fetch all the forms we want to apply custom Bootstrap validation styles to
    var forms = document.querySelectorAll('.needs-validation')

    // Loop over them and prevent submission
    Array.prototype.slice.call(forms)
        .forEach(function (form) {
            form.addEventListener('submit', function (event) {
                if (!form.checkValidity()) {
                    event.preventDefault()
                    event.stopPropagation()
                }

                form.classList.add('was-validated')
            }, false)
        })
})()


const urlParams = new URLSearchParams(window.location.search);

if (urlParams.has('r')) {
    switch (urlParams.get('r')) {
        case "ni":
            swal("Oh no!", "You didn't enter a piece of information!", 'error').then(() => {
                window.location.href = "/"
            })
            break;
        case "ro":
            swal("Oh no!", "This account has been revoked by an administrator!", 'error').then(() => {
                window.location.href = "/"
            })
            break;
        case "ii":
            swal("Oh no!", "The information you entered was incorrect!", 'error').then(() => {
                window.location.href = "/"
            })
            break;
        case "ue":
            swal("Oh no!", "There was an unknown error!", 'error').then(() => {
                window.location.href = "/"
            })
            break;
        default:
            break;
    }
}