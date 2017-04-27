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

const BaseResponse = require("../BaseResponse");
const Const = require("../Const");

/**
 * Response object to be populated by server-side code responding to a DSRequest.
 *
 * @extends BaseResponse
 */
class DSResponse extends BaseResponse {

    /**
     * Creates new instance of DS response.
     *
     * @param {integer} [status=0] - Response status. Defaults to STATUS_SUCCESS (0) if not provided
     * @param {*} data - Response data. If <code>status</code> is not provided and <code>data</code>
     *      is instance of <code>Error</code> status is set to STATUS_FAILURE (-1)
     */
    constructor(status, data) {
        super(status, data);
        this._responseData = {
            [Const.IS_DS_RESPONSE]: true
        };
        this.invalidateCache = false;
        this.startRow = -1;
        this.endRow = -1;
        this.totalRows = -1;
        this.setParameter(Const.ERRORS, {});
    }

    /**
     * Full response data without <code>status</code>, <code>data</code> and <code>queueStatus</code> properties.
     *
     * @type {Object}
     */
    get responseData() {
        return this._responseData;
    }

    /**
     * Returns parameter of response data.
     *
     * @param {string} key - Parameter name
     * @return {*}
     */
    getParameter(key) {
        assert(typeof key, "string", "argument 'key' must be string");
        return this._responseData[key];
    }

    /**
     * Sets parameter of response data.
     * Passing <code>null</code> or <code>undefined</code> removes specified key.
     *
     * @param {string} key - Parameter name
     * @param {*} value - Parameter value
     */
    setParameter(key, value) {
        assert(typeof key, "string", "argument 'key' must be string");
        if (value !== undefined && value !== null) {
            this._responseData[key] = value;
        } else {
            delete this._responseData[key];
        }
    }

    /**
     * <code>true</code> if client cache should be invalidated.
     *
     * @type {boolean}
     */
    get invalidateCache() {
        return this.getParameter(Const.INVALIDATE_CACHE);
    }
    set invalidateCache(invalidateCache) {
        if (invalidateCache === true) {
            this.setParameter(Const.INVALIDATE_CACHE, true);
        } else {
            this.setParameter(Const.INVALIDATE_CACHE, false);
        }
    }

    /**
     * Affected rows.
     *
     * @type {number|null}
     */
    get affectedRows() {
        return this.getParameter(Const.AFFECTED_ROWS);
    }
    set affectedRows(affectedRows) {
        affectedRows = parseInt(affectedRows, 10);
        if (isNaN(affectedRows)) {
            affectedRows = null;
        }
        this.setParameter(Const.AFFECTED_ROWS, affectedRows);
    }

    /**
     * Start row.
     * -1 means undefined.
     *
     * @type {number}
     */
    get startRow() {
        return this.getParameter(Const.START_ROW);
    }
    set startRow(startRow) {
        startRow = parseInt(startRow, 10);
        if (isNaN(startRow)) {
            startRow = -1;
        }
        this.setParameter(Const.START_ROW, startRow);
    }

    /**
     * End row.
     * -1 means undefined.
     *
     * @type {number}
     */
    get endRow() {
        return this.getParameter(Const.END_ROW);
    }
    set endRow(endRow) {
        endRow = parseInt(endRow, 10);
        if (isNaN(endRow)) {
            endRow = -1;
        }
        if (this.startRow > endRow) {
            if (endRow > 0) {
                this.startRow = endRow;
            } else {
                this.startRow = 0;
            }
        }
        this.setParameter(Const.END_ROW, endRow);
    }

    /**
     * Total rows.
     * -1 means undefined.
     *
     * @type {number}
     */
    get totalRows() {
        return this.getParameter(Const.TOTAL_ROWS);
    }
    set totalRows(totalRows) {
        totalRows = parseInt(totalRows, 10);
        if (isNaN(totalRows)) {
            totalRows = -1;
        }
        this.setParameter(Const.TOTAL_ROWS, totalRows);
    }

    /**
     * List of validation errors.
     *
     * @return {Object}
     */
    get errors() {
        return this.getParameter(Const.ERRORS);
    }

    /**
     * Adds validation error for specified field.
     *
     * @param {string} fieldName - Field name
     * @param {string} errorMessage - Error message
     * @param {*} suggestedValue - Suggested value
     */
    addError(fieldName, errorMessage, suggestedValue) {
        assert(typeof fieldName, "string", "argument 'fieldName' must be string");
        assert(typeof errorMessage, "string", "argument 'errorMessage' must be string");
        let fieldErrors = this.errors[fieldName];
        if (!Array.isArray(fieldErrors)) {
            fieldErrors = [];
        }
        const error = {};
        error[Const.ERROR_MESSAGE] = errorMessage;
        if (suggestedValue !== undefined) {
            error[Const.SUGGESTED_VALUE] = suggestedValue;
        }
        fieldErrors.push(error);
        this.errors[fieldName] = fieldErrors;
    }

    /**
     * Creates DS response object representation.
     *
     * @return {object} response representation.
     */
    toObject() {
        const o = super.toObject();
        for(let key in this._responseData) {
            // status, data, queueStatus are already set in super.toObject()
            if (key !== Const.STATUS && key !== Const.DATA && key !== Const.QUEUE_STATUS) {
                // startRow, endRow, totalRows considered unset if their value is less than 0
                // Do not add unset values
                if (key === Const.START_ROW || key === Const.END_ROW || key === Const.TOTAL_ROWS) {
                    if (this._responseData[key] >= 0) {
                        o[key] = this._responseData[key];
                    }
                } else {
                    o[key] = this._responseData[key];
                }
            }
        }
        return o;
    }

}

module.exports = DSResponse;
