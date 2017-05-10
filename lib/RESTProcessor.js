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
const XMLUtil = require("srv-util").XMLUtil;
const Config = require("srv-config").Config;

const Const = require("./Const");

let RPCManager;
let RESTDSRequest;
let BaseResponse;

/**
 * Class for parsing and processing REST requests.
 */
class RESTProcessor {

    /**
     * Creates REST processor instance.
     *
     * @param {http.ClientRequest} req - HTTP request
     * @param {http.ServerResponse} res - HTTP reponse
     */
    constructor(req, res) {
        ensureDependencies();
        assert.equal(typeof req, "object", "argument 'req' must be object");
        assert.equal(typeof res, "object", "argument 'res' must be object");
        this._req = req;
        this._res = res;
        // Hack for reusing request log
        const reqLog = new Log();
        reqLog._log = req.log;
        this._log = new Log(RESTProcessor, reqLog);
        this.rpcManager = new RPCManager(req, res);
        this._requestParams = null;
        this.jsCallback = "";
        this.transactionNum = null;
        this._operations = [];
        this.dataFormat = Const.DATA_FORMAT_XML;
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
     * RPCManager object.
     *
     * @type {RPCManager}
     */
    get rpcManager() {
        return this._rpcManager;
    }
    set rpcManager(rpcManager) {
        this._rpcManager = rpcManager;
    }

    /**
     * Combined reques query and body params
     *
     * @type {object}
     */
    get requestParams() {
        if (this._requestParams) {
            return this._requestParams;
        };
        const contentType = this.req.headers["content-type"];
        if (typeof contentType !== "string" || contentType.indexOf("application/x-www-form-urlencoded") < 0) {
            // Request body contains message - not params
            // Returning params specified in request query only
            this._requestParams = this.req.query;
            return this._requestParams;
        }
        // Merge query and body params
        this._requestParams = {};
        const queryKeys = Object.keys(this.req.query);
        const bodyKeys = Object.keys(this.req.body);
        const keys = queryKeys.concat(bodyKeys.filter(function(item) {
            return queryKeys.indexOf(item) < 0;
        }));
        for (let i = 0, l = keys.length; i < l; i++) {
            const key = keys[i];
            let qVal = this.req.query[key];
            let bVal = this.req.body[key];
            if (qVal !== undefined && bVal !== undefined) {
                if (Array.isArray(qVal)) {
                    if (Array.isArray(bVal)) {
                        this._requestParams[key] = qVal.concat(bVal);
                    } else {
                        this._requestParams[key] = qVal;
                        this._requestParams[key].push(bVal);
                    }
                } else {
                    if (Array.isArray(bVal)) {
                        this._requestParams[key] = bVal;
                        this._requestParams[key].unshift(qVal);
                    } else {
                        this._requestParams[key] = [qVal, bVal];
                    }
                }
            } else if (qVal !== undefined && bVal === undefined) {
                this._requestParams[key] = qVal;
            } else if (qVal === undefined && bVal !== undefined) {
                this._requestParams[key] = bVal;
            } else {
                this._requestParams[key] = null;
            }
        }
        return this._requestParams;
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
     * JS callback.
     *
     * @type {string}
     */
    get jsCallback() {
        return this._jsCallback;
    }
    set jsCallback(jsCallback) {
        this._jsCallback = Util.concatenate(jsCallback);
    }

    /**
     * List of operations.
     *
     * @type {Array}
     */
    get operations() {
        return this._operations;
    }

    /**
     * Array of HTTP request path parts.
     *
     * @type {string[]}
     */
    get requestPath() {
        if (this.req.params["0"]) {
            let pathParts = this.req.params["0"].split("?");
            pathParts = pathParts.split("/");
            // Remove empty path segments: splitting "some//path"
            // will result in ["some", "", "path"]
            // which is most probably just a mistake creating URL
            pathParts = pathParts.filter(function(e) {
                return e.trim() !== "";
            });
            return pathParts;
        }
        return [];
    }

    /**
     * <code>true</code> if it is a raw REST request.
     *
     * @type {string}
     */
    get rawREST() {
        return this.requestPath.length > 1;
    }

    /**
     * Request data format.
     *
     * @type {string}
     */
    get dataFormat() {
        return this._dataFormat;
    }
    set dataFormat(dataFormat) {
        assert.equal(dataFormat === Const.DATA_FORMAT_JSON ||
            dataFormat === Const.DATA_FORMAT_XML ||
            dataFormat === Const.DATA_FORMAT_CUSTOM, true, "argument 'dataFormat' has unsupported data format");
        this._dataFormat = dataFormat;
    }

    /**
     * Processes HTTP request:
     * <ul>
     * <li>parses HTTP parameters (query/form/body)</li>
     * <li>executes operations</li>
     * <li>sends generated reponses back to client</li>
     * </ul>
     */
    processRequest() {
        const self = this;
        this._parseRequest(function(err) {
            if (err) {
                // Send top level error
                return self._sendResponse(err);
            }
            self.rpcManager.transactionNum = self.transactionNum;
            return self.rpcManager.execute(self.operations, function(err, responses) {
                if (err) {
                    return self._sendResponse(err);
                }
                return self._sendResponse(responses);
            });
        });
    }

    /**
     * Internal method for parsing request parameters.
     * Creates REST-DS operations list.
     *
     * @param {function} callback - Callback executed when finished
     */
    _parseRequest(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        // Parsing '_transaction' property
        let transaction = this.req.query[Const._TRANSACTION];
        if (!transaction) {
            transaction = this.req.body[Const._TRANSACTION];
        }
        transaction = Util.concatenate(transaction).trim();
        if (transaction.length > 0) {
            // Parsing transaction: first try JSON then XML
            try {
                transaction = JSON.parse(transaction);
                return this._finishParsing(transaction, callback);
            } catch (ignored) {
                const self = this;
                xml.parseString(transaction, {
                    explicitRoot: false,
                    explicitArray: false,
                    explicitChildren: true
                }, function(err, transaction) {
                    if (err) {
                        return callback(new Exception("Failed to parse transaction object in '" + Const._TRANSACTION + "' property"));
                    }
                    return self._finishParsing(XMLUtil.normalizeXMLData(transaction), callback);
                });
            }
        } else {
            // If request body contains messge (XML or JSON) - use it as transaction object
            const contentType = this.req.headers["content-type"];
            if (typeof contentType !== "string" || contentType.indexOf("application/x-www-form-urlencoded") < 0) {
                transaction = XMLUtil.normalizeXMLData(this.req.body);
            } else {
                // If request body contains parameters - use empty object as transaction
                // parameters will be added later
                transaction = {};
            }
            return this._finishParsing(transaction, callback);
        }
    }

    /**
     * Internal method to finish request parsing.
     *
     * @param {Object} transaction - Transaction object
     * @param {function} callback - Callback executed when finished
     */
    _finishParsing(transaction, callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        // XML or JSON body can contain transaction
        if (transaction.transaction) {
            transaction = transaction.transaction;
        }
        this.jsCallback = transaction[Const.JSCALLBACK];
        // Overwrite transaction number if present in transaction object
        if (transaction[Const.TRANSACTION_NUM]) {
            this.transactionNum = transaction[Const.TRANSACTION_NUM];
        }
        let ops = transaction[Const.OPERATIONS];
        if (!ops) {
            // Transaction object is a single request
            ops = [];
            ops.push(transaction);
        }
        if (!Array.isArray(ops)) {
            return callback(new Exception("Transaction property '" + Const.OPERATIONS + "' is not list"));
        }
        if (ops.length <= 0) {
            return callback(new Exception("Transaction property '" + Const.OPERATIONS + "' does not contain any operations"));
        }
        // Find request data format
        let dataFormatParamName = Config.getValue("rest.dynamicDataFormatParamName");
        if (!dataFormatParamName) {
            dataFormatParamName = Const.ISC_DATA_FORMAT;
        }
        let reqDataFormat = this.req.query[dataFormatParamName];
        if (!reqDataFormat) {
            reqDataFormat = this.req.body[dataFormatParamName];
        }
        if (reqDataFormat) {
            this.dataFormat = reqDataFormat;
        }
        // Find metedata prefix
        let reqMetaDataPrefix = this.req.query[Const.ISC_META_DATA_PREFIX];
        if (!reqMetaDataPrefix) {
            reqMetaDataPrefix = this.req.body[Const.ISC_META_DATA_PREFIX];
        }
        if (!reqMetaDataPrefix) {
            // Defaults to '_'
            reqMetaDataPrefix = Const.DEFAULT_META_DATA_PREFIX;
        }
        let rawDS = null;
        let rawOpType = null;
        let rawPk = null;
        // Capture RAW request values
        if (this.rawREST) {
            if (this.req.method === "GET") {
                rawOpType = Const.OPERATION_TYPE_FETCH;
            } else if (this.req.method === "POST") {
                rawOpType = Const.OPERATION_TYPE_ADD;
            } else if (this.req.method === "PUT") {
                rawOpType = Const.OPERATION_TYPE_UPDATE;
            } else if (this.req.method === "PATCH") {
                rawOpType = Const.OPERATION_TYPE_UPDATE;
            } else if (this.req.method === "DELETE") {
                rawOpType = Const.OPERATION_TYPE_REMOVE;
            }
            rawDS = this.requestPath[0];
            if (this.requestPath[1] === Const.OPERATION_TYPE_FETCH ||
                this.requestPath[1] === Const.OPERATION_TYPE_ADD ||
                this.requestPath[1] === Const.OPERATION_TYPE_UPDATE ||
                this.requestPath[1] === Const.OPERATION_TYPE_REMOVE ||
                this.requestPath[1] === Const.OPERATION_TYPE_CUSTOM) {
                // Second path segment is an operationType
                rawOpType = this.requestPath[1];
                if (this.requestPath.length > 2) {
                    // Third should be PK
                    rawPk = this.requestPath[2];
                }
            } else {
                // Second path segment is PK
                rawPk = this.requestPath[1];
            }
        }
        this.operations.length = 0;
        for (let i = 0, l = ops.length; i < l; i++) {
            const op = ops[i];
            if (typeof op.data !== "object" || op.data === null) {
                op.data = {};
            }
            const keys = Object.keys(this.requestParams);
            for (let ii = 0, l = keys.length; ii < l; ii++) {
                const key = keys[ii];
                if (key !== Const.ISC_META_DATA_PREFIX && key !== dataFormatParamName) {
                    if (key === Const._CONSTRUCTOR) {
                        if (this.requestParams[key] === Const.ADVANCED_CRITERIA) {
                            op.data[key] = this.requestParams[key];
                        }
                    } else if (key.startsWith(reqMetaDataPrefix)) {
                        try {
                            op[key.slice(reqMetaDataPrefix.length)] = JSON.parse(this.requestParams[key]);
                        } catch (ignored) {
                            op[key.slice(reqMetaDataPrefix.length)] = this.requestParams[key];
                        }
                    } else {
                        try {
                            op.data[key] = JSON.parse(this.requestParams[key]);
                        } catch (ignored) {
                            op.data[key] = this.requestParams[key];
                        }
                    }
                }
            }
            if (!op[Const.OPERATION_CONFIG]) {
                op[Const.OPERATION_CONFIG] = {};
            }
            let opConfig = op[Const.OPERATION_CONFIG];
            if (op[Const.DATA_SOURCE_NAME]) {
                opConfig[Const.DATA_SOURCE_NAME] = op[Const.DATA_SOURCE_NAME];
            }
            if (op[Const.OPERATION_TYPE]) {
                opConfig[Const.OPERATION_TYPE] = op[Const.OPERATION_TYPE];
            }
            if (op[Const.TEXT_MATCH_STYLE]) {
                opConfig[Const.TEXT_MATCH_STYLE] = op[Const.TEXT_MATCH_STYLE];
            }
            if (op[Const.OPERATION]) {
                op[Const.OPERATION] = opConfig[Const.DATA_SOURCE_NAME] + "_" + opConfig[Const.OPERATION_TYPE];
            }
            if (this.rawREST) {
                if (rawDS) {
                    opConfig[Const.DATA_SOURCE_NAME] = rawDS;
                }
                if (rawOpType) {
                    opConfig[Const.OPERATION_TYPE] = rawOpType;
                }
                if (rawPk) {
                    opConfig._rawPk = rawPk;
                }
            }
            this.operations.push(new RESTDSRequest(this.rpcManager, op));
        }
        return callback();
    }

    /**
     * Sends reponse to client.
     *
     * @param {*|Array} responses - Can be either single reponse or Array of reponses or <code>Error</code> instance
     */
    _sendResponse(responses) {
        // Top level error
        if (responses instanceof Error) {
            this.log.error({err: responses}, "Top level error");
        }
        if (!Array.isArray(responses)) {
            responses = [responses];
        }
        // Use first operation in a queue as a base for formatting whole reponse
        let op = this.operations[0];
        let wrapJSONResponses = true;
        let jsonPrefix = Config.getValue("rest.jsonPrefix");
        let jsonSuffix = Config.getValue("rest.jsonSuffix");
        if (op instanceof RESTDSRequest) {
            wrapJSONResponses = op.wrapJSONResponses;
            jsonPrefix = op.jsonPrefix;
            jsonSuffix = op.jsonSuffix;
        }
        for (let i = 0, l = responses.length; i < l; i++) {
            if (!(responses[i] instanceof BaseResponse)) {
                responses[i] = new BaseResponse(responses[i]);
            }
            if (this.dataFormat === Const.DATA_FORMAT_XML || this.dataFormat === Const.DATA_FORMAT_JSON) {
                responses[i] = responses[i].toObject();
            } else {
                responses[i] = responses[i].toString();
            }
        }
        this.log.debug({responses: (responses)}, "Responses");
        let html = "";
        if (this.jsCallback) {
            html += RPCManager.generateIFramePrefix(null, this.jsCallback, this.transactionNum);
        }
        if (wrapJSONResponses && this.dataFormat === Const.DATA_FORMAT_JSON && jsonPrefix) {
            html += jsonPrefix;
        }
        if (this.dataFormat === Const.DATA_FORMAT_XML) {
            html += RPCManager.generateResponseXML(responses);
            this.res.set("Content-Type", "text/xml;charset=UTF-8");
        } else if (this.dataFormat === Const.DATA_FORMAT_JSON) {
            for (let i = 0, l = responses.length; i < l; i++) {
                responses[i] = {[Const.JSON_RESPONSE]: responses[i]};
            }
            if (responses.length > 1) {
                responses = {[Const.JSON_RESPONSES]: responses};
            }
            html += JSON.stringify(responses);
            this.res.set("Content-Type", "application/json;charset=UTF-8");
        } else {
            html += responses.toString();
            this.res.set("Content-Type", "text/plain;charset=UTF-8");
        }
        if (wrapJSONResponses && this.dataFormat === Const.DATA_FORMAT_JSON) {
            if (jsonSuffix) {
                html += jsonSuffix;
            }
            if (jsonPrefix || jsonSuffix) {
                // If we wrap JSON response - overwrite response type: it is not JSON anymore; it is plain text
                this.res.set("Content-Type", "text/plain;charset=UTF-8");
            }
        }
        if (this.jsCallback) {
            html += RPCManager.generateIFramePostfix();
            // For hidden frame - response type is HTML
            this.res.set("Content-Type", "text/html;charset=UTF-8");
        }
        // Responses should never be cached
        this.res.set("Cache-Control", "no-cache");
        this.res.set("Pragma", "no-cache");
        this.res.set("Expires", (new Date()).toUTCString());
        return this.res.send(html);
    }

}

/**
 * Ensures that dependencies are loaded correctly.
 * Solves cyclic references loading problem.
 */
const ensureDependencies = function() {
    if (typeof RPCManager !== "function") {
        RPCManager = require("./RPCManager");
    }
    if (typeof RESTDSRequest !== "function") {
        RESTDSRequest = require("./datasource/RESTDSRequest");
    }
    if (typeof BaseResponse !== "function") {
        BaseResponse = require("./BaseResponse");
    }
};

module.exports = RESTProcessor;
