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

const DataSourceFactory = require("./DataSourceFactory");
const DataSource = require("./DataSource");

// Holds static pools for data sources
let pools = {};

/**
 * Data source pool.
 */
class DataSourcePool {

    // Class logger
    static get log() {
        return _log;
    }

    /**
     * 'dataSource' configuration section.
     *
     * @type {Object}
     * @throws {Exception} if 'dataSource' section is not defined
     */
    static get dataSourceConfig() {
        let dataSourceConfig = Config.getValue("dataSource");
        if (!dataSourceConfig) {
            throw new Exception("Section 'dataSource' is not defined in configuration");
        }
        return dataSourceConfig;
    }

    /**
     * Acquires data source.
     *
     * @param {string} dsName - Name of data source to acquire
     * @param {function} callback - Callback executed when finished
     */
    static acquire(dsName, callback) {
        assert.equal(typeof dsName, "string", "argument 'dsName' must be string");
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        DataSourcePool.log.debug("Acquiring data source '" + dsName + "'");
        let pool = pools[dsName];
        if (!pool) {
            try {
                pool = DataSourcePool._createPool(dsName);
            } catch(err) {
                return callback(err);
            }
            pools[dsName] = pool;
        }
        pool.acquire().then(function(dataSource) {
            return callback(null, dataSource);
        }, function(err) {
            return callback(err);
        });
    }

    /**
     * Releases data source.
     *
     * @param {string} dbName - Name of data source to be released
     * @param {*} dataSource - Data source beeing released
     * @param {function} callback - Callback executed when finished
     */
    static release(dsName, dataSource, callback) {
        assert.equal(typeof dsName, "string", "argument 'dsName' must be string");
        assert(dataSource instanceof DataSource, true, "argument 'dataSource' should be an instance of DataSource");
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        DataSourcePool.log.debug("Releasing data source '" + dsName + "'");
        let pool = pools[dsName];
        if (!pool) {
            return callback(new Exception("Pool for '" + dsName + "' is not initialized"));
        }
        return dataSource.freeResources(function(err) {
            pool.release(dataSource).then(function() {
                return callback(err);
            }, function(e) {
                return callback(err);
            });
        });
    }

    /**
     * (Internal) Creates data source pool for specified data source.
     *
     * @param {string} dsName - Name of data source for which pool is created
     * @return {genericPool.Pool} Data source pool.
     */
    static _createPool(dsName) {
        assert.equal(typeof dsName, "string", "argument 'dsName' must be string");
        DataSourcePool.log.debug("Creating data source pool for '" + dsName + "' data source");
        let dataSourceConfig = DataSourcePool.dataSourceConfig;
        let poolSettings = dataSourceConfig.pool;
        if (!poolSettings) {
            poolSettings = {};
        }
        let pool = genericPool.createPool(new DataSourceFactory(dsName), poolSettings);
        pool.on('factoryCreateError', function(err){
            DataSourcePool.log.error({err: err}, "Error occured while creating data source '" + dsName + "'");
        });
        pool.on('factoryDestroyError', function(err){
            DataSourcePool.log.error({err: err}, "Error occured while destroying data source '" + dsName + "'");
        });
        pool.start();
        DataSourcePool.log.debug("Pool created for data source '" + dsName + "'");
        return pool;
    }

}

// Static value for DataSourcePool.log
const _log = new Log(DataSourcePool);

module.exports = DataSourcePool;
