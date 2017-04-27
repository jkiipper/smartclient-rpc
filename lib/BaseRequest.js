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

let RPCManager;

/**
 * This is the base for all requests going through the RPC and DataSource layer in Smartclient Server.
 */
class BaseRequest {

    /**
     * Creates instance of base request.
     *
     * @param {RPCManager} rpcManager - RPC manager instance
     */
    constructor(rpcManager) {
        ensureDependencies();
        this.rpcManager = rpcManager;
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
        assert.equal(rpcManager instanceof RPCManager, true, "Parameter 'rpcManager' must be instance of RPCManager");
        this._rpcManager = rpcManager;
    }

    /**
     * Instantiates request object.
     *
     * @param {function} callback - Callback executed when finished
     */
    init(callback) {
        assert.equal(typeof callback, "function", "Parameter 'callback' must be function");
        return callback();
    }

    /**
     * Executes request.
     *
     * @param {function} callback - Callback executed when finished
     */
    execute(callback) {
        assert.equal(typeof callback, "function", "Parameter 'callback' must be function");
        return callback();
    }

    /**
     * Frees request resources.
     * Should be overridden in sub-class if there are resources have to be released.
     *
     * @param {function} callback - Callback executed when finished
     */
    freeResources(callback) {
        assert.equal(typeof callback, "function", "Parameter 'callback' must be function");
        return callback();
    }

    /**
     * Returns simple object with serialized fields.
     * Should be overridden in sub-class to represent actual class.
     *
     * @return {Object} Serialized object
     */
    toObject() {
        const o = {};
        return o;
    }

    /**
     * Returns string representing this object.
     *
     * @return {string}
     */
    toString() {
        return JSON.stringify(this.toObject());
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
};

module.exports = BaseRequest;
