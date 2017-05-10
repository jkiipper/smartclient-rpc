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
const fs = require('fs');
const path = require("path");
const xml = require('xml2js');

const ResourceFactory = require("srv-core").ResourceFactory;
const Exception = require("srv-core").Exception;
const Config = require("srv-config").Config;
const Log = require("srv-log").Log;
const XMLUtil = require("srv-util").XMLUtil;

const Const = require("../Const");

let DataSource;
let SQLDataSource;
let JSONDataSource;

/**
 * Data source factory.
 */
class DataSourceFactory extends ResourceFactory {

    /**
     * Creates data source factory.
     *
     * @param {string} dbName - Name of data source for which factory is created
     */
    constructor(dsName) {
        ensureDependencies();
        assert.equal(typeof dsName, "string", "argument 'dsName' must be string");
        super();
        this._dsName = dsName;
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
     * Returns <code>Promise</code> which resolves with newly created data source
     * or is rejected with data source creation error.
     *
     * @return {Promise} for creating new resource
     */
    create() {
        const self = this;
        return new Promise(function(resolve, reject) {
            const xmlFileName = path.join(process.cwd(), self._path, self._dsName + Const.XML_DATA_SOURCE_FILE_EXTENTION);
            const jsFileName = path.join(process.cwd(), self._path, self._dsName + Const.JS_DATA_SOURCE_FILE_EXTENTION);
            if (fs.existsSync(xmlFileName)) {
                XMLUtil.readXMLFile(xmlFileName, function(err, config) {
                    if (err) {
                        return reject(new Exception("Failed to read data source '" + self._dsName + "' configuration"), err);
                    }
                    const ds = self._instantiateDataSource(self._dsName, config);
                    if (ds instanceof Error) {
                        return reject(ds);
                    }
                    return resolve(ds);
                });
            } else if (fs.existsSync(jsFileName)) {
                fs.readFile(jsFileName, "utf8", function(err, config) {
                    if (err) {
                        return reject(new Exception("Failed to read data source '" + self._dsName + "' configuration"), err);
                    }
                    config = config.trim();
                    // If file is empty - treat it as empty object
                    if (config === "") {
                        config = "{}";
                    }
                    try {
                        config = JSON.parse(config);
                    } catch(e) {
                        return callback(new Exception("Failed to parse JSON configuration file for data source '" + self._dsName + "'", e));
                    }
                    const ds = self._instantiateDataSource(self._dsName, config);
                    if (ds instanceof Error) {
                        return reject(ds);
                    }
                    return resolve(ds);
                });
            } else {
                reject(new Exception("Configuration for data source '" + self._dsName + "' not found"));
            }
        });
    }

    /**
     * Returns <code>Promise</code> which resolves when data source is destroyed.
     *
     * @param {*} connection - Data source to be destroyed
     * @return {Promise} for destroying specified resource
     */
    destroy(dataSource) {
        return new Promise(function(resolve) {
            resolve();
        });
    }

    /**
     * (Internal) instantiates data source with specified config.
     *
     * @param {string} dsName - Name of data source to instantiate
     * @param {object} config - Data source configuration
     * @return {DataSource|Exception} Instantiated data source or
     *      <code>Exception</code> if instantiation fails (does not throw)
     */
    _instantiateDataSource(dsName, config) {
        if (dsName !== config.ID) {
            return new Exception("Data source name mismatch. Looking for '" + dsName + "', but got '" + config.ID + "'");
        }
        let ds;
        if (config.serverConstructor) {
            try {
                const DSClass = require(path.join(process.cwd(), config.serverConstructor));
                ds = new DSClass(config);
                if (!(ds instanceof DataSource)) {
                    return new Exception("'" + dsName + "' is not instance of DataSource");
                }
                return ds;
            } catch (err) {
                return new Exception("Failed to intantiate data source '" + dsName + "'", err);
            }
        }
        let dsType = config.serverType;
        if (!dsType) {
            dsType = Const.DATA_SOURCE_TYPE_GENERIC;
        }
        if (dsType === Const.DATA_SOURCE_TYPE_SQL) {
            ds = new SQLDataSource(config);
        } else if (dsType === Const.DATA_SOURCE_TYPE_JSON) {
            ds = new JSONDataSource(config);
        } else if (dsType === Const.DATA_SOURCE_TYPE_GENERIC) {
            ds = new DataSource(config);
        }
        if (!ds) {
            return new Exception("Unknown data source type '" + dsType + "'");
        }
        return ds;
    }

}

// Static value for MysqlFactory.log
const _log = new Log(DataSourceFactory);

/**
 * Ensures that dependencies are loaded correctly.
 * Solves cyclic references loading problem.
 */
const ensureDependencies = function() {
    if (typeof DataSource !== "function") {
        DataSource = require("./DataSource");
    }
    if (typeof SQLDataSource !== "function") {
        SQLDataSource = require("./SQLDataSource");
    }
    if (typeof JSONDataSource !== "function") {
        JSONDataSource = require("./JSONDataSource");
    }
};

module.exports = DataSourceFactory;
