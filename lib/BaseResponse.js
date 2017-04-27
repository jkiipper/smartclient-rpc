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

const Const = require("./Const");

/**
 * Base reponse for all responses going through the RPC and DataSource layer in Smartclient Server.
 */
class BaseResponse {

    /**
     * Creates new instance of base response.
     *
     * @param {number} status=0 - Response status. Defaults to STATUS_SUCCESS (0) if not provided.
     * @param {*} data - Response data. If <code>status</code> is not provided and <code>data</code>
     *      is instance of <code>Error</code> status is set to STATUS_FAILURE (-1)
     */
    constructor(status, data) {
        if (data === undefined) {
            // Constructor with data only
            data = status;
            status = null;
        }
        this.data = data;
        if (this.data instanceof Error) {
            this.status = Const.STATUS_FAILURE;
        } else {
            this.status = Const.STATUS_SUCCESS;
        }
        // If status is explicitly set - use it
        if (typeof status === "number") {
            this.status = Math.floor(status);
        }
        this.queueStatus = null;
    }

    /**
     * Response data.
     *
     * @type {*}
     */
    get data() {
        return this._data;
    }
    set data(data) {
        if (data === undefined) {
            this._data = null;
        } else {
            this._data = data;
        }
    }

    /**
     * Response status.
     *
     * @type {number}
     */
    get status() {
        return this._status;
    }
    set status(status) {
        assert.equal(typeof status, "number", "Parameter 'status' must be number");
        this._status = Math.floor(status);
    }

    /**
     * Queue status.
     *
     * @type {number|null}
     */
    get queueStatus() {
        return this._queueStatus;
    }
    set queueStatus(queueStatus) {
        assert.equal(queueStatus === null || typeof queueStatus === "number", true, "Parameter 'queueStatus' must be number or null");
        if (queueStatus) {
            this._queueStatus = Math.floor(queueStatus);
        } else {
            this._queueStatus = null;
        }
    }

    /**
     * Creates response object representation.
     * Should be overridden in sub-class to represent actual class.
     *
     * @return {Object} response representation.
     */
    toObject() {
        const o = {};
        if (this.data instanceof Error) {
            o[Const.DATA] = this.data.message;
        } else {
            o[Const.DATA] = this.data;
        }
        o[Const.STATUS] = this.status;
        // Include only if set
        if (this.queueStatus) {
            o[Const.QUEUE_STATUS] = this.queueStatus;
        }
        return o;
    }

    toString() {
        return JSON.stringify(this.toObject());
    }

}

module.exports = BaseResponse;
