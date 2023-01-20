/*

  Isomorphic SmartClient Node.js Server
  Copyright 2017 and beyond Isomorphic Software, Inc. All rights reserved.
  "SmartClient" is a trademark of Isomorphic Software, Inc.

  LICENSE NOTICE
     INSTALLATION OR USE OF THIS SOFTWARE INDICATES YOUR ACCEPTANCE
     OF ISOMORPHIC SOFTWARE LICENSE TERMS. If you have received this file
     without an accompanying Isomorphic Software license file, please
     contact licensing@isomorphic.com for details. Unauthorized copying and
     use of this software is a violation of international copyright law.

  LGPL LICENSE
     This software may be used under the terms of the Lesser GNU Public License (LGPL),
     version 3.0 (see http://www.gnu.org/licenses/lgpl-3.0.html).  The LGPL is generally
     considered a commercial-friendly license, and is used by the Hibernate framework
     among others.  For any questions about the LGPL, please refer to a qualified attorney;
     Isomorphic does not provide legal advice.

  OTHER LICENSE OPTIONS
     Alternative licensing terms, including licenses with no requirement to make modifications
     publicly available, can be arranged by contacting Isomorphic Software by email
     (licensing@isomorphic.com) or web (www.isomorphic.com).

*/

"use strict";

const assert = require("assert");
// const mysql = require("mysql");

const ResourceFactory = require("srv-core").ResourceFactory;
const Exception = require("srv-core").Exception;
const Config = require("srv-config").Config;
const Log = require("srv-log").Log;

/**
 * MySQL connection factory.
 *
 * @extends ResourceFactory
 */
class MysqlFactory extends ResourceFactory {

    /**
     * Creates connection factory for MySQL.
     *
     * @param {string} dbName - Name of database for which connection factory is created
     * @return {MysqlFactory}
     */
    constructor(dbName) {
        assert.equal(typeof dbName, "string", "argument 'dbName' must be string");
        super();
        this._dbName = dbName;
        let dbConfig = Config.getValue("db");
        if (!dbConfig) {
            throw new Exception("Section 'db' is not defined in configuration");
        }
        dbConfig = dbConfig[dbName];
        if (!dbConfig) {
            throw new Exception("Database '" + dbName + "' is not defined in configuration");
        }
        if (!dbConfig.type) {
            throw new Exception("Type of database '" + dbName + "' is not defined in configuration");
        }
        if (dbConfig.type !== "mysql") {
            throw new Exception("Type of database '" + dbName + "' is not 'mysql'. Configured type: '" + dbConfig.type + "'");
        }
        this._connectionConf = dbConfig.connection;
        if (!this._connectionConf) {
            this._connectionConf = {};
        }
    }

    /**
     * Class logger.
     *
     * @type {Log}
     */
    get log() {
        return _log;
    }

    /**
     * Returns <code>Promise</code> which resolves with newly created connection
     * or is rejected with connection creation error.
     *
     * @return {Promise} for creating new resource
     */
    create() {
        const self = this;
        return new Promise(function(resolve, reject) {
            const connection = mysql.createConnection(self._connectionConf);
            connection.connect(function(err) {
                if (err) {
                    return reject(new Exception("Failed to establish MySQL connection", err));
                }
                connection.query("set session sql_mode='ANSI'", [], function(modeErr, result) {
                    if (modeErr) {
                        return reject(new Exception("Failed to set MySQL to sql_mode='ANSI'", modeErr));
                    }
                    connection.on('error', function(e) {
                        self.log.error({err: new Exception("MySQL connection for database '" + self._dbName + "' failure", e)},
                            "MySQL connection for database '" + self._dbName + "' failure");
                    });
                    return resolve(connection);
                });
            });
        });
    }

    /**
     * Returns <code>Promise</code> which resolves when connection is destroyed.
     * If error occures when connection connection - error is logged and connection is closed anyway.
     *
     * @param {*} connection - Connection to be destroyed
     * @return {Promise} for destroying specified resource
     */
    destroy(connection) {
        const self = this;
        return new Promise(function(resolve) {
            connection.end(function(err) {
                if (err) {
                    self.log.error({err: new Exception("Error occured while closing MySQL connection.", err)},
                        "Error occured while closing MySQL connection. Connection closed anyway.");
                }
                resolve();
            });
        });
    }

    /**
     * Returns <code>Promise</code> which resolves to <code>true</code> if specified resource is valid
     * and resolves to <code>false</code> if specified resource is invalid.
     *
     * @param {*} connection - Connection to be validated
     * @return {Promise} for testing specified resource
     */
    validate(connection) {
        const self = this;
        return new Promise(function(resolve) {
            connection.query('select 1', function(err, results, fields) {
                if (err) {
                    self.log.error({err: err}, "MySQL connection test failed.");
                    return resolve(false);
                }
                return resolve(true);
            });
        });
    }

}

// Static value for MysqlFactory.log
const _log = new Log(MysqlFactory);

module.exports = MysqlFactory;
