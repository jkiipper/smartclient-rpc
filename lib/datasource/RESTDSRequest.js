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

const Exception = require("srv-core").Exception;
const Config = require("srv-config").Config;
const Log = require("srv-log").Log;

const DSRequest = require("./DSRequest");
const DataSourcePool = require("./DataSourcePool");
const Const = require("../Const");

/**
 * Represents REST DataSource request.
 * TODO: finish REST protocol implementation
 *
 * @extends DSRequest
 */
class RESTDSRequest extends DSRequest {

    /**
     * Creates instance of REST DS request.
     *
     * @param {RPCManager} rpcManager - RPC manager instance
     * @param {*} data - Request data
     */
    constructor(rpcManager, data) {
        super(rpcManager, data);
        // Use logger from RPCManager (which uses request logger)
        this._log = new Log(RESTDSRequest, this.rpcManager.log);
        if (!this.criteria) {
            this.criteria = {};
        }
        if (!this.values) {
            this.values = {};
        }
        if (!this.oldValues) {
            this.oldValues = {};
        }
    }

    /**
     * Should JSON response be wrapped with {@link RESTDSRequest#jsonPrefix} and {@link RESTDSRequest#jsonSuffix}.
     *
     * @type {boolean}
     */
    get wrapJSONResponses() {
        return Config.getValue("rest.wrapJSONResponses");
    }

    /**
     * Prefix to wrap JSON responses.
     *
     * @type {string}
     */
    get jsonPrefix() {
        let prefix = Config.getValue("rest.jsonPrefix");
        if (this.dataSource && this.dataSource.config && typeof this.dataSource.config.jsonPrefix === "string") {
            prefix = this.dataSource.config.jsonPrefix;
        }
        return prefix;
    }

    /**
     * Suffix to wrap JSON responses.
     *
     * @type {string}
     */
    get jsonSuffix() {
        let suffix = Config.getValue("rest.jsonSuffix");
        if (this.dataSource && this.dataSource.config && typeof this.dataSource.config.jsonSuffix === "string") {
            suffix = this.dataSource.config.jsonSuffix;
        }
        return suffix;
    }

    /**
     * Loads, instantiates and initializes data source.
     * This method will be called from {@link RPCManager}.
     *
     * @param {function} callback - Callback executed when finished
     */
    init(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        if (this.dataSourceName) {
            const self = this;
            DataSourcePool.acquire(this.dataSourceName, function(err, dataSource) {
                if (err) {
                    return callback(err);
                }
                self.dataSource = dataSource;
                if (self.operationType === Const.OPERATION_TYPE_FETCH) {
                    self.criteria = self.data.data;
                    if (self.operationConfig._rawPk) {
                        if (dataSource.pkFieldNames.length > 0) {
                            self.criteria[dataSource.pkFieldNames[0]] = self.operationConfig._rawPk;
                        }
                    }
                } else if (self.operationType === Const.OPERATION_TYPE_ADD) {
                    self.values = self.data.data;
                    if (self.operationConfig._rawPk) {
                        if (dataSource.pkFieldNames.length > 0) {
                            self.values[dataSource.pkFieldNames[0]] = self.operationConfig._rawPk;
                        }
                    }
                } else {
                    for (const key in self.data.data) {
                        const field = dataSource.getField(key);
                        if (field && field.primaryKey === true) {
                            self.criteria[key] = self.data.data[key];
                        } else {
                            self.values[key] = self.data.data[key];
                        }
                    }
                    if (self.operationConfig._rawPk) {
                        if (dataSource.pkFieldNames.length > 0) {
                            self.criteria[dataSource.pkFieldNames[0]] = self.operationConfig._rawPk;
                        }
                    }
                }
                return self.dataSource.init(self, callback);
            });
        } else {
            return callback(new Exception("Data source name is not set"));
        }
    }
}

module.exports = RESTDSRequest;
