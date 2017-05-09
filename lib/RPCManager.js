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
const xml = require("xml2js");

const Exception = require("srv-core").Exception;
const Log = require("srv-log").Log;
const Util = require("srv-util").Util;
const HTMLUtil = require("srv-util").HTMLUtil;
const XMLUtil = require("srv-util").XMLUtil;

const Const = require("./Const");

let BaseRequest;
let RPCRequest;
let DSRequest;
let RESTDSRequest;
let BaseResponse;
let RPCResponse;
let DSResponse;

/**
 * Class for handling RPC/DS requests.
 */
class RPCManager {

    /**
     * Creates RPC manager instance.
     *
     * @param {http.ClientRequest} [req] - HTTP request
     * @param {http.ServerResponse} [res] - HTTP reponse
     */
    constructor(req, res) {
        ensureDependencies();
        if (!req && !res) {
            this._req = req;
            this._res = res;
            this._log = new Log(RPCManager);
        } else {
            assert.equal(typeof req, "object", "argument 'req' must be object");
            assert.equal(typeof res, "object", "argument 'res' must be object");
            this._req = req;
            this._res = res;
            // Hack for reusing request log
            const reqLog = new Log();
            reqLog._log = req.log;
            this._log = new Log(RPCManager, reqLog);
        }
        this.transactionNum = null;
        this._operations = [];
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
     * Transaction number.
     *
     * @type {number|null}
     */
    get transactionNum() {
        return this._transactionNum;
    }
    set transactionNum(transactionNumber) {
        this._transactionNum = parseInt(transactionNumber, 10);
        if (isNaN(this._transactionNum)) {
            this._transactionNum = null;
        }
    }

    /**
     * List of operations.
     *
     * @type {Array}
     * @throws {Exception} If operations contains not {link BaseRequest}.
     */
    get operations() {
        return this._operations;
    }
    set operations(operations) {
        assert.equal(Array.isArray(operations), true, "argument 'operations' must be array");
        for (let i = 0, l = operations.length; i < l; i++) {
            if (!(operations[i] instanceof BaseRequest)) {
                throw new Exception("Operation is not instance of BaseRequest");
            }
        }
        this._operations = operations;
    }

    /**
     * Executes specified operation(s).
     *
     * @param {BaseRequest|Array} [operations] - Operations to execute
     * @param {function} callback - Callback executed when finished
     */
    execute(operations, callback) {
        if (!callback) {
            // Single parameter provided - callback
            callback = operations;
            operations = null;
        }
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        if (operations) {
            if (!Array.isArray(operations)) {
                // Put single operation to array
                operations = [operations];
            }
            assert.equal(Array.isArray(operations), true, "argument 'operations' must be array");
            try {
                this.operations = operations;
            } catch (err) {
                return callback(err);
            }
        }
        if (this.operations.length <= 0) {
            return callback(new Exception("Empty operation list"));
        }
        if (this.log.isDebugEnabled) {
            const debugOp = [];
            for (let i = 0, l = this.operations.length; i < l; i++) {
                debugOp.push(this.operations[i].toObject());
            }
            this.log.debug({operations: debugOp}, "Executing operations");
        }
        const self = this;
        const responses = [];
        this._initRequests(function(err) {
            if (err) {
                // Failed to initialize operations - free resources and return top level error
                return self._freeResources(function() {
                    // Return top level error
                    callback(err);
                });
            }
            self._executeRequests(function(err, results) {
                if (err) {
                    // Should never occur because _executeRequests() always returns results array with
                    // execution result for every request execution
                    return self._freeResources(function() {
                        callback(err);
                    });
                }
                for (let i = 0, l = results.length; i < l; i++) {
                    // operations and results arrays are in sync
                    if (results[i] instanceof Error) {
                        if (self.operations[i] instanceof DSRequest) {
                            responses.push(new DSResponse(results[i]));
                        } else {
                            responses.push(new RPCResponse(results[i]));
                        }
                    } else {
                        if (self.operations[i] instanceof DSRequest) {
                            if (results[i] instanceof DSResponse) {
                                responses.push(results[i]);
                            } else {
                                responses.push(new DSResponse(results[i]));
                            }
                        } else {
                            if (results[i] instanceof RPCResponse) {
                                responses.push(results[i]);
                            } else {
                                responses.push(new RPCResponse(results[i]));
                            }
                        }
                    }
                }
                return self._freeResources(function() {
                    // Free resources and send responses
                    callback(null, responses);
                });
            });
        });
    }

    /**
     * Internal method for operations initialization.
     * Stops initialization on first error.
     * On error callback will receive single error for failure.
     *
     * @param {function} callback - Callback executed when finished
     */
    _initRequests(callback) {
        // Stop execution on first error
        Util.arrayExecutor(this.operations, true, function(index, op, cb) {
            if (op instanceof BaseRequest) {
                return op.init(cb);
            }
            cb(new Exception("Operation is not instance of BaseRequest"));
        }, function(err, result) {
            if (result[result.length - 1] instanceof Error) {
                return callback(new Exception("Failed to initialize request", result[result.length - 1]));
            }
            return callback();
        });
    }

    /**
     * Internal method for operations execution.
     *
     * @param {function} callback - Callback executed when finished
     */
    _executeRequests(callback) {
        // Execute all operations regardless of failures
        Util.arrayExecutor(this.operations, false, function(index, op, cb) {
            if (op instanceof BaseRequest) {
                return op.execute(cb);
            }
            cb(new Exception("Operation is not instance of BaseRequest"));
        }, function(err, result) {
            return callback(null, result);
        });
    }

    /**
     * Internal method for freeing operations resources.
     * 
     * @param {function} callback - Callback executed when finished
     */
    _freeResources(callback) {
        const self = this;
        // Free resources of all operations regardless of failures
        Util.arrayExecutor(this.operations, false, function(index, op, cb) {
            if (op instanceof BaseRequest) {
                return op.freeResources(function(err) {
                    if (err) {
                        // Log failure to free resources
                        self.log.error({err: new Exception("Failed to free resources", err)});
                    }
                    return cb(err);
                });
            }
            return cb();
        }, function(err, result) {
            return callback(null, result);
        });
    }

    /**
     * Generates XML for provided responses.
     * If there is more than one response - all responses are enclosed into <code>&lt;responses&gt;</code> tag.
     *
     * @param {Array|*} responses - Responses for XML generation
     * @return {string} Generated XML with responses
     */
    static generateResponseXML(responses) {
        if (!Array.isArray(responses)) {
            responses = [responses];
        }
        var builder = new xml.Builder({
            rootName: Const.XML_RESPONSE,
            headless: true
        });
        let xmlString = "<?xml version=\"1.0\"?>\n";
        if (responses.length > 1) {
            xmlString += "<" + Const.XML_RESPONSES + ">\n";
        }
        for (let i = 0, l = responses.length; i < l; i++) {
            xmlString += builder.buildObject(responses[i]) + "\n";
        }
        if (responses.length > 1) {
            xmlString += "</" + Const.XML_RESPONSES + ">\n";
        }
        return xmlString;
    }

}

/**
 * Ensures that dependencies are loaded correctly.
 * Solves cyclic references loading problem.
 */
const ensureDependencies = function() {
    if (typeof BaseRequest !== "function") {
        BaseRequest = require("./BaseRequest");
    }
    if (typeof RPCRequest !== "function") {
        RPCRequest = require("./RPCRequest");
    }
    if (typeof DSRequest !== "function") {
        DSRequest = require("./datasource/DSRequest");
    }
    if (typeof RESTDSRequest !== "function") {
        RESTDSRequest = require("./datasource/RESTDSRequest");
    }
    if (typeof BaseResponse !== "function") {
        BaseResponse = require("./BaseResponse");
    }
    if (typeof RPCResponse !== "function") {
        RPCResponse = require("./RPCResponse");
    }
    if (typeof DSResponse !== "function") {
        DSResponse = require("./datasource/DSResponse");
    }
};

module.exports = RPCManager;
