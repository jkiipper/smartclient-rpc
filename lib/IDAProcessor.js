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

let RPCManager;
let RPCRequest;
let DSRequest;
let BaseResponse;

/**
 * Class for parsing and processing RPC/DS requests.
 */
class IDAProcessor {

    /**
     * Creates IDAProcessor instance.
     *
     * @param {http.ClientRequest} [req] - HTTP request
     * @param {http.ServerResponse} [res] - HTTP reponse
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
        this._log = new Log(IDAProcessor, reqLog);
        this.rpcManager = new RPCManager(req, res);
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
     * <code>true</code> if request is RPC request.
     * Request query has either 'isc_rpc=1' or 'is_isc_rpc=true'.
     *
     * @type {boolean}
     */
    get isRpc() {
        return (Util.concatenate(this.req.query[Const.ISC_RPC]).trim() === "1"
            || /^\s*true\s*$/i.test(this.req.query[Const.IS_ISC_RPC]));
    }

    /**
     * <code>true</code> if request is XMLHttpRequest.
     * Request query has either 'isc_xhr=1' or 'xmlHttp=true'.
     *
     * @type {boolean}
     */
    get isXmlHttp() {
        return (Util.concatenate(this.req.query[Const.ISC_XHR]).trim() === "1"
            || /^\s*true\s*$/i.test(this.req.query[Const.XML_HTTP]));
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
     * <li>executes operations with {link RPCManager#execute}</li>
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
     * Creates RPC/DS operations list.
     *
     * @param {function} callback - Callback executed when finished
     */
    _parseRequest(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        if (!this.isRpc) {
            return callback(new Exception("Non-RPC request"));
        }
        this.transactionNum = this.req.query[Const.ISC_TNUM];
        // Parsing '_transaction' property
        let transaction = this.req.query[Const._TRANSACTION];
        if (!transaction) {
            transaction = this.req.body[Const._TRANSACTION];
        }
        transaction = Util.concatenate(transaction).trim();
        if (transaction.length <= 0) {
            return callback(new Exception(Const.ISC_RESUBMIT));
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
                operation = new DSRequest(this.rpcManager, operation);
            } else {
                if (operation === Const.ISC_NULL) {
                    operation = new RPCRequest(this.rpcManager, null);
                } else if (operation === Const.ISC_EMPTY_STRING) {
                    operation = new RPCRequest(this.rpcManager, "");
                } else {
                    operation = new RPCRequest(this.rpcManager, operation);
                }
            }
            this.operations.push(operation);
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
            const err = responses;
            if (err instanceof Exception && err.message === Const.ISC_RESUBMIT) {
                let logMessage = "Unexpected empty transaction: POST'd data appears to have been removed from the " +
                    "request before the server framework received it. This may be due to application / server settings " +
                    "restricting maximum POST / file upload size, or due to security software on your server, browser or network " +
                    "that erroneously blocked the request. ";
                let html = HTMLUtil.htmlStart;
                html += IDAProcessor.generateDocumentDomain(this.documentDomain);
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
                // Error will be handled as single failed reponse
            }
        }
        if (!Array.isArray(responses)) {
            responses = [responses];
        }
        let dataFormat = Const.DATA_FORMAT_JSON;
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
            html += IDAProcessor.generateIFramePrefix(this.documentDomain, this.jsCallback, this.transactionNum);
            html += Const.STRUCTURED_RPC_START;
            html += HTMLUtil.escapeHtml(JSON.stringify(responses));
            html += Const.STRUCTURED_RPC_END;
            html += IDAProcessor.generateIFramePostfix();
            this.res.set("Content-Type", "text/html;charset=UTF-8");
        }
        // Responses should never be cached
        this.res.set("Cache-Control", "no-cache");
        this.res.set("Pragma", "no-cache");
        this.res.set("Expires", (new Date()).toUTCString());
        return this.res.send(html);
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
        html += IDAProcessor.generateDocumentDomain(documentDomain);
        html += "</HEAD><BODY ONLOAD='var results = document.formResults.results.value;";
        html += IDAProcessor.generateIFrameCallback(jsCallback, transactionNum);
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
    if (typeof RPCManager !== "function") {
        RPCManager = require("./RPCManager");
    }
    if (typeof RPCRequest !== "function") {
        RPCRequest = require("./RPCRequest");
    }
    if (typeof DSRequest !== "function") {
        DSRequest = require("./datasource/DSRequest");
    }
    if (typeof BaseResponse !== "function") {
        BaseResponse = require("./BaseResponse");
    }
};

module.exports = IDAProcessor;
