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
const genericPool = require("generic-pool");

const Exception = require("srv-core").Exception;
const ResourceFactory = require("srv-core").ResourceFactory;
const Config = require("srv-config").Config;
const Log = require("srv-log").Log;

// Holds static pools for data base connections
let _pools = {};

/**
 * Data base connection pool for data sources.
 */
class ConnectionPool {

    // Class logger
    static get log() {
        return _log;
    }

    /**
     * 'db' configuration section.
     *
     * @type {Object}
     * @throws {Exception} if 'db' section is not defined
     */
    static get dbConfig() {
        let dbConfig = Config.getValue("db");
        if (!dbConfig) {
            throw new Exception("Section 'db' is not defined in configuration");
        }
        return dbConfig;
    }

    /**
     * Returns name of default database as configured in 'db.defaultDatabase'.
     *
     * @type {string} Name of default data base
     * @throws {Exception} if 'db' section is not defined or 'db.defaultDatabase' is not specified
     */
    static get defaultDatabase() {
        let dbName = ConnectionPool.dbConfig.defaultDatabase;
        if (!dbName) {
            throw new Exception("Default database is not defined in configuration");
        }
        return dbName;
    }

    /**
     * Returns type of specified data base.
     * If parameter <code>dbName</code> is not specified - returns type of default data base.
     *
     * @param {string} [dbName] - Name of data base
     * @return {string} Type of data base
     * @throws {Exception} <ul>
     *      <li>If there is no 'db' section in configuration</li>
     *      <li>If <code>dbName</code> is not specified and default data base is not configured</li>
     *      <li>If specified data base is not configured</li>
     *      <li>If type of data base is not specified</li>
     *  </ul>
     */
    static getDBType(dbName) {
        if (dbName) {
            assert.equal(typeof dbName, "string", "argument 'dbName' must be string");
        }
        if (!dbName) {
            dbName = ConnectionPool.defaultDatabase;
        }
        let dbConfig = ConnectionPool.dbConfig[dbName];
        if (!dbConfig) {
            throw new Exception("Database " + dbName + " is not defined in configuration");
        }
        if (!dbConfig.type) {
            throw new Exception("Type of database " + dbName + " is not defined in configuration");
        }
        return dbConfig.type;
    }

    /**
     * Acquires data base connection. If <code>dbName</code> is not specified - use default connection pool.
     *
     * @param {string} [dbName] - Name of database we want to connect to.
     *      Uses default (from configuration) if not specified.
     * @param {function} callback - Callback executed when finished
     */
    static acquire(dbName, callback) {
        if (!callback) {
            // single parameter (callback) provided
            callback = dbName;
            dbName = null;
            assert.equal(typeof callback, "function", "argument 'callback' must be function");
        } else {
            // two parameters (dbName and callback) provided
            if (dbName) {
                assert.equal(typeof dbName, "string", "argument 'dbName' must be string");
            }
            assert.equal(typeof callback, "function", "argument 'callback' must be function");
        }
        ConnectionPool.log.debug("Acquiring connection for '" + (dbName || "default") + "' configuration");
        if (!dbName) {
            try {
                dbName = ConnectionPool.defaultDatabase;
            } catch (err) {
                return callback(err);
            }
        }
        let pool = _pools[dbName];
        if (!pool) {
            try {
                pool = ConnectionPool._createPool(dbName);
            } catch(err) {
                return callback(err);
            }
            _pools[dbName] = pool;
        }
        pool.acquire().then(function(connection) {
            return callback(null, connection);
        }, function(err) {
            return callback(err);
        });
    }

    /**
     * Releases data base connection. If <code>dbName</code> is not specified - use default connection pool.
     *
     * @param {string} [dbName] - Name of database we want to release connection.
     *      Uses default (from configuration) if not specified.
     * @param {*} connection - Connection beeing released
     * @param {function} callback - Callback executed when finished
     */
    static release(dbName, connection, callback) {
        if (!callback) {
            // two parameters (connection and callback) provided
            callback = connection;
            connection = dbName;
            dbName = null;
            assert.equal(typeof callback, "function", "argument 'callback' must be function");
        } else {
            // three parameters (dbName, connection and callback) provided
            if (dbName) {
                assert.equal(typeof dbName, "string", "argument 'dbName' must be string");
            }
            assert.equal(typeof callback, "function", "argument 'callback' must be function");
        }
        ConnectionPool.log.debug("Releasing connection for '" + (dbName || "default") + "' configuration");
        if (!dbName) {
            try {
                dbName = ConnectionPool.defaultDatabase;
            } catch (err) {
                return callback(err);
            }
        }
        let pool = _pools[dbName];
        if (!pool) {
            return callback(new Exception("Pool for '" + dbName + "' is not initialized"));
        }
        pool.release(connection).then(function() {
            return callback();
        }, function(err) {
            return callback(err);
        });
    }

    /**
     * (Internal) Creates connection pool for specified database.
     *
     * @param {string} dbName - Name of database for which connection pool is created
     * @return {genericPool.Pool} Connection pool.
     */
    static _createPool(dbName) {
        assert.equal(typeof dbName, "string", "argument 'dbName' must be string");
        ConnectionPool.log.debug("Creating connection pool for '" + dbName + "' configuration");
        let dbConfig = ConnectionPool.dbConfig[dbName];
        if (!dbConfig) {
            throw new Exception("Database " + dbName + " is not defined in configuration");
        }
        if (!dbConfig.type) {
            throw new Exception("Type of database " + dbName + " is not defined in configuration");
        }
        let factoryName = dbConfig.factory;
        if (!factoryName) {
            throw new Exception("Connection factory for database " + dbName + " is not defined in configuration");
        }
        let factory;
        try {
            const FactoryClass = require("./" + factoryName);
            factory = new FactoryClass(dbName);
        } catch (err) {
            throw new Exception("Failed to load database factory class '" + factoryName + "'", err);
        }
        if (!(factory instanceof ResourceFactory)) {
            throw new Exception("Factory class '" + factoryName + "' is not instance of ResourceFactory");
        }
        let poolSettings = dbConfig.pool;
        if (!poolSettings) {
            poolSettings = {};
        }
        let pool = genericPool.createPool(factory, poolSettings);
        pool.on('factoryCreateError', function(err) {
            ConnectionPool.log.error({err: err}, "Error occured while connecting to database '" + dbName + "'");
        });
        pool.on('factoryDestroyError', function(err) {
            ConnectionPool.log.error({err: err}, "Error occured while disconnecting from '" + dbName + "'");
        });
        pool.start();
        return pool;
    }

}

// Static value for ConnectionPool.log
const _log = new Log(ConnectionPool);

module.exports = ConnectionPool;
