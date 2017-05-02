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
        this._rest = false;
        this.jsCallback = "";
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
     * Is REST request beeing processed.
     *
     * @type {boolean}
     */
    get rest() {
        return this._rest;
    }
    set rest(rest) {
        if (rest) {
            this._rest = true;
        } else {
            this._rest = false;
        }
    }

    /**
     * <code>true</code> if request is RPC request.
     * Request query has either 'isc_rpc=1' or 'is_isc_rpc=true'.
     *
     * @type {boolean}
     */
    get isRpc() {
        const iscRPC = Util.concatenate(this.req.query[Const.ISC_RPC]);
        const isIscRPC = Util.concatenate(this.req.query[Const.IS_ISC_RPC]);
        return (iscRPC === "1" || isIscRPC === "true");
    }

    /**
     * <code>true</code> if request is XMLHttpRequest.
     * Request query has either 'isc_xhr=1' or 'xmlHttp=true'.
     *
     * @type {boolean}
     */
    get isXmlHttp() {
        const iscXHR = Util.concatenate(this.req.query[Const.ISC_XHR]);
        const xmlHTTP = Util.concatenate(this.req.query[Const.XML_HTTP]);
        return (iscXHR === "1" || xmlHTTP === "true");
    }

    /**
     * Client version.
     *
     * @type {string|null}
     */
    get clientVersion() {
        let version = Util.concatenate(this.req.query[Const.ISC_V]);
        if (version) {
            return version;
        }
        version = Util.concatenate(this.req.query[Const.ISC_CLIENT_VERSION]);
        if (version) {
            return version;
        }
        return null;
    }

    /**
     * Request locale.
     *
     * @type {string}
     */
    get locale() {
        let locale = this.req.query[Const.LOCALE];
        if (!locale) {
            locale = this.req.body[Const.LOCALE];
        }
        return Util.concatenate(locale);
    }

    /**
     * Document domain.
     *
     * @type {string|null}
     */
    get documentDomain() {
        let domain = Util.concatenate(this.req.query[Const.ISC_DD]);
        if (domain) {
            return domain;
        }
        domain = Util.concatenate(this.req.query[Const.DOC_DOMAIN]);
        if (domain) {
            return domain;
        }
        return null;
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
                return self.sendResponse(err);
            }
            return self._executeOperations(function(err, responses) {
                if (err) {
                    return self.sendResponse(err);
                } else {
                    self.sendResponse(responses);
                }
            });
        });
    }

    /**
     * Sends reponse to client.
     *
     * @param {*|Array} responses - Can be either single reponse or Array of reponses or <code>Error</code> instance
     */
    sendResponse(responses) {
        // Top level error
        if (responses instanceof Error) {
            const err = responses;
            if (err instanceof Exception && err.message === Const.ISC_RESUBMIT) {
                let logMessage = "Unexpected empty RPCManager transaction: POST'd data appears to have been removed from the " +
                    "request before the server framework received it. This may be due to application / server settings " +
                    "restricting maximum POST / file upload size, or due to security software on your server, browser or network " +
                    "that erroneously blocked the request. ";
                let html = HTMLUtil.htmlStart;
                html += RPCManager.generateDocumentDomain(this.documentDomain);
                html += "<script>";
                const iscResubmit = Util.concatenate(this.req.query[Const.ISC_RESUBMIT]);
                if (this.isXmlHttp || iscResubmit === "1") {
                    logMessage += "Please see the documentation for isc.RPCResponse.STATUS_MAX_POST_SIZE_EXCEEDED";
                    html += "parent.isc.RPCManager.handleMaxPostSizeExceeded(window.name);";
                } else {
                    // req.error can be set by upload middleware if failed parsing uploaded files
                    if (this.req.error) {
                        this.log.warn({err: this.req.error}, "Transaction " + this.transactionNum + " aborted.");
                        html += "parent.isc.RPCManager.handleRequestAborted(" + this.transactionNum + ");";
                    } else {
                        logMessage += "Attempting to ask browser to retry transaction " + this.transactionNum + ".";
                        html += "parent.isc.RPCManager.retryOperation(window.name);";
                    }
                }
                html += "</script>";
                html += HTMLUtil.htmlEnd;
                this.log.warn(logMessage);
                this.res.type('html');
                return this.res.send(html);
            } else {
                this.log.error({err: err}, "Top level error");
                // Redirect only if it is not RPC call:
                // redirect to error page does not work in XMLHttpRequest;
                // redirecting response in hidden frame does not make sense.
                // TODO: Possible solution for hiddenFram transport:
                // set window.location.href
                if (!this.isRpc && !this.isXmlHttp) {
                    this.req.session.error = Exception.errSerializer(err);
                    return this.res.redirect(Const.ERROR_PAGE);
                }
                // Without redirection - error will be handled as single failed reponse
            }
        }
        if (!Array.isArray(responses)) {
            responses = [responses];
        }
        let dataFormat = Const.DATA_FORMAT_JSON;
        // <REST>
        let jsonPrefix;
        let jsonSuffix;
        // Use first operation in a queue as a base for formatting whole reponse
        let op = this.operations[0];
        if (op instanceof RESTDSRequest) {
            dataFormat = op.dataFormat;
            jsonPrefix = op.jsonPrefix;
            jsonSuffix = op.jsonSuffix;
        }
        // </REST>
        for (let i = 0, l = responses.length; i < l; i++) {
            if (!(responses[i] instanceof BaseResponse)) {
                responses[i] = new BaseResponse(responses[i]);
            }
            if (dataFormat === Const.DATA_FORMAT_XML || dataFormat === Const.DATA_FORMAT_JSON) {
                responses[i] = responses[i].toObject();
            } else {
                responses[i] = responses[i].toString();
            }
        }
        this.log.debug({responses: (responses)}, "Responses");
        let html = "";
        if (this.isRpc) {
            if (this.isXmlHttp) {
                html += Const.STRUCTURED_RPC_START;
                if (dataFormat === Const.DATA_FORMAT_XML) {
                    html += RPCManager.generateResponseXML(responses);
                } else if (dataFormat === Const.DATA_FORMAT_JSON) {
                    html += JSON.stringify(responses);
                } else {
                    html += responses.toString();
                }
                html += Const.STRUCTURED_RPC_END;
                this.res.set("Content-Type", "text/plain;charset=UTF-8");
            } else {
                html += RPCManager.generateIFramePrefix(this.documentDomain, this.jsCallback, this.transactionNum);
                html += Const.STRUCTURED_RPC_START;
                html += HTMLUtil.escapeHtml(JSON.stringify(responses));
                html += Const.STRUCTURED_RPC_END;
                html += RPCManager.generateIFramePostfix();
                this.res.set("Content-Type", "text/html;charset=UTF-8");
            }
        } else if (this.rest) {
            // <REST>
            if (this.jsCallback) {
                html += RPCManager.generateIFramePrefix(this.documentDomain, this.jsCallback, this.transactionNum);
            }
            if (!this.isXmlHttp && dataFormat === Const.DATA_FORMAT_JSON) {
                if (jsonPrefix) {
                    html += jsonPrefix;
                }
            }
            if (dataFormat === Const.DATA_FORMAT_XML) {
                html += RPCManager.generateResponseXML(responses);
                this.res.set("Content-Type", "text/xml;charset=UTF-8");
            } else if (dataFormat === Const.DATA_FORMAT_JSON) {
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
            if (!this.isXmlHttp && dataFormat === Const.DATA_FORMAT_JSON) {
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
            // </REST>
        }
        // Responses should never be cached
        this.res.set("Cache-Control", "no-cache");
        this.res.set("Pragma", "no-cache");
        this.res.set("Expires", (new Date()).toUTCString());
        return this.res.send(html);
    }

    /**
     * Internal method for parsing request parameters.
     * Creates RPC/DS operations list.
     *
     * @param {function} callback - Callback executed when finished
     */
    _parseRequest(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        this.transactionNum = this.req.query[Const.ISC_TNUM];
        // Parsing '_transaction' property
        let transaction = this.req.query[Const._TRANSACTION];
        if (!transaction) {
            transaction = this.req.body[Const._TRANSACTION];
        }
        transaction = Util.concatenate(transaction).trim();
        if (transaction.length <= 0) {
            if (this.isRpc) {
                // Signal caller to handle 'client must resubmit' state
                return callback(new Exception(Const.ISC_RESUBMIT));
            } else if (this.rest) {
                // REST calls does not require _transaction property.
                // Continue without parsing
                return this._finishParsing("", callback);
            } else {
                return callback(new Exception("Transaction is empty in '" + Const._TRANSACTION + "' property"));
            }
        }
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
    }

    /**
     * Internal method to finish request parsing.
     *
     * @param {Object} transaction - Transaction object
     * @param {function} callback - Callback executed when finished
     */
    _finishParsing(transaction, callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        this.jsCallback = transaction[Const.JSCALLBACK];
        // Overwrite transaction number if present in transaction object
        if (transaction[Const.TRANSACTION_NUM]) {
            this.transactionNum = transaction[Const.TRANSACTION_NUM];
        }
        let ops = transaction[Const.OPERATIONS];
        // <REST>
        if (!ops && this.rest) {
            ops = this.req.query[Const.OPERATIONS];
            if (typeof ops === "object") {
                if (typeof ops[Const.REQUEST] === "object") {
                    ops = ops[Const.REQUEST];
                }
            } else {
                ops = [];
                ops.push(transaction);
            }
        }
        // </REST>
        if (!Array.isArray(ops)) {
            return callback(new Exception("Transaction property '" + Const.OPERATIONS + "' is not list"));
        }
        if (ops.length <= 0) {
            return callback(new Exception("Transaction property '" + Const.OPERATIONS + "' does not contain any operations"));
        }
        this.operations.length = 0;
        for (let i = 0, l = ops.length; i < l; i++) {
            let operation = ops[i];
            if (typeof operation === "object" && operation[Const.APP_ID] && operation[Const.OPERATION] || this.rest) {
                if (this.rest) {
                    operation = new RESTDSRequest(this, operation);
                } else {
                    operation = new DSRequest(this, operation);
                }
            } else {
                if (operation === Const.ISC_NULL) {
                    operation = new RPCRequest(this, null);
                } else if (operation === Const.ISC_EMPTY_STRING) {
                    operation = new RPCRequest(this, "");
                } else {
                    operation = new RPCRequest(this, operation);
                }
            }
            this.operations.push(operation);
        }
        return callback();
    }

    /**
     * (Internal) executes operations in queue.
     *
     * @param {function} callback - Callback executed when finished
     */
    _executeOperations(callback) {
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
     * Executes specified operation(s).
     *
     * @param {BaseRequest|Array} operations - Operations to execute
     * @param {function} callback - Callback executed when finished
     */
    static execute(operations, callback) {
        if (!operations) {
            return callback(new Exception("Empty operation list"));
        }
        if (!Array.isArray(operations)) {
            operations = [operations];
        }
        const rpc = new RPCManager();
        rpc.operations.length = 0;
        for (let i = 0, l = operations.length; i < l; i++) {
            let operation = operations[i];
            if (operation instanceof BaseRequest) {
                operation.rpcManager = rpc;
                rpc.operations.push(operation);
            } else {
                return callback(new Exception("Operation is not instance of BaseRequest"));
            }
        }
        return rpc._executeOperations(callback);
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

    /**
     * Generates HTML script tag for setting document domain.
     * Returns empty string if passed document domain is not a <code>string</code> or empty string.
     *
     * @param {string} documentDomain - Document domain
     * @return {string} Generated script tag for document domain
     */
    static generateDocumentDomain(documentDomain) {
        if (typeof documentDomain === "string" && documentDomain.trim() !== "") {
            return "<script>document.domain = '" + documentDomain + "';</script>\n";
        }
        return "";
    }

    /**
     * Generates JS callback script.
     *
     * @param {string} jsCallback - Type of JS callback to generate
     * @param {number} transactionNum - Transaction number
     * @return {string} JS callback script
     */
    static generateIFrameCallback(jsCallback, transactionNum) {
        assert.equal(typeof jsCallback, "string", "argument 'jsCallback' must be string");
        assert.equal(typeof transactionNum, "number", "argument 'transactionNum' must be number");
        if (Const.IFRAME_NEW_WINDOW === jsCallback) {
            return "window.opener.parent." + Const.IFRAME_CALLBACK_METHOD + "(" + transactionNum + ",results,window)";
        }
        if (Const.IFRAME_RECURSE_UP === jsCallback) {
            return "if (!(new RegExp(\"^(\\\\d{1,3}\\\\.){3}\\\\d{1,3}$\").test(document.domain))) {" +
                "while (!window.isc && document.domain.indexOf(\".\") != -1 ) { " +
                "try { parent.isc; break;} catch (e) {" +
                "document.domain = document.domain.replace(/.*?\\./, \"\");}" +
                "}" +
                "}" +
                "parent." + Const.IFRAME_CALLBACK_METHOD + "(" + transactionNum + ",results)";
        }
        return jsCallback;
    }

    /**
     * Generates HTML prefix for hidden frame.
     *
     * @param {string} documentDomain - Document domain
     * @param {string} jsCallback - Type of JS callback to generate
     * @param {number} transactionNum - Transaction number
     * @return {string} HTML prefix for hidden frame
     */
    static generateIFramePrefix(documentDomain, jsCallback, transactionNum) {
        let html = "<HTML><HEAD>\n";
        html += RPCManager.generateDocumentDomain(documentDomain);
        html += "</HEAD><BODY ONLOAD='var results = document.formResults.results.value;";
        html += RPCManager.generateIFrameCallback(jsCallback, transactionNum);
        html += "'>";
        html += "<BR><BR><BR><BR><BR><BR><BR><BR><BR><BR><BR><BR><BR><BR><BR><BR><BR><BR>";
        html += "<FORM name='formResults'><TEXTAREA readonly name='results'>\n";
        return html;
    }

    /**
     * Generates HTML postfix for hidden frame.
     *
     * @return {string} HTML postfix for hidden frame
     */
    static generateIFramePostfix() {
        let html = "</TEXTAREA>";
        html += "</FORM>\n";
        html += "</BODY></HTML>";
        return html;
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
