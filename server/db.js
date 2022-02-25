//@ts-check
// Error Reporting

const fs = require('fs');
const path = require('path');
const request = require('request');
const bcrypt = require('bcrypt');
const chalk = require('chalk');
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");
require('dotenv').config()

//Sentry
/* Sentry.init({
    dsn: "https://473725d276b441ea867cdde3d17b868b@o996992.ingest.sentry.io/5955471",
    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 0.5,
}); */

/**
 * @typedef {import('./types.js').user} user
 * @typedef {import('./types.js').aircraft} aircraft
 * @typedef {import('./types.js').event} event
 * @typedef {import('./types.js').gate} gate
 * @typedef {import('./types.js').notification} notification
 * @typedef {import('./types.js').operator} operator
 * @typedef {import('./types.js').PIREP} PIREP
 * @typedef {import('./types.js').rank} rank
 * @typedef {import('./types.js').route} route
 * @typedef {import('./types.js').slot} slot
 * @typedef {import('./types.js').statistic} statistic
 * @typedef {import('./types.js').link} link
 * @typedef {import('./types.js').fsession} fsession
 * @typedef {import('./types.js').Multiplier} Multiplier
 */

const sqlite3 = require('sqlite3').verbose();

/**@module Database */

//Database
let db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        Sentry.captureException(err);
    }
    console.log(chalk.blue('Connected to the database.'));
});

// Aircrafts
/**
 * Returns record of specific aircraft id
 * @param {string} id - Unique id of aircraft 
 * @returns {Promise<aircraft>} Record for that aircraft in an array
 */
 function GetAircraft(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM aircrafts WHERE livID = ?`, [id], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    });
}
/**
 * Returns all aircrafts
 * @returns {Promise<Array.<aircraft>>} All aircraft objects in an array
 */
function GetAircrafts() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM aircrafts`, (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}
/**
 * Creates new Aircraft
 * @param {String} livID - Livery ID
 * @param {String} airID - Aircraft ID
 * @param {String} livName - Livery Name
 * @param {String} airName - Aircraft Name
 * @param {String} publicName - Public Name (Livery Name and Aircraft Name)
 * @returns {Promise<Boolean>} Returns success in boolean of query
 */
function CreateAircraft(livID, airID, livName, airName, publicName) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO aircrafts(livID, airID, livName, airName, publicName) 
                VALUES(?, ?, ?, ?, ?)`, [livID, airID, livName, airName, publicName], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    })
}

/**
 * Delete aircraft
 * @param {String} id - LivID of aircraft
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteAircraft(id){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM aircrafts WHERE livID = ?`, [id], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}


// Events
/**
 * Returns record of specific event id
 * @param {string} id - Unique id of event 
 * @returns {Promise<Array.<event>|Boolean>} Record for that aircraft in an array
 */
 function GetEvent(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM events WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    var eventsRow = row;
                    eventsRow.gates = [];
                    db.each(`SELECT gate, taken FROM gates WHERE eventID = ?`, [id], (err, row) => {
                        Sentry.captureException(err);
                        eventsRow.gates.push(row);
                    }, function() {
                        resolve(eventsRow);
                    })
                    
                }
            });
        });
    });
}
/**
 * Returns all events
 * @returns {Promise<Array.<event>>} All events objects in an array
 */
function GetEvents() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM events`, (err, events) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    if (events.length == 0) {
                        resolve([])
                    } else {
                    let eventsProcessed = 0;
                        events.forEach(event => {
                            event.gates = [];
                            let gatesProcessed = 0;
                            db.each(`SELECT gate, taken FROM gates WHERE eventID = ?`, [event.id], (err, gate) => {
                                Sentry.captureException(err);
                                event.gates.push(gate)
                            }, function() {
                                eventsProcessed ++;
                                if(eventsProcessed == events.length){
                                    resolve(events);
                                }
                            })
                        })
                    }
                }
            });
        });
    });
}
/**
 * Creates new Event
 * @param {String} title
 * @param {String} body 
 * @param {String} arrAir 
 * @param {String} depAir 
 * @param {String} depTime 
 * @param {String} air 
 * @param {String} airName 
 * @param {String} server 
 * @param {Array} gates 
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateEvent(title, body, arrAir, depAir, depTime, air, airName, server, gates) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO events(title, body, arrAir, depAir, depTime, air, airName, server) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, [title, body, arrAir, depAir, depTime, air, airName, server], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                var createdEvent = this.lastID;
                gates.forEach(gate => {
                    db.run(`INSERT INTO gates(eventID, gate, taken) 
                            VALUES(?, ?, 0)`, [createdEvent, gate], function (err) {
                        Sentry.captureException(err);
                    });
                })
                resolve(true);
            }
        });
    })
}

/**
 * Delete event
 * @param {String} id - id of event
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteEvent(id){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM events WHERE id = ?`, [id], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}


// PIREPS
/**
 * Returns record of specific PIREP id
 * @param {string} id - Unique id of prirep 
 * @returns {Promise<PIREP>} Record for that prirep in an array
 */
 function GetPirep(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM pireps WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns all pireps
 * @returns {Promise<Array.<PIREP>>} All PIREP Objects in an array
 */
function GetPireps() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM pireps`, (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Returns all pireps for a user
 * @returns {Promise<Array.<PIREP>>} All PIREP Objects in an array
 */
 function GetUsersPireps(user) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM pireps WHERE author = ?`, [user], (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates new PIREP
 * @param {string} vehicle - Livery ID
 * @param {string} vehiclePublic - Name of Vehicle
 * @param {string} author - Pirep Creator
 * @param {number} operator - Operator
 * @param {string} depICAO - Departing ICAO code
 * @param {string} arrICAO - Arriving ICAO code
 * @param {string} route - Route
 * @param {number} flightTime - Flight time
 * @param {string} comments - Comments for flight
 * @param {string} status - "N": Pending, "A": Approved, "D": Denided
 * @param {number} fuel - Fuel used
 * @param {string} filed - Time of creation
 * @param {string|Boolean} [img] - ID of IMG
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreatePirep(vehicle, vehiclePublic, author, operator, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed, img) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO pireps(vehicle, vehiclePublic, author, operator, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed, rejectReason, pirepImg)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [vehicle, vehiclePublic, author, operator, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed, null, (img ? img : null)], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    })
}

/**
 * Update PIREP
 * @param {string} id - Unique ID of pirep
 * @param {string} vehicle - Livery ID
 * @param {string} vehiclePublic - Name of Vehicle
 * @param {string} author - Pirep Creator
 * @param {number} operator - Operator
 * @param {string} depICAO - Departing ICAO code
 * @param {string} arrICAO - Arriving ICAO code
 * @param {string} route - Route
 * @param {number} flightTime - Flight time
 * @param {string} comments - Comments for flight
 * @param {string} status - "N": Pending, "A": Approved, "D": Denided
 * @param {number} fuel - Fuel used
 * @param {string} filed - Time of creation
 * @param {string} [img] - PIREP Image
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function UpdatePirep(id, vehicle, vehiclePublic, author, operator, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed, rejectReason, img) {
    return new Promise((resolve, error) => {
        db.run(`UPDATE pireps SET 
                vehicle = ?,
                vehiclePublic = ?,
                author = ?,
                operator = ?,
                depICAO = ?,
                arrICAO = ?,
                route = ?,
                flightTime = ?,
                comments = ?,
                status = ?,
                fuel = ?,
                filed = ?,
                rejectReason = ?,
                pirepImg = ?
                WHERE id = ?`, [vehicle, vehiclePublic, author, operator, depICAO, arrICAO, route, flightTime, comments, status, fuel, filed, rejectReason, (img?img:null), id], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    })
}


// Tokens
/**
 * Returns valid token information if provided token is valid
 * @param {string} token - User token
 * @returns {Promise<Object>} Array with the token and user associated with the token
 */
function GetToken(token) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM tokens WHERE token = ?`, [token], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            })
        })
    })
}
/**
 * Creates new token
 * @param {String} token 
 * @param {String} user
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateToken(token, user) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO tokens (token, user) 
                VALUES(?, ?)`, [token, user], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Delete all User's Tokens
 * @param {String} username - Username of user
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteTokens(username){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM tokens WHERE user = ?`, [username], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}


// Users
/**
 * Returns record of specific User ID (UID)
 * @param {string} username - Unique username of user 
 * @returns {Promise<user>} Record for that username
 */
function GetUser(username) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns all users
 * @returns {Promise<Array.<{user}>>} User objects in an array
 */
function GetUsers() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM users`, (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates a new user
 * @param {string} username - Digit Username
 * @param {string} rank - Rank of user
 * @param {0|1} manualRank - Manual rank of user
 * @param {boolean} admin - Admin status
 * @param {string} password - Hashed password of user
 * @param {string} display - Display Name
 * @param {string} profileURL - URL to profile picture
 * @param {number} hours - Flight Hours
 * @param {string} created - Date and time created
 * @param {string} llogin - Last logged in
 * @param {boolean} cp - Force change password on next login
 * @param {number} revoked - User access revoked
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateUser(username, rank, manualRank, admin, password, display, profileURL, hours, created, llogin, cp, revoked, VANetID) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO users(username, rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked, VANetID, manualRank) 
                VALUES(?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [username, rank, admin, password, display, "https://icons.getbootstrap.com/assets/icons/person-circle.svg", hours, created, llogin, cp, revoked, VANetID, manualRank], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Update a user
 * @param {string} username - Digit Username
 * @param {string} rank - Rank of user
 * @param {boolean} admin - Admin status
 * @param {string} password - Hashed password of user
 * @param {string} display - Display Name
 * @param {string} profileURL - URL to profile picture
 * @param {number} hours - Flight Hours
 * @param {string} created - Date and time created
 * @param {string} llogin - Last logged in
 * @param {boolean} cp - Force change password on next login
 * @param {number} revoked - User access revoked
 * @param {0|1} manualRank - Manual Ranked user
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function UpdateUser(username, rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked, VANetID, manualRank = 0) {
    return new Promise((resolve, error) => {
        db.run(`UPDATE users SET
                rank = ?,
                admin = ?,
                password = ?,
                display = ?,
                profileURL = ?,
                hours = ?,
                created = ?,
                llogin = ?,
                cp = ?,
                revoked = ?,
                VANetID = ?,
                manualRank = ? 
                WHERE username = ?`, [rank, admin, password, display, profileURL, hours, created, llogin, cp, revoked, VANetID, manualRank, username], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Delete a users
 * @parm {String}
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteUser(username) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`DELETE FROM users WHERE username = ?`, [username], (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    });
}

// Operators

/**
 * Returns record of Operator Name
 * @param {string} name - Name of operator 
 * @returns {Promise<operator>} Record for that operator
 */
function GetOperatorByName(name) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM operators WHERE name = ?`, [name], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns record of specific Operator ID
 * @param {number} id - Unique id of operator 
 * @returns {Promise<operator>} Record for that operator
 */
 function GetOperator(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM operators WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
            
        });
    });
}

/**
 * Returns all operators
 * @returns {Promise<Array<operator>>} Operator objects in an array
 */
function GetOperators() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM operators`, (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates a new operator
 * @param {string} operator - Name of operator
 * @param {0|1} self - Is self?
 * @param {string} code - Code of operator
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateOperator(operator, self, code) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO operators(name,self,code) 
                VALUES(?, ?, ?)`, [operator, self ? self : 0, code], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Delete Operator
 * @param {String} id - Unique ID
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteOperator(id){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM operators WHERE id = ?`, [id], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

// Routes
/**
 * Returns record of specific Route ID
 * @param {string} id - Unique id of route 
 * @returns {Promise<route>} Record for that route
 */
 function GetRoute(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM routes WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns record of specific Route Name
 * @param {string} num - Number of route 
 * @returns {Promise<route>} Record for that route
 */
function GetRouteByNum(num) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM routes WHERE num = ?`, [num], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Returns all routes
 * @returns {Promise<Array<route>>} Route objects in an array
 */
function GetRoutes() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM routes`, (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates a new route
 * @param {string} id - Unique identifier
 * @param {string} num - Flight Number
 * @param {number} ft - Flight Time 
 * @param {number} operator - Operator ID
 * @param {string} aircraft - Livery ID
 * @param {string} depICAO - Departing ICAO
 * @param {string} arrICAO - Arriving ICAO
 * @param {string} aircraftPublic - Common aircraft name
 * @param {string} minRank - Minimum rank to fly route
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateRoute(id, num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, minRank) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO routes(id, num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, minRank) 
                VALUES(?,?,?,?,?,?,?,?,?)`, [id, num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, minRank], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Update a route
 * @param {string} id - Unique identifier
 * @param {string} num - Flight Number
 * @param {number} ft - Flight Time 
 * @param {string} operator - Operator
 * @param {string} aircraft - Livery ID
 * @param {string} depICAO - Departing ICAO
 * @param {string} arrICAO - Arriving ICAO
 * @param {string} aircraftPublic - Common aircraft name
 * @param {string} minRank - Minimum rank to fly route
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function UpdateRoute(id, num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, minRank) {
    return new Promise((resolve, error) => {
        db.run(`UPDATE routes SET 
                num = ?,
                ft = ?,
                operator = ?,
                aircraft = ?,
                depICAO = ?,
                arrICAO = ?,
                aircraftPublic = ?,
                minRank = ?
                WHERE id = ?`, [num, ft, operator, aircraft, depICAO, arrICAO, aircraftPublic, minRank, id], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

/**
 * Delete route
 * @param {String} id - ID of route
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteRoute(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`DELETE FROM routes WHERE id = ?`, [id], (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true);
                }
            });
        });
    });
}

// Notifications
/**
 * Get all notifications for a user
 * @param {string} user User 
 * @returns {Promise<Array.<notification>>} Array of notifications for user
 */
function GetNotifications(user){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM notifications WHERE user = ?`, [user], (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Creates a new notification
 * @param {String} user - Username to assign the notification to
 * @param {String} title - Title of notification
 * @param {String} desc - Description of notification
 * @param {String} icon - Icon for notification
 * @param {String} timeStamp - Creation time stamp of notification
 * @param {String} link - Link for notification
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateNotification(user, title, desc, icon, timeStamp, link){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`INSERT INTO notifications(user, title, desc, icon, timeStamp, link)
                    VALUES(?,?,?,?,?,?)`, [user, title, desc, icon, timeStamp, link], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
            db.run(`DELETE FROM notifications WHERE id IN (SELECT id FROM notifications ORDER BY id DESC LIMIT -1 OFFSET 5) AND user = ?`, [user], (err) => {
                if (err) {
                    Sentry.captureException(err);
                }
            })
        });
    });
}

/**
 * Delete notification
 * @param {String} id - Unique ID
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteNotification(id){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM notifications WHERE id = ?`, [id], (err) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(true)
                }
            });
        });
    });
}

/**
 * Delete all User's Notifications
 * @param {String} username - Username of user
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteUsersNotifications(username){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM notifications WHERE user = ?`, [username], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

// Stats
/**
 * Get all stats
 * @returns {Promise<Array.<statistic>>} Array of stats for VA
 */
 function GetStats(){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM stats`, (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Delete stat
 * @param {String} name - Name of stat
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteStat(name){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM stats WHERE name = ?`, [name], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}
/**
 * Updates Stat
 * @param {String} name - Name of stat
 * @param {String} newName - New name for stat
 * @param {String} newValue - New value for stat
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function UpdateStat(name, newName, newValue){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            if (newName == null){
                db.run(`UPDATE stats SET
                        value = ?
                        WHERE name = ?`, [newValue, name], (err) => {
                    if (err) {
                        Sentry.captureException(err);
                        resolve(false)
                    } else {
                        resolve(true)
                    }
                })
            } else {
                db.run(`UPDATE stats SET
                        name = ?,
                        value = ?
                        WHERE name = ?`, [newName, newValue, name], (err) => {
                    if (err) {
                        Sentry.captureException(err);
                        resolve(false)
                    } else {
                        resolve(true)
                    }
                })
            }
        })
    })
}

// Ranks

/**
 * Get rank by name
 * @param {string} id 
 * @returns {Promise<rank>} Ranks
 */
function GetRank(id){
    return new Promise((resolve, error) =>{
        db.serialize(() => {
            db.get(`SELECT * FROM ranks WHERE label = ?`, [id], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    })
}


/**
 * Get all ranks
 * @returns {Promise<Array<rank>>} Array of ranks
 */
 function GetRanks(){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM ranks`, (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Delete rank
 * @param {String} id - ID of rank
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function DeleteRank(id){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM ranks WHERE id = ?`, [id], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

/**
 * Update rank
 * @param {String} name - Name of rank
 * @param {String} newName - New name for rank
 * @param {Number} newMinH - New minimun hours for rank
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function UpdateRank(name, newName, newMinH){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`UPDATE ranks SET
                    rank = ?,
                    minH = ?
                    WHERE name = ?`, [newName, newMinH, name], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            })
        })
    })
}

/**
 * Creates a new rank
 * @param {String} label - Name of Rank
 * @param {0|1} manual - Type of Rank
 * @param {Number} minH - Minimum hours
 * @returns {Promise<Number>} Returns ID of new Rank
 */
 function CreateRank(label, manual, minH) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO ranks(label, manual, minH) VALUES(?, ?,?)`, [label, manual, minH], function (err) {
            if (err) {
                Sentry.captureException(err);
                error(err)
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Slots
/**
 * Get all slots
 * @returns {Promise<Array.<slot>>} Array of ranks
 */
function GetSlots() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM slots`, (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}
/**
 * Gets slot from ID 
 * @param {string} ID 
 * @returns {Promise<slot>} Slot object
 */
function GetSlot(ID) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM slots WHERE id = ?`, [ID], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/* function GetSlotsWithRoutes(){
    return new Promise((resolve, error) => {
        GetSlots().then((slots) => {
            slots.forEach(async slot => {
                slot.routeObj = await GetRoute(slot.route);
            })
            setTimeout(() => {
                resolve(slots);
            }, 500)
        });
    })
} */

function GetSlotsWithRoutes(){
    return new Promise((resolve, reject) => {
        try {
                GetSlots().then((slots) => {
                    if(slots.length != 0){
                        slots.forEach(async slot => {
                            slot.routeObj = await GetRoute(slot.route);
                        }, function () {
                            resolve(slots);
                        })
                    }else{
                        resolve(slots);
                    }
                });
        } catch (err) {
            Sentry.captureException(err);
            reject(err);
        }
    })
}

/**
 * Delete slot
 * @param {String} slot - id of slot
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function DeleteSlot(slot) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM slots WHERE id = ?`, [slot], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

/**
 * Update Slot
 * @param {String} id - id of slot
 * @param {String} route - route of slot
 * @param {String} newDepTime - New Departure time for slot
 * @param {String} newArrTime - New arrival time for slot
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function UpdateSlot(id, route, newDepTime, newArrTime) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`UPDATE slots SET
                    route = ?,
                    depTime = ?,
                    arrTime = ?
                    WHERE id = ?`, [route, newDepTime, newArrTime, id], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            })
        })
    })
}

/**
 * Creates a new slot
 * @param {String} id - ID
 * @param {String} route - Route Name
 * @param {String} depTime - Departure Time
 * @param {String} arrTime - Arrival Time
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateSlot(id, route, depTime, arrTime) {
    if(id && route && depTime && arrTime){
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO slots(route, depTime, arrTime) VALUES(?, ?, ?)`, [route, depTime, arrTime], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
    }
}

// Miscellaneous
/**
 * Returns the Profile Picture URL of a user
 * @param {string} username 
 * @returns {Promise<String>} Profile Picture URL
 */
function GetPPURL(username){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT profileURL FROM users WHERE username = ?`, [username], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    });
}

/**
 * Run Query
 * @param {String} query - query
 * @returns {Promise<Boolean>} Returns boolean of query
 */
 function run(query) {
    if(query){
        return new Promise((resolve, error) => {
            db.exec(query, function (err) {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    }
}

// Links
/**
 * Get all links
 * @returns {Promise<Array.<link>>} Array of Links
 */
function GetLinks() {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM links`, (err, rows) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

/**
 * Delete link
 * @param {number} id - ID of link
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function DeleteLink(id) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM links WHERE id = ?`, [id], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            });
        });
    });
}

/**
 * Creates a new link
 * @param {String} title - Title of link
 * @param {String} url - URL of link
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function CreateLink(title, url) {
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO links(title, url) VALUES(?, ?)`, [title, url], function (err) {
            if (err) {
                Sentry.captureException(err);
                resolve(false)
            } else {
                resolve(true)
            }
        });
    });
}

// Flight Sessions
/**
 * Creates a session
 * @param {string} pilot - Username of pilot
 * @param {string} route - Num of route
 * @returns {Promise<number>} Returns ID of session or -1 if error
 */
function CreateSession(pilot, route){
    return new Promise((resolve, error) => {
        db.run(`INSERT INTO flightSessions(pilot, route, aircraft, depTime, arrTime, active, state) VALUES(?, ?, ?, ?, ?, ?, ?)`, [pilot, route, null, null, 0, 1, "NI"], function (err,row) {
            if (err) {
                Sentry.captureException(err);
                resolve(-1)
            } else {
                resolve(this.lastID)
            }
        });
    });
}
/**
 * Returns record of specific Session ID
 * @param {number} ID 
 * @returns {Promise<fsession>} Flight Session Object
 */
function GetSession(ID){
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.get(`SELECT * FROM flightSessions WHERE id = ?`, [ID], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    });
}
/**
 * Get a pilots sessions
 * @param {string} pilot 
 * @returns {Promise<Array<fsession>>} Object of the current pilots flights
 */
function GetSessionByPilot(pilot) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.all(`SELECT * FROM flightSessions WHERE pilot = ?`, [pilot], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    if(Array.isArray(row)){
                        resolve(row);
                    } else {
                        resolve([row]);
                    }
                    
                }
            });
        });
    });
}

/**
 * Updates a session
 * @param {string} id 
 * @param {string} pilot
 * @param {string} route
 * @param {string} aircraft
 * @param {string} depTime
 * @param {string} arrTime
 * @param {number} active 
 * @param {string} state
 * @returns {Promise<Boolean>} Boolean of success or failure
 */
function UpdateSession(id, pilot, route, aircraft, depTime, arrTime, active, state) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`UPDATE flightSessions SET
                    pilot = ?,
                    route = ?,
                    aircraft = ?,
                    depTime = ?,
                    arrTime = ?,
                    active = ?,
                    state = ?
                    WHERE id = ?`, [pilot, route, aircraft, depTime, arrTime, active, state, id], (err) => {
                if (err) {
                    Sentry.captureException(err);
                    resolve(false)
                } else {
                    resolve(true)
                }
            })
        })
    })
}

/**
 * Deletes a Session
 * @param {string} ID 
 * @returns {Promise<Boolean>} Returns boolean of query
 */
function DeleteSession(ID) {
    return new Promise((resolve, error) => {
        db.serialize(() => {
            db.run(`DELETE FROM flightSessions WHERE id = ?`, [ID], (err) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(true);
                }
            });
        });
    });
}

//Multiplier

/**
 * Gives all Multipliers
 * @returns {Promise<Array<Multiplier>>}
 */
async function GetMultipliers(){
    return new Promise((resolve, error) => {
        db.serialize(()=>{
            db.all(`SELECT * FROM multi`, [], (err, row) =>{
                if(err){
                    Sentry.captureException(err);
                }else{
                    resolve(row);
                }
            })
        })
    })
}

/**
 * Retrieves a Multiplier by ID
 * @param {number} id 
 * @returns {Promise<Multiplier>} Boolean Success
 */
async function GetMultiplier(id){
    return new Promise((resolve, reject) =>{
        db.serialize(() => {
            db.get(`SELECT * FROM multi WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    })
}

/**
 * Retrieves a Multiplier by label
 * @param {string} label 
 * @returns {Promise<Multiplier>} Boolean Success
 */
async function GetMultiplierByLabel(label) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.get(`SELECT * FROM multi WHERE label = ?`, [label], (err, row) => {
                if (err) {
                    Sentry.captureException(err);
                } else {
                    resolve(row);
                }
            });
        });
    })
}

/**
 * Create a Multiplier
 * @param {string} label 
 * @param {number} amount 
 * @returns {Promise<String|Number>} ID of new Multiplier
 */
async function CreateMulti(label, amount){
    return new Promise((resolve, reject) => {
        db.serialize(() =>{
            db.run(`INSERT INTO multi (label, amount) VALUES(?, ?)`, [label, amount.toString()], (err) =>{
                if(err){
                    Sentry.captureException(err);
                }else{
                    resolve(this.lastID)
                }
            })
        })
    })
}

/**
 * Deletes a Multiplier
 * @param {number} id 
 * @returns {Promise<Boolean>}
 */
async function DeleteMulti(id){
    return new Promise((resolve, error) => {
        db.serialize(() =>{
            db.get(`DELETE FROM multi WHERE id = ?`, [id], (err) =>{
                if(err){
                    Sentry.captureException(err);
                }else{
                    resolve(true);
                }
            })
        })
    })
}

module.exports = { 
    db, GetPPURL, run,
    GetAircraft, GetAircrafts, CreateAircraft, DeleteAircraft,
    GetEvent, GetEvents, CreateEvent, DeleteEvent,
    GetNotifications, CreateNotification, DeleteNotification, DeleteUsersNotifications,
    GetOperatorByName, GetOperator, GetOperators, CreateOperator, DeleteOperator,
    GetPirep, GetUsersPireps, GetPireps, CreatePirep, UpdatePirep,
    GetRank, GetRanks, UpdateRank, CreateRank, DeleteRank,
    GetRoute, GetRoutes, GetRouteByNum, CreateRoute, UpdateRoute, DeleteRoute,
    GetStats, UpdateStat, DeleteStat,
    GetToken, CreateToken, DeleteTokens,
    GetUser, GetUsers, CreateUser, UpdateUser, DeleteUser,
    CreateSlot, GetSlots, UpdateSlot, DeleteSlot, GetSlot, GetSlotsWithRoutes,
    GetLinks, CreateLink, DeleteLink,
    CreateSession, GetSession, GetSessionByPilot, UpdateSession, DeleteSession,
    CreateMulti, GetMultipliers, GetMultiplier, GetMultiplierByLabel, DeleteMulti
    };
