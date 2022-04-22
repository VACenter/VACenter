//Bootstrap Forms
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
})();

//Webhooks
const webhookGrid = new gridjs.Grid({
    autoWidth: false,
    columns: ['Label', 'Events', 'URL', {
        name: 'Actions',
        sort: { enabled: false },
        formatter: (cell, row) => {
            return gridjs.h('button', {
                className: 'btn btn-danger mx-2',
                onClick: () => deleteHook(row.cells[3].data)
            }, 'Delete');
        }
    }, {
            name: "id",
            hidden: true
        }],
    server: {
        url: '/api/webhooks/all',
        then: data => data.data.map(hook => {
            let events = JSON.parse(hook.events);
            let newEvents = [];
            events.forEach(event => {
                const result = event.replace(/([A-Z])/g, " $1");
                const finalResult = result.charAt(0).toUpperCase() + result.slice(1);
                newEvents.push(finalResult);
                console.log(finalResult);
            })
            return [hook.label + `${hook.discord == 1 ? " (Discord)" : ""}`, newEvents.join(", "), hook.url, hook.id]
        })
    },
    search: {
        enabled: true
    },
    language: {
        'search': {
            'placeholder': '🔍 Search...'
        }
    },
    className: {
        td: 'grid-td',
    },
    style: {
        table: {
            width: '100%'
        },
        td: {
            overflowX: "scroll"
        }
    },
    sort: true,
    pagination: {
        enabled: true,
        limit: 10,
        summary: true
    }
}).render(document.getElementById("webhookWrapper"));

//grid.on('rowClick', (...args) => console.log('row: ' + JSON.stringify(args), args));

function deleteHook(hookID) {
    const data = `hookID=${hookID}`;

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.addEventListener("readystatechange", function () {
        if (this.readyState === this.DONE) {
            if (this.status == 200) {
                webhookGrid.forceRender();
            } else {
                alert("An error occured, see console");
                console.error([this.status, this.statusText, this.responseText]);
            }
        }
    });

    xhr.open("DELETE", "/api/webhooks/delete");
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.send(data);
}

// Custom Links
const linksGrid = new gridjs.Grid({
    autoWidth: true,
    columns: ['Label', 'URL', {
        name: 'Actions',
        sort: { enabled: false },
        formatter: (cell, row) => {
            return gridjs.h('button', {
                className: 'btn btn-danger',
                onClick: () => deleteLink(row.cells[2].data)
            }, 'Delete');
        }
    }, {
            name: "id",
            hidden: true
        }],
    server: {
        url: '/api/links/all',
        then: data => data.data.map(link => [link.label, link.url, link.id])
    },
    search: {
        enabled: true
    },
    language: {
        'search': {
            'placeholder': '🔍 Search...'
        }
    },
    className: {
        td: 'grid-td',
    },
    style: {
        table: {
            width: '100%'
        },
        td: {
            overflowX: "scroll"
        }
    },
    sort: true,
    pagination: {
        enabled: true,
        limit: 10,
        summary: true
    }
}).render(document.getElementById("customLinkWrapper"));

//grid.on('rowClick', (...args) => console.log('row: ' + JSON.stringify(args), args));

function deleteLink(linkID) {
    const data = `linkID=${linkID
}`;

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.addEventListener("readystatechange", function () {
        if (this.readyState === this.DONE) {
            if (this.status == 200) {
                linksGrid.forceRender();
            } else {
                alert("An error occured, see console");
                console.error([this.status, this.statusText, this.responseText]);
            }
        }
    });

    xhr.open("DELETE", "/api/links/delete");
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.send(data);
}