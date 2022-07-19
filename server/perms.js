// Console Module
//require("./console.js");
//console.file("vacenter.log");

/*****
 * 
 * Require mandatory modules/packages
 * 
 */

// Modules for interacting with filesyste
const fs = require('fs');
const path = require('path');

/*****
 * 
 * Import permissions schema
 * 
 */

const perms = JSON.parse(fs.readFileSync(path.join(__dirname, 'perms.json')));

/*****
 * 
 * Create module constructor
 */
function Perm(userPerms = 0) {


	// Check if a user has a perm
	this.has = (perm) => {
		return ((userPerms & perms[perm]) == perms[perm])
	}

	// Set a perm
	this.set = (perm) => {
		userPerms = userPerms | perms[perm];
	}

	// Remove a perm
	this.unset = (perm) => {
		userPerms = userPerms & (~ perms[perm]);
	}

	// Get list of all perms for the user
	this.get = () => {

		let permList = {};

		for (perm in perms) {
			permList[perm] = this.has(perm);
		}

		return permList;

	}

	// Get the numeric value of the perms for the user for storing in DB etc
	this.value = () => {
		return userPerms;
	}

}

module.exports = {
	Perm: Perm,
	schema: Object.keys(perms)
}