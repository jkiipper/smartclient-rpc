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
const Log = require("srv-log").Log;

const BaseRequest = require("../BaseRequest");
const Const = require("../Const");

let RPCManager;
let DataSource;
let DSResponse;
let DataSourcePool;

/**
 * Represents DataSource request.
 * TODO: implement transaction handling at RPCManager level
 *
 * @extends BaseRequest
 */
class DSRequest extends BaseRequest {

    /**
     * Creates instance of DS request.
     *
     * @param {RPCManager} [rpcManager] - RPC manager instance
     * @param {*} data - Request data
     */
    constructor(rpcManager, data) {
        ensureDependencies();
        if (rpcManager instanceof RPCManager) {
            super(rpcManager);
            this.data = data;
        } else {
            super();
            if (data) {
                this.data = data;
            } else {
                this.data = rpcManager;
            }
        }
        if (!this.appID) {
            this.appID = Const.BUILTIN_APPLICATION;
        }
        this._dataSourceName = null;
        this._operationType = null;
        this._textMatchStyle = Const.TEXT_MATCH_STYLE_SUBSTRING;
        // If operationConfig object is provided - use it
        if (typeof this.operationConfig === "object" && this.operationConfig !== null) {
            this._dataSourceName = this.operationConfig[Const.DATA_SOURCE_NAME];
            this._operationType = this.operationConfig[Const.OPERATION_TYPE];
            this._textMatchStyle = this.operationConfig[Const.TEXT_MATCH_STYLE];
        } else if (this.operation) {
            // No operationConfig - derive datasource name and operation type from operation name in form DSNAME_OPTYPE
            let operationConfig = this.operation.split("_");
            if (operationConfig.length > 1) {
                // First part - datasource name
                this._dataSourceName = operationConfig.shift();
                // Rest of it - operation type
                this._operationType = operationConfig.join("_");
            }
        }
        if (this._operationType === Const.OPERATION_TYPE_UPDATE || this._operationType === Const.OPERATION_TYPE_REMOVE) {
            this._textMatchStyle = Const.TEXT_MATCH_STYLE_EXACT;
        }
        this._dataSource = null;
    }

    /**
     * Class logger.
     *
     * @type {Log}
     */
    get log() {
        return this._log;
    }

    /**
     * RPCManager object.
     *
     * @type {RPCManager}
     */
    get rpcManager() {
        return super.rpcManager;
    }
    set rpcManager(rpcManager) {
        super.rpcManager = rpcManager;
        if (this.rpcManager) {
            // Use logger from RPCManager (which uses request logger)
            this._log = new Log(DSRequest, this.rpcManager.log);
        } else {
            this._log = new Log(DSRequest);
        }
    }

    /**
     * Request data.
     *
     * @type {Object}
     */
    get data() {
        return this._data;
    }
    set data(data) {
        if (typeof data !== "object" || data === null) {
            data = {};
        }
        this._data = data;
    }

    /**
     * App ID.
     *
     * @type {string}
     */
    get appID() {
        return this.data[Const.APP_ID];
    }
    set appID(appID) {
        assert(typeof appID, "string", "argument 'appID' must be string");
        this.data[Const.APP_ID] = appID;
    }

    /**
     * Operation name.
     *
     * @type {string}
     */
    get operation() {
        return this.data[Const.OPERATION];
    }

    /**
     * Request operation config.
     *
     * @type {Object}
     */
    get operationConfig() {
        return this.data[Const.OPERATION_CONFIG];
    }

    /**
     * Operation type.
     *
     * @type {string}
     */
    get operationType() {
        return this._operationType;
    }

    /**
     * Text match style.
     *
     * @type {string}
     */
    get textMatchStyle() {
        return this._textMatchStyle;
    }

    /**
     * Request criteria.
     *
     * @type {Object}
     */
    get criteria() {
        return this.data[Const.CRITERIA];
    }
    set criteria(criteria) {
        assert(typeof criteria, "object", "argument 'criteria' must be object");
        this.data[Const.CRITERIA] = criteria;
    }

    /**
     * Returns <code>true</code> if data source request has an advanced criteria.
     *
     * @type {boolean}
     */
    get isAdvancedCriteria() {
        if (this.criteria) {
            return this.criteria._constructor === Const.ADVANCED_CRITERIA;
        }
        return false;
    }

    /**
     * Should strict SQL filtering should be used.
     * If <cdoe>true</code> - advanced criteria will follow SQL99 behavior for dealing with <code>null</code> values.
     *
     * @type {boolean}
     */
    get strictSQLFiltering() {
        if (this.criteria) {
            return this.criteria[Const.STRICT_SQL_FILTERING];
        }
        return;
    }
    set strictSQLFiltering(strictSQLFiltering) {
        if (strictSQLFiltering === undefined || strictSQLFiltering === null) {
            if (this.criteria) {
                delete this.criteria[Const.STRICT_SQL_FILTERING];
            }
        } else {
            assert(typeof strictSQLFiltering, "boolean", "argument 'criteria' must be boolean");
            if (!this.criteria) {
                this.criteria = {};
            }
            this.criteria[Const.STRICT_SQL_FILTERING] = strictSQLFiltering;
        }
    }

    /**
     * Request sort by.
     *
     * @type {Object}
     */
    get sortBy() {
        let sortBy = this.data[Const.SORT_BY];
        if (sortBy) {
            return sortBy;
        }
        sortBy = this.operationConfig[Const.SORT_BY];
        if (sortBy) {
            return sortBy;
        }
        return [];
    }

    /**
     * Request start row.
     *
     * @type {number}
     */
    get startRow() {
        let startRow = this.data[Const.START_ROW];
        startRow = parseInt(startRow, 10);
        if (isNaN(startRow)) {
            startRow = 0;
        }
        return startRow;
    }

    /**
     * Request end row.
     *
     * @type {number}
     */
    get endRow() {
        let endRow = this.data[Const.END_ROW];
        endRow = parseInt(endRow, 10);
        if (isNaN(endRow)) {
            endRow = 0;
        }
        return endRow;
    }

    /**
     * Component ID.
     *
     * @type {string}
     */
    get componentId() {
        return this.data[Const.COMPONENT_ID];
    }

    /**
     * Old values.
     *
     * @type {Object}
     */
    get oldValues() {
        return this.data[Const.OLD_VALUES];
    }
    set oldValues(oldValues) {
        assert(typeof oldValues, "object", "argument 'oldValues' must be object");
        this.data[Const.OLD_VALUES] = oldValues;
    }

    /**
     * Values.
     *
     * @type {Object}
     */
    get values() {
        return this.data[Const.VALUES];
    }
    set values(values) {
        assert(typeof values, "object", "argument 'values' must be object");
        this.data[Const.VALUES] = values;
    }

    /**
     * Data source name.
     *
     * @type {string|null}
     */
    get dataSourceName() {
        return this._dataSourceName;
    }

    /**
     * Data source instance.
     *
     * @type {Object|null}
     */
    get dataSource() {
        return this._dataSource;
    }
    set dataSource(dataSource) {
        assert(dataSource === null || dataSource instanceof DataSource, true, "argument 'dataSource' must be instance of DataSource");
        this._dataSource = dataSource;
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
                return self.dataSource.init(self, callback);
            });
        } else {
            return callback(new Exception("Data source name is not set"));
        }
    }

    /**
     * Calls {@link DataSource.startTransaction}
     * TODO: implement transaction handling at RPCManager level
     *
     * @param {function} callback - Callback executed when finished
     */
    startTransaction(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        if (this.dataSource) {
            return this.dataSource.startTransaction(callback);
        } else {
            return callback(new Exception("Data source is not initialized"));
        }
    }

    /**
     * Executes DS request.
     * This method will be called from {@link RPCManager}.
     * TODO: implement transaction handling at RPCManager level
     *
     * @param {function} callback - Callback executed when finished
     */
    execute(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        const self = this;
        this.startTransaction(function(err) {
            if (err) {
                // Instead of returning plain error - return DS response with failure
                return callback(null, new DSResponse(new Exception("Failed to start transaction", err)));
            }
            return self.dataSource.execute(function(err, response) {
                return self._executeFinish(err, response, callback);
            });
        });
    }

    /**
     * Internal method to complete execution.
     * <ul>
     * <li>If <code>err<code> is set - rollback transaction.</li>
     * <li>If execution was ok - commit.</li>
     * <li>If commit fails - change response status to STATUS_TRANSACTION_FAILED (-10) and rollback.</li>
     * </ul>
     *
     * @param {any} err - Error from execution
     * @param {any} response - Response from execution
     * @param {function} callback - Callback executed when finished
     */
    _executeFinish(err, response, callback) {
        const self = this;
        if (err) {
            // Got an execution error - rollback
            this.rollback(function(errRollback) {
                if (errRollback) {
                    // Failed to rollback - log it and continue
                    self.log.error({err: new Exception("Failed to rollback", errRollback)});
                }
                // Instead of returning plain execution error - return DS response with failure
                if (err instanceof Exception) {
                    self.log.error({err: err}, "Execution failure");
                    return callback(null, new DSResponse(err));
                } else {
                    // Wrap error into Exception
                    err = new Exception("Execution failure", err);
                    self.log.error({err: err});
                    return callback(null, new DSResponse(err));
                }
            });
        } else {
            // Execution success
            if (!(response instanceof DSResponse)) {
                // Wrap response into DSResponse
                response = new DSResponse(DSResponse.STATUS_SUCCESS, response);
            }
            this.commit(function(errCommit) {
                if (errCommit) {
                    // Failed to commit - log it, set status to transaction failed and rollback
                    self.log.error(new Exception("Failed to commit", errCommit));
                    response.status = DSResponse.STATUS_TRANSACTION_FAILED;
                    self.rollback(function(errRollback) {
                        if (errRollback) {
                            // Failed to rollback - log it and continue
                            self.log.error(new Exception("Failed to rollback", errRollback));
                        }
                        // Return response
                        return callback(null, response);
                    });
                } else {
                    // Return response
                    return callback(null, response);
                }
            });
        }
    }

    /**
     * Calls {@link DataSource.commit}
     * TODO: implement transaction handling at RPCManager level
     *
     * @param {function} callback - Callback executed when finished
     */
    commit(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        if (this.dataSource) {
            return this.dataSource.commit(callback);
        } else {
            return callback(new Exception("Data source is not initialized"));
        }
    }

    /**
     * Calls {@link DataSource.rollback}
     * TODO: implement transaction handling at RPCManager level
     *
     * @param {function} callback - Callback executed when finished
     */
    rollback(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        if (this.dataSource) {
            return this.dataSource.rollback(callback);
        } else {
            return callback(new Exception("Data source is not initialized"));
        }
    }

    /**
     * Frees resources of DS request.
     * This method will be called from {@link RPCManager}.
     *
     * @param {function} callback - Callback executed when finished
     */
    freeResources(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        if (this.dataSource) {
            return DataSourcePool.release(this.dataSource.ID, this.dataSource, callback);
        } else {
            return callback();
        }
    }

    /**
     * Creates DS request object representation.
     *
     * @return {Object} DS request representation
     */
    toObject() {
        let o = super.toObject();
        o.data = this.data;
        return o;
    }

    /**
     * Returns string representing this object.
     *
     * @return {string}
     */
    toString() {
        return JSON.stringify(this.toObject());
    }

}

/**
 * Ensures that dependencies are loaded correctly.
 * Solves cyclic references loading problem.
 */
const ensureDependencies = function() {
    if (typeof RPCManager !== "function") {
        RPCManager = require("../RPCManager");
    }
    if (typeof DataSource !== "function") {
        DataSource = require("./DataSource");
    }
    if (typeof DSResponse !== "function") {
        DSResponse = require("./DSResponse");
    }
    if (typeof DataSourcePool !== "function") {
        DataSourcePool = require("./DataSourcePool");
    }
};

module.exports = DSRequest;
