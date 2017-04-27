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
const path = require("path");

const Exception = require("srv-core").Exception;
const Config = require("srv-config").Config;

const Const = require("../Const");

let DSRequest;

/**
 * Data source class. Base for all data source implementations.
 */
class DataSource {

    /**
     * Creates data source instance.
     *
     * @param {Object} config - Data source configuration
     */
    constructor(config) {
        ensureDependencies();
        if (typeof config === "object" && config !== null) {
            this.config = config;
        } else {
            this.config = {};
        }
        this._dsRequest = null;
    }

    /**
     * Data source configuration.
     * Usualy this is set by {@link DataSource.loadInstance}.
     * Setting value does not validate configuration.
     * TODO: validate configuration object.
     *
     * @type {Object}
     */
    get config() {
        return this._config;
    }
    set config(config) {
        assert.equal(typeof config, "object", "argument 'config' must be object");
        this._config = config;
    }

    /**
     * Data source request which was used to initialize this request.
     *
     * @type {DSRequest}
     */
    get dsRequest() {
        return this._dsRequest;
    }
    set dsRequest(dsRequest) {
        assert.equal(dsRequest instanceof DSRequest, true, "argument 'dsRequest' must be instance of DSRequest");
        this._dsRequest = dsRequest;
    }

    /**
     * Data source ID (same as name).
     * @type {string}
     */
    get ID() {
        return this._config.ID;
    }
    set ID(ID) {
        assert.equal(typeof ID, "string", "argument 'ID' must be string");
        this._config.ID = ID;
    }

    /**
     * Data source name (same as ID).
     * @type {string}
     */
    get name() {
        return this.ID;
    }
    set name(name) {
        this.ID = name;
    }

    /**
     * Fields defined in data source.
     *
     * @type {Object[]}
     */
    get fields() {
        if (Array.isArray(this.config.fields)) {
            return this.config.fields;
        }
        return [];
    }
    set fields(fields) {
        assert.equal(Array.isArray(fields), true, "argument 'fields' must be instance of Array");
        this.config.fields = fields;
    }

    /**
     * Returns field by its name.
     *
     * @param {string} name - Fields name
     * @return {Object|null} Fields definition object or <code>null</code> if not found
     */
    getField(name) {
        const fields = this.fields;
        for (let i = 0, l = fields.length; i < l; i++) {
            if (fields[i] && fields[i].name === name) {
                return fields[i];
            }
        }
        return null;
    }

    /**
     * Array of PK fields defined in this data source.
     *
     * @type {Object[]}
     */
    get pkFields() {
        const pk = [];
        const fields = this.fields;
        for (let i = 0, l = fields.length; i < l; i++) {
            if (fields[i] && fields[i].primaryKey === true) {
                pk.push(fields[i]);
            }
        }
        return pk;
    }

    /**
     * Array of non-PK fields defined in this data source.
     *
     * @type {Object[]}
     */
    get nonPKFields() {
        const nonPK = [];
        const fields = this.fields;
        for (let i = 0, l = fields.length; i < l; i++) {
            if (fields[i] && fields[i].primaryKey !== true) {
                nonPK.push(fields[i]);
            }
        }
        return nonPK;
    }

    /**
     * Array of field names defined in this data source.
     *
     * @type {string[]}
     */
    get fieldNames() {
        const names = [];
        const fields = this.fields;
        for (let i = 0, l = fields.length; i < l; i++) {
            if (fields[i] && fields[i].name) {
                names.push(fields[i].name);
            }
        }
        return names;
    }

    /**
     * Array of PK field names defined in this data source.
     *
     * @type {string[]}
     */
    get pkFieldNames() {
        const names = [];
        const fields = this.pkFields;
        for (let i = 0, l = fields.length; i < l; i++) {
            if (fields[i] && fields[i].name) {
                names.push(fields[i].name);
            }
        }
        return names;
    }

    /**
     * Array of non-PK field names defined in this data source.
     *
     * @type {string[]}
     */
    get nonPKFieldNames() {
        const names = [];
        const fields = this.nonPKFields;
        for (let i = 0, l = fields.length; i < l; i++) {
            if (fields[i] && fields[i].name) {
                names.push(fields[i].name);
            }
        }
        return names;
    }

    /**
     * Creates object with PK fields values from provided parameter.
     *
     * @param {Object} data - Object containing values
     * @return {Object} Object with PK values only
     * @throws {Exception} When value for PK field is not specified in provided object.
     */
    getPKValue(data) {
        assert.equal(typeof data, "object", "argument 'data' must be object");
        assert.notEqual(data, null, "argument 'data' must not be null");
        const pkValue = {};
        const fields = this.pkFields;
        for (let i = 0, l = fields.length; i < l; i++) {
            const field = fields[i];
            if (field.name in data) {
                pkValue[field.name] = data[field.name];
            } else {
                throw new Exception("Missing value for PK field '" + field.name + "' ");
            }
        }
        return pkValue;
    }

    /**
     * Creates object without PK fields values from provided parameter.
     *
     * @param {Object} data - Object containing values
     * @return {Object} Object without PK values
     */
    getNonPKValue(data) {
        assert.equal(typeof data, "object", "argument 'data' must be object");
        assert.notEqual(data, null, "argument 'data' must not be null");
        const value = {};
        const fields = this.nonPKFields;
        for (let i = 0, l = fields.length; i < l; i++) {
            const field = fields[i];
            if (field.name in data) {
                value[field.name] = data[field.name];
            }
        }
        return value;
    }

    /**
     * Creates records with DS fields values from provided object.
     * If passed single object - single record is returned.
     * If passed array of objects - array of records is returned.
     *
     * @param {Object[]|Object|null} records - Records data
     * @return {Object[]|Object|null}
     */
    toRecords(records) {
        if (!records) {
            return null;
        }
        let recordList;
        if (Array.isArray(records)) {
            recordList = records;
        } else {
            recordList = [];
            recordList.push(records);
        }
        const ret = [];
        const fieldNames = this.fieldNames;
        for (let ri = 0, rl = recordList.length; ri < rl; ri++) {
            const record = {};
            for (let i = 0, l = fieldNames.length; i < l; i++) {
                const fieldName = fieldNames[i];
                if (recordList[ri] && fieldName in recordList[ri]) {
                    record[fieldName] = recordList[ri][fieldName];
                } else {
                    record[fieldName] = null;
                }
            }
            ret.push(record);
        }
        if (Array.isArray(records)) {
            return ret;
        } else {
            return ret[0];
        }
    }

    /**
     * Initializes data source with provided DS request.
     * <code>dsRequest</code> parameter value should be saved to <code>this.dsRequest</code>.
     *
     * @param {DSRequest} dsRequest - Data source request
     * @param {function} callback - Callback executed when finished
     */
    init(dsRequest, callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        this.dsRequest = dsRequest;
        return callback();
    }

    /**
     * Starts transaction. Should be overridden if data source uses transactions.
     *
     * @param {function} callback - Callback executed when finished
     */
    startTransaction(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        return callback();
    }

    /**
     * Executes DS request. This method acts as a dispatcher and calls appropriate operation method.
     * Can be overridden with caution - only this method is executed by {@link DSRequest}.
     * Operation methods (executeFetch, executeAdd etc.) are exectuted from this method only.
     *
     * @param {function} callback - Callback executed when finished
     */
    execute(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        if (!this.dsRequest.operationType) {
            callback(new Exception("Opertaion type is not specified"));
        }
        if (Const.OPERATION_TYPE_FETCH === this.dsRequest.operationType) {
            this.executeFetch(callback);
        } else if (Const.OPERATION_TYPE_ADD === this.dsRequest.operationType) {
            this.executeAdd(callback);
        } else if (Const.OPERATION_TYPE_REMOVE === this.dsRequest.operationType) {
            this.executeRemove(callback);
        } else if (Const.OPERATION_TYPE_UPDATE === this.dsRequest.operationType) {
            this.executeUpdate(callback);
        } else if (Const.OPERATION_TYPE_CUSTOM === this.dsRequest.operationType) {
            this.executeCustom(callback);
        } else {
            callback(new Exception("Opertaion type '" + this.dsRequest.operationType + "' is not supported"));
        }
    }

    /**
     * Executes DS request fetch.
     * Should fetch and return records from underlying source.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeFetch(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        return callback(new Exception("Opertaion type '" + this.dsRequest.operationType + "' is not implemented"));
    }

    /**
     * Executes DS request add.
     * Should add specified records to underlying source.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeAdd(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        return callback(new Exception("Opertaion type '" + this.dsRequest.operationType + "' is not implemented"));
    }

    /**
     * Executes DS request remove.
     * Should remove specified records from underlying source.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeRemove(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        return callback(new Exception("Opertaion type '" + this.dsRequest.operationType + "' is not implemented"));
    }

    /**
     * Executes DS request update.
     * Should update specified records in underlying source.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeUpdate(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        return callback(new Exception("Opertaion type '" + this.dsRequest.operationType + "' is not implemented"));
    }

    /**
     * Executes DS request custom.
     * Custom functionality.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeCustom(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        return callback(new Exception("Opertaion type '" + this.dsRequest.operationType + "' is not implemented"));
    }

    /**
     * Commits transaction. Should be overridden if data source uses transactions.
     *
     * @param {function} callback - Callback executed when finished
     */
    commit(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        return callback();
    }

    /**
     * Rolls back transaction. Should be overridden if data source uses transactions.
     *
     * @param {function} callback - Callback executed when finished
     */
    rollback(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        return callback();
    }

    /**
     * Frees resources tied up by this data source.
     *
     * @param {function} callback - Callback executed when finished
     */
    freeResources(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        return callback();
    }

}

/**
 * Ensures that dependencies are loaded correctly.
 * Solves cyclic references loading problem.
 */
const ensureDependencies = function() {
    if (typeof DSRequest !== "function") {
        DSRequest = require("./DSRequest");
    }
};

module.exports = DataSource;
