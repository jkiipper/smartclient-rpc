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

const Config = require("srv-config").Config;

const BaseResponse = require("./BaseResponse");
const Const = require("./Const");

/**
 * RPCResponse encapsulates data sent from the server to the client in response to an {@link RPCRequest}.
 *
 * @extends BaseResponse
 */
class RPCResponse extends BaseResponse {

    /**
     * Creates new instance of RPC response.
     *
     * @param {integer} [status=0] - Response status. Defaults to STATUS_SUCCESS (0) if not provided
     * @param {*} data - Response data. If <code>status</code> is not provided and <code>data</code>
     *      is instance of <code>Error</code> status is set to STATUS_FAILURE (-1)
     * @param {boolean} sendStacktrace - Should we send stacktrace to client
     */
    constructor(status, data, sendStacktrace) {
        super(status, data);
        if (this.data instanceof Error) {
            this.sendStacktrace = Config.getValue("rpc.exception.stacktrace");
        } else {
            this.sendStacktrace = false;
        }
        // Set sendStacktrace if explicitly provided
        if (sendStacktrace !== undefined && sendStacktrace !== null) {
            this.sendStacktrace = sendStacktrace;
        }
        this.stacktrace = null;
        this.queueStatus = null;
    }

    /**
     * <code>true</code> if stack trace should be sent to client.
     *
     * @type {boolean}
     */
    get sendStacktrace() {
        return this._sendStacktrace;
    }
    set sendStacktrace(sendStacktrace) {
        if (sendStacktrace === true) {
            this._sendStacktrace = true;
        } else {
            this._sendStacktrace = false;
        }
    }

    /**
     * Stack trace.
     * If stack trace is not set and <code>data</code> is instance of <code>Error</code> - returns <code>data.stack</code>.
     *
     * @return {string|null}
     */
    get stacktrace() {
        if (!this._stacktrace) {
            if (this.data instanceof Error) {
                return this.data.stack;
            }
        }
        return this._stacktrace;
    }
    set stacktrace(stacktrace) {
        if (stacktrace) {
            this._stacktrace = stacktrace.toString();
        } else {
            this._stacktrace = null;
        }
    }

    /**
     * Creates RPC response object representation.
     *
     * @return {Object} RPC response representation.
     */
    toObject() {
        const o = super.toObject();
        if (this.sendStacktrace) {
            o[Const.STACKTRACE] = this.stacktrace;
        }
        return o;
    }

}

module.exports = RPCResponse;
