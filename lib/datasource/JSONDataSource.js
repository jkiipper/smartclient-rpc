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
const fs = require("fs");
const path = require("path");

const Exception = require("srv-core").Exception;
const Config = require("srv-config").Config;
const Log = require("srv-log").Log;
const Util = require("srv-util").Util;

const DataSource = require("./DataSource");
const Const = require("../Const");

let BaseRequest;
let DSRequest;
let DSResponse;

/**
 * Data source for accessing data in JSON file.
 * Saves data in JSON file.
 * Does not support paging, sorting, filteing.
 */
class JSONDataSource extends DataSource {

    /**
     * Creates JSON data source instance.
     *
     * @param {Object} config - Data source configuration
     * @returns {JSONDataSource} JSON data source instance
     */
    constructor(config) {
        ensureDependencies();
        super(config);
        let dataSourceConfig = Config.getValue("dataSource");
        if (!dataSourceConfig) {
            throw new Exception("Section 'dataSource' is not defined in configuration");
        }
        this._path = dataSourceConfig.path;
        if (!this._path) {
            this._path = "";
        }
    }

    // Class logger
    get log() {
        return _log;
    }

    /**
     * File name for data.
     * Relative to data source path.
     *
     * @type {string}
     */
    get fileName() {
        const fileName = this._config.fileName;
        if (!fileName) {
            fileName = "";
        }
        return fileName;
    }
    set fileName(fileName) {
        assert.equal(typeof fileName, "string", "argument 'fileName' must be string");
        this._config.fileName = fileName;
    }

    /**
     * Executes DS request fetch.
     * Always returns all data.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeFetch(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        const self = this;
        this._readFile(function(err, data) {
            if (err) {
                return callback(err);
            }
            const response = new DSResponse(Const.STATUS_SUCCESS, self.toRecords(data));
            response.startRow = 0;
            response.endRow = data.length;
            response.totalRows = data.length;
            return callback(null, response);
        });
    }

    /**
     * Executes DS request add.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeAdd(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        const self = this;
        this._readFile(function(err, data) {
            if (err) {
                return callback(err);
            }
            data.push(self.toRecords(self.dsRequest.values));
            self._writeFile(data, function(err) {
                if (err) {
                    return callback(err);
                }
                const response = new DSResponse(Const.STATUS_SUCCESS, data[data.length -1]);
                return callback(null, response);
            });
        });
    }

    /**
     * Executes DS request remove.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeRemove(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        const self = this;
        this._readFile(function(err, data) {
            if (err) {
                return callback(err);
            }
            let pkValue = self.getPKValue(self.dsRequest.criteria);
            let foundRow = -1;
            for (let i = 0, l = data.length; i < l; i++) {
                try {
                    assert.deepEqual(pkValue, self.getPKValue(data[i]));
                    foundRow = i;
                    break;
                } catch (ignored) {}
            }
            if (foundRow < 0) {
                return callback(new Error("Remove failed. Row does not exists. PK=" + JSON.stringify(pkValue)));
            }
            data.splice(foundRow, 1);
            self._writeFile(data, function(err) {
                if (err) {
                    return callback(err);
                }
                const response = new DSResponse(Const.STATUS_SUCCESS, pkValue);
                return callback(null, response);
            });
        });
    }

    /**
     * Executes DS request update.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeUpdate(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        const self = this;
        this._readFile(function(err, data) {
            if (err) {
                return callback(err);
            }
            let pkValue = self.getPKValue(self.dsRequest.criteria);
            let foundRow = -1;
            for (let i = 0, l = data.length; i < l; i++) {
                try {
                    assert.deepEqual(pkValue, self.getPKValue(data[i]));
                    foundRow = i;
                    break;
                } catch (ignored) {}
            }
            if (foundRow < 0) {
                return callback(new Error("Update failed. Row does not exists. PK=" + JSON.stringify(pkValue)));
            }
            let updateValue = self.getNonPKValue(self.dsRequest.values);
            const keys = Object.keys(updateValue);
            for (let i = 0, l = keys.length; i < l; i++) {
                const key = keys[i];
                data[foundRow][key] = updateValue[key];
            }
            self._writeFile(data, function(err) {
                if (err) {
                    return callback(err);
                }
                const response = new DSResponse(Const.STATUS_SUCCESS, self.toRecords(data[foundRow]));
                return callback(null, response);
            });
        });
    }

    /**
     * Reads data file, parses it and returns array of objects to callback.
     *
     * @param {function} callback - Callback executed when finished
     */
    _readFile(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        const fileName = path.join(process.cwd(), this._path, this.fileName);
        fs.readFile(fileName, "utf8", function(err, data) {
            if (err) {
                if (err.code !== "ENOENT") {
                    return callback(new Exception("Error reading file '" + fileName + "'", err));
                }
                // If file does not exists - return empty array
                data = "[]";
            }
            data = data.trim();
            // If file is empty - treat it as empty array
            if (data === "") {
                data = "[]";
            }
            try {
                data = JSON.parse(data);
            } catch(e) {
                return callback(new Exception("Failed to parse JSON data from file '" + fileName + "'", e));
            }
            // If contains only a single object - put it into array
            if (!Array.isArray(data)) {
                data = [data];
            }
            return callback(null, data);
        });
    }

    /**
     * Writes data file.
     *
     * @param {Array} data - Data to be written
     * @param {function} callback - Callback executed when finished
     */
    _writeFile(data, callback) {
        assert.equal(Array.isArray(data), true, "argument 'data' must be array");
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        const fileName = path.join(process.cwd(), this._path, this.fileName);
        try {
            data = JSON.stringify(data, null, 4);
        } catch (err) {
            return callback(new Exception("Error converting object to JSON string", err));
        }
        fs.writeFile(fileName, data, "utf8", function(err) {
            if (err) {
                return callback(new Exception("Error writing file '" + fileName + "'", err));
            }
            return callback();
        });
    }

}

// Static value for JSONDataSource.log
const _log = new Log(JSONDataSource);

/**
 * Ensures that dependencies are loaded correctly.
 * Solves cyclic references loading problem.
 */
const ensureDependencies = function() {
    if (typeof BaseRequest !== "function") {
        BaseRequest = require("../BaseRequest");
    }
    if (typeof DSRequest !== "function") {
        DSRequest = require("./DSRequest");
    }
    if (typeof DSResponse !== "function") {
        DSResponse = require("./DSResponse");
    }
};

module.exports = JSONDataSource;
