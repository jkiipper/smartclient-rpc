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

const Log = require("srv-log").Log;

const DSRequest = require("./DSRequest");
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
        // Find request data format
        let reqDataFormat = this.rpcManager.req.query[Const.ISC_DATA_FORMAT];
        if (!reqDataFormat) {
            reqDataFormat = this.rpcManager.req.body[Const.ISC_DATA_FORMAT];
        }
        if (!reqDataFormat) {
            // Defaults to JSON
            reqDataFormat = Const.DATA_FORMAT_JSON;
        }
        this.dataFormat = reqDataFormat;
        let reqMetaDataPrefix = this.rpcManager.req.query[Const.ISC_META_DATA_PREFIX];
        if (!reqMetaDataPrefix) {
            reqMetaDataPrefix = this.rpcManager.req.body[Const.ISC_META_DATA_PREFIX];
        }
        if (!reqMetaDataPrefix) {
            // Defaults to JSON
            reqMetaDataPrefix = Const.DEFAULT_META_DATA_PREFIX;
        }
        this.jsonPrefix = Const.DEFAULT_JSON_PREFIX;
        this.jsonSuffix = Const.DEFAULT_JSON_SUFFIX;
    }

    /**
     * Class logger.
     *
     * @type {Log}
     */
    get log() {
        return _log;
    }

    /**
     * Request data format.
     *
     * @return {string}
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
     * Prefix to wrap JSON responses.
     *
     * @return {string}
     */
    get jsonPrefix() {
        return this._jsonPrefix;
    }
    set jsonPrefix(jsonPrefix) {
        assert.equal(typeof jsonPrefix, "string", "argument 'jsonPrefix' must be string");
        this._jsonPrefix = jsonPrefix;
    }

    /**
     * Suffix to wrap JSON responses.
     *
     * @return {string}
     */
    get jsonSuffix() {
        return this._jsonSuffix;
    }
    set jsonSuffix(jsonSuffix) {
        assert.equal(typeof jsonSuffix, "string", "argument 'jsonSuffix' must be string");
        this._jsonSuffix = jsonSuffix;
    }

}

module.exports = RESTDSRequest;
