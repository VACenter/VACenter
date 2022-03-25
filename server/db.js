/*****
 * 
 * Require mandatory modules/packages
 */

// Standard mysql module
const mysql = require('mysql');
let db;

// Modules for interacting with filesyste
const fs = require('fs');
const path = require('path');

/*****
 * 
 * Import configuration file
 */

const config = require('./config-test.js');
const vaconfig = config.get();

/*****
 * 
 * Import database schema
 * 
 */

const tables = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json')));

/*****
 * 
 * Object to hold all functions to export -- list of functions will be dynamically generated
 * 
 */

let functions = {}

/*****
 * 
 * Function to initialise mysql connection
 * 
 */

function dbConnect() {

  console.log("Connecting to DB");

  //  vaconfig.database.flags = "SSL";

  // Get the DB configuration
  let created = (vaconfig.database.created) ? true : false;

  // Remove the created field as it cannot be passed when connecting to the DB
  delete vaconfig.database.created;

  // Connect to the database
  db = mysql.createConnection(vaconfig.database);

  // Add the created field back to the config
  vaconfig.database.created = created;

}

/*****
 * 
 * Function to check if we have all needed DB tables and create if needed
 * 
 */

function createTables() {

  // See if tables already created
  if (vaconfig.database.created) {
    console.log("Tables already created -- no action needed");
    return;
  }

  console.log("Config does not indicate if tables exists. Checking for tables");

  // Grab list of current tables using MySQL "show tables" command
  db.query('show tables', (e, results, fields) => {

    // Check for errors and throw and error if needed
    if (e) throw e; return;

    // Convert results to array of strings
    let currentTables = []
    for (tableObj of results) {
      currentTables.push(tableObj[fields[0].name]);
    }

    // Iterate tables config to see if we need to create the table
    for (let table in tables) {

      console.log("Checking if table needs to be created: " + table);
      
      // Check if the table we need to create already exists in the DB and create if not
      if (currentTables.indexOf(table) < 0) {

        console.log("Creating table " + table);

        // Get the primary key for the table
        const pk = tables[table].pk;

        // Build the SQL query
        let sql = "CREATE TABLE ?? ( ?? ";
        sql += tables[table].fields[pk].type + " ";
        sql += tables[table].fields[pk].flags + " ";
        sql += (tables[table].fields[pk].default == null) ? "" : (" DEFAULT " + tables[table].fields[pk].default);
        sql += ", ts bigint NOT NULL DEFAULT 0, ";
        sql += "PRIMARY KEY ( ?? ) ) DEFAULT CHARSET=utf8";

        // Build the query object
        const q = {
          sql: sql,
          values: [
            table,
            pk,
            pk
          ]
        }

        // Send the query to the DB
        const query = db.query(q, (createErr, createResults, createFields) => {

          // Check for errors and throw and error if needed
          if (createErr) throw createErr; return;

          console.log("Table " + table + " created");
          console.log("Adding fields to table " + table);

          // Iterate all fields
          for (let field in tables[table].fields) {

            // Check if field is primary key and don't create as already exists when table created
            if (field != pk) {

              // Build the SQL query
              let sql = "ALTER TABLE ?? ADD COLUMN ?? ";
              sql += tables[table].fields[field].type + " ";
              sql += tables[table].fields[field].flags + " ";
              sql += (tables[table].fields[field].default == null) ? "" : (" DEFAULT " + tables[table].fields[field].default);
      
              // Build the query object
              const q = {
                sql: sql,
                values: [
                  table,
                  field
                ]
              }
      
              // Send the query to the DB
              const query = db.query(q, (alterErr, alterResults, alterFields) => {

                // Check for errors and throw and error if needed
                if (alterErr) throw alterErr; return;

                console.log("Field " + field + " added to table " + table);

              });

            }
          }

        });

      } else {

        console.log("Table " + table + " exists -- not creating");

      }

    }

    // Update config to show table is created
    vaconfig.database.created = true;
    config.update(vaconfig);

  });

}

/*****
 * 
 * Populate exports with utility functions for each table
 * 
 */
function createFunctions() {

  // Iterate tables config to create functions for all tables
  for (let table in tables) {

    // Create table-specific object to hold functions for the table
    functions[table] = {};

    // "create" function for the table - promise-based
    functions[table].create = (params, dbTable = table) => {
      return new Promise((resolve, reject) => {

        // Array to hold values which will be dynamically escaped when the query is built
        let values = [];

        // Create variable for the SQL query
        let sql = `INSERT INTO ${dbTable} (`;

        // Iterate through the fields and add the names to the query
        for (field in params) {

          sql += `${field},`;

        }

        // Add a time stamp field
        sql += 'ts';

        sql += ') VALUES (';

        // Iterate through the field and add placeholder to the query and add values to the array
        for (field in params) {

          sql += '?,';
          values.push(params[field]);

        }

        // Add time stamp placeholder to the query and value to the array
        values.push(new Date().getTime()); // time stamp
        sql += '?)';

        // Build the query object
        const q = {
          sql: sql,
          values: values
        }

        // Send query to the DB
        const query = db.query(q, (e, results, fields) => {
          if (e) {
            reject(e);
          } else {
            resolve( { results: results, fields: fields } );
          }  
        });  

      });
    };

    // "update" function for the table - promise-based
    functions[table].update = (params, dbTable = table) => {
      return new Promise((resolve, reject) => {

        // Array to hold values which will be dynamically escaped when the query is built
        let values = [];

        // Create variable for the SQL query
        let sql = `UPDATE ${dbTable} SET `;

        // Iterate through the fields and add them to the SET clause with placeholders
        for (field in params.fields) {

          sql += `${field} = ?, `;

        }

        // Add time stamp field to the SET clause
        sql += 'ts = ? ';

        // Iterate through fields and add values to the array
        for (field in params.fields) {

          values.push(params.fields[field]);

        }

        // Add time stamp value to the array
        values.push(new Date().getTime()); // time stamp

        // Specify the WHERE filter
        sql += `WHERE ${params.where.field} ${params.where.operator} ?`;

        // Add value for WHERE filter to the array
        values.push(params.where.value);

        // Build the query object
        const q = {
          sql: sql,
          values: values
        }

        // Send query to the DB
        const query = db.query(q, (e, results, fields) => {
          if (e) {
            reject(e);
          } else {
            resolve( { results: results, fields: fields } );
          }
        });  

      });
    };

    // "delete" function for the table - promise-based
    functions[table].delete = (params = null, dbTable = table) => {
      return new Promise((resolve, reject) => {

        // Array to hold values which will be dynamically escaped when the query is built
        let values = [];

        // Only build and send query if we have a "where" filter -- do not risk deleting everything by accident
        if (params) {

          // Create variable for the SQL query
          let sql = `DELETE FROM ${dbTable} `;

          // Create WHERE clause
          sql += `WHERE `;

          // Iterate through the fields and add them to the SET clause with placeholders
          for (field in params) {
  
            sql += `${field} = ? AND `;
  
          }
  
          // Add time stamp field to the SET clause
          sql += 'ts > 0';
  
          // Iterate through fields and add values to the array
          for (field in params) {
  
            values.push(params[field]);
  
          }

          // Build the query object
          const q = {
            sql: sql,
            values: values
          }
  
          // Send query to the DB
          const query = db.query(q, (e, results, fields) => {
            if (e) {
              reject(e);
            } else {
              resolve( { results: results, fields: fields } );
            }
          }); 

        } else {

          reject("missing 'where'");

        }

      });
    };

    // "get" function for the table - promise-based
    functions[table].get = (params = null, dbTable = table) => {
      return new Promise((resolve, reject) => {

        // Array to hold values which will be dynamically escaped when the query is built
        let values = [];

        // Create variable for the SQL query
        let sql = `SELECT * FROM ${dbTable} `;

        // Add a WHERE clause if we have a "where" filter
        if (params) {

          // Create WHERE clause
          sql += `WHERE `;

          // Iterate through the fields and add them to the SET clause with placeholders
          for (field in params) {
  
            sql += `${field} = ? AND `;
  
          }
  
          // Add time stamp field to the SET clause
          sql += 'ts > 0';
  
          // Iterate through fields and add values to the array
          for (field in params) {
  
            values.push(params[field]);
  
          }

        }

        // Build the query object
        const q = {
          sql: sql,
          values: values
        }

        // Send the query to the DB
        const query = db.query(q, (e, results, fields) => {
          if (e) {
            reject(e);
          } else {
            resolve( { results: results, fields: fields } );
          }
        });  

      });
    };

    // "has" function for the table - promise-based
    functions[table].has = (params, dbTable = table) => {
      return new Promise((resolve, reject) => {
        resolve(`Has ${dbTable} done: ` + JSON.stringify(params));
      });
    };

  }

}

/*****
 * 
 * Function to initialise DB and connect if ready - promise-based
 * 
 */

functions.init = () => {
  return new Promise((resolve, reject) => {

    // Check there is a DB config object
    if (!vaconfig.hasOwnProperty("database")) {

      // We don't have a DB config object
      console.log("No database object defined!")

      // Create empty DB config object
      vaconfig.database = {
        host: null,
        port: null,
        user: null,
        password: null,
        database: null/*,
        created: false*/
      }

      // Update config file
      config.update(vaconfig);

      // We aren't ready to connect to reject the promise
      reject('db-config-missing');

    }

    // Check if we have all DB config values
    if (!vaconfig.database.hasOwnProperty("host") || vaconfig.database.host == null ||
        !vaconfig.database.hasOwnProperty("port") || vaconfig.database.port == null ||
        !vaconfig.database.hasOwnProperty("user") || vaconfig.database.user == null ||
        !vaconfig.database.hasOwnProperty("password") || vaconfig.database.password == null ||
        !vaconfig.database.hasOwnProperty("database") || vaconfig.database.database == null ||
        !vaconfig.database.hasOwnProperty("created") || vaconfig.database.created == null) {

          // We are missing DB config object properties or some are null
          console.log("Missing some DB config properties or not fully populated with values")

          // Check if any DB config object properties are missing and create if needed with null/default
          if (!vaconfig.database.hasOwnProperty("host")) { vaconfig.database.host = null; }
          if (!vaconfig.database.hasOwnProperty("port")) { vaconfig.database.port = null; }
          if (!vaconfig.database.hasOwnProperty("user")) { vaconfig.database.user = null; }
          if (!vaconfig.database.hasOwnProperty("password")) { vaconfig.database.password = null; }
          if (!vaconfig.database.hasOwnProperty("database")) { vaconfig.database.database = null; }
          if (!vaconfig.database.hasOwnProperty("created")) { vaconfig.database.created = false; }

          // Update config file
          config.update(vaconfig);

          // We aren't ready to connect to reject the promise
          reject('db-config-incomplete');

    } else {

      // We have a complete and populated DB config object
      console.log("Complete DB config object available")

      // Initialise mysql connection
      dbConnect();

      // Check if the DB tables are created and create if needed
      createTables();

      // Create utility functions for export
      createFunctions();

      console.log("Ready");

      // Resolve the promise
      resolve('ready');

    }

  });
}

/*****
 * 
 * Export functions
 * 
 */

module.exports = functions;