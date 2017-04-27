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
const Util = require("srv-util").Util;

const Const = require("../Const");

let DataSource;
let DataSourcePool;

/**
 * Class for loading data sources to client side.
 */
class ConfigurationLoader {

    /**
     * Creates loader instance.
     *
     * @param {http.ClientRequest} req - HTTP request
     * @param {http.ServerResponse} res - HTTP reponse
     */
    constructor(req, res) {
        ensureDependencies();
        assert.equal(typeof req, "object", "argument 'req' should be object");
        assert.equal(typeof res, "object", "argument 'res' should be object");
        this._req = req;
        this._res = res;
        // Hack for reusing request log
        const reqLog = new Log();
        reqLog._log = req.log;
        this._log = new Log(ConfigurationLoader, reqLog);
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
     * HTTP request beeing processed.
     *
     * @type {http.ClientRequest}
     */
    get req() {
        return this._req;
    }

    /**
     * HTTP response beeing processed.
     *
     * @type {http.ServerResponse}
     */
    get res() {
        return this._res;
    }

    /**
     * Processes data source loadgin request.
     */
    processRequest() {
        const self = this;
        this.res.set("Content-Type", "application/javascript;charset=UTF-8");
        let ids = this.req.query[Const.DATA_SOURCE_NAME];
        if (!ids) {
            ids = "";
        }
        ids = ids.split(",");
        let realIds = [];
        for (let i = 0, l = ids.length; i < l; i++) {
            if (ids[i]) {
                // Do not load internal
                if (ids[i] !== "$systemSchema") {
                    if (!realIds.includes(ids[i])) {
                        realIds.push(ids[i]);
                    }
                }
            }
        }
        Util.arrayExecutor(realIds, false, function(index, id, cbAcquire) {
            id = id.trim();
            DataSourcePool.acquire(id, function(err, dataSource) {
                if (err) {
                    self.log.error({err: new Exception("Failed to load data source '" + id + "'", err)});
                    return cbAcquire(err);
                }
                return cbAcquire(null, dataSource);
            });
        }, function(err, result) {
            let configs = "";
            for (let i = 0, l = result.length; i < l; i++) {
                if (result[i] instanceof DataSource) {
                    configs += "isc." + "DataSource" + ".create(" + JSON.stringify(result[i].config) + ");\n";
                }
            }
            Util.arrayExecutor(result, false, function(index, dataSource, cbRelease) {
                if (dataSource instanceof DataSource) {
                    return DataSourcePool.release(dataSource.ID, dataSource, cbRelease);
                }
            }, function(err, result) {
                self.res.send(configs);
            });
        });
    }
}

/**
 * Ensures that dependencies are loaded correctly.
 * Solves cyclic references loading problem.
 */
const ensureDependencies = function() {
    if (typeof DataSource !== "function") {
        DataSource = require("./DataSource");
    }
    if (typeof DataSourcePool !== "function") {
        DataSourcePool = require("./DataSourcePool");
    }
};

module.exports = ConfigurationLoader;
