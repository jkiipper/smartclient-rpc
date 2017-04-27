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

const BaseRequest = require("./BaseRequest");
const Const = require("./Const");

let RPCResponse;

/**
 * Represents RPC request.
 * TODO: implement method arguments
 *
 * @extends BaseRequest
 */
class RPCRequest extends BaseRequest {

    /**
     * Creates instance of RPC request.
     *
     * @param {RPCManager} rpcManager - RPC manager instance
     * @param {*} data - Request data
     */
    constructor(rpcManager, data) {
        ensureDependencies();
        super(rpcManager);
        // Use logger from RPCManager (which uses request logger)
        this._log = new Log(RPCRequest, this.rpcManager.log);
        this.data = data;
        this.serverObject = null;
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
     * Request data.
     *
     * @type {*}
     */
    get data() {
        return this._data;
    }
    set data(data) {
        this._data = data;
    }

    /**
     * Server object ID or module name.
     *
     * @type {string|null}
     */
    get serverObjectID() {
        if (this.data !== null && typeof this.data === "object") {
            return this.data[Const.CLASS_NAME];
        }
        return null;
    }

    /**
     * Method name.
     *
     * @type {string|null}
     */
    get methodName() {
        if (this.data !== null && typeof this.data === "object") {
            return this.data[Const.METHOD_NAME];
        }
        return null;
    }

    /**
     * Method arguments.
     *
     * @type {string|null}
     */
    get methodArguments() {
        if (this.data !== null && typeof this.data === "object") {
            return this.data[Const.ARGUMENTS];
        }
        return null;
    }

    /**
     * Actual server object.
     *
     * @type {object|null}
     */
    get serverObject() {
        return this._serverObject;
    }
    set serverObject(serverObject) {
        if (serverObject !== null) {
            assert.equal(typeof serverObject, "object", "argument 'serverObject' must be an instance of some class");
            this._serverObject = serverObject;
        } else {
            this._serverObject = null;
        }
    }

    /**
     * Loads and instantiates server object.
     * If loaded server obejct has function 'init' - call it with following parameters:
     * <ul>
     * <li>this - {@link RPCRequest}</li>
     * <li>callback - to signal execution finish</li>
     * </ul>
     * This method will be called from {@link RPCManager}.
     *
     * @param {function} callback - Callback executed when finished
     */
    init(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        const self = this;
        this.loadServerObject(function(err, instance) {
            if (err) {
                return callback(new Exception("Error occured while loading server object", err));
            }
            self.serverObject = instance;
            if (self.serverObject) {
                if (typeof self.serverObject.init === "function") {
                    return self.serverObject.init(self, callback);
                }
            }
            return callback();
        });
    }

    /**
     * If server objects has function 'startTransaction' - call it with following parameters:
     * <ul>
     * <li>this - {@link RPCRequest}</li>
     * <li>callback - to signal execution finish</li>
     * </ul>
     *
     * @param {function} callback - Callback executed when finished
     */
    startTransaction(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        if (this.serverObject) {
            if (typeof this.serverObject.startTransaction === "function") {
                return this.serverObject.startTransaction(this, callback);
            }
        }
        return callback();
    }

    /**
     * Executes RPC request.
     * <ul>
     * <li>If <code>methodName</code> is specified and exists - call it.</li>
     * <li>If <code>methodName</code> is specified but does not exist - callback with error.</li>
     * <li>If <code>methodName</code> is not specified - try calling <code>execute</code>.</li>
     * </ul>
     * All calls with following parameters:
     * <ul>
     * <li>this - {@link RPCRequest}</li>
     * <li>callback - to signal execution finish</li>
     * </ul>
     * This method will be called from {@link RPCManager}.
     * TODO: implement method arguments
     *
     * @param {function} callback - Callback executed when finished
     */
    execute(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        if (this.serverObject) {
            const self = this;
            this.startTransaction(function(err) {
                if (err) {
                    // Instead of returning plain error - return RPC response with failure
                    return callback(null, new RPCResponse(new Exception("Failed to start transaction", err)));
                }
                // Execute requested method
                // TODO: implement method arguments
                if (self.methodName) {
                    if (typeof self.serverObject[self.methodName] === "function") {
                        return self.serverObject[self.methodName](self, function(err, response) {
                            self._executeFinish(err, response, callback);
                        });
                    } else {
                        return callback(new Exception("Server object '" + self.serverObjectID +
                            "' does not have method '" + self.methodName + "'"));
                    }
                } else {
                    if (typeof self.serverObject.execute === "function") {
                        return self.serverObject.execute(self, function(err, response) {
                            self._executeFinish(err, response, callback);
                        });
                    } else {
                        // If method name is not specified and execute method does not exist - return request data
                        return callback(null, new RPCResponse(Const.STATUS_SUCCESS, self.data));
                    }
                }
            });
        } else {
            // If server object is missing - return request data
            return callback(null, new RPCResponse(Const.STATUS_SUCCESS, this.data));
        }
    }

    /**
     * Internal method to complete execution.
     * <ul>
     * <li>If <code>err<code> is set - rollback transaction.</li>
     * <li>If execution was ok - commit.</li>
     * <li>If commit fails - change response status to STATUS_TRANSACTION_FAILED (-10) and rollback.</li>
     * </ul>
     *
     * @param {*} err - Error from execution
     * @param {*} response - Response from execution
     * @param {function} callback - Callback executed when finished
     */
    _executeFinish(err, response, callback) {
        const self = this;
        if (err) {
            // Got an execution error - rollback
            this.rollback(function(errRollback) {
                if (errRollback) {
                    // Failed to rollback - log it and continue
                    self.log.error(new Exception("Failed to rollback", errRollback));
                }
                // Instead of returning plain execution error - return RPC response with failure
                if (err instanceof Exception) {
                    return callback(null, new RPCResponse(err));
                } else {
                    // Wrap error into Exception
                    return callback(null, new RPCResponse(new Exception("Execution failure", err)));
                }
            });
        } else {
            // Execution success
            if (!(response instanceof RPCResponse)) {
                // Wrap response into RPCResponse
                response = new RPCResponse(Const.STATUS_SUCCESS, response);
            }
            this.commit(function(errCommit) {
                if (errCommit) {
                    // Failed to commit - log it, set status to transaction failed and rollback
                    self.log.error(new Exception("Failed to commit", errCommit));
                    response.status = Const.STATUS_TRANSACTION_FAILED;
                    self.rollback(function(errRollback) {
                        if (errRollback) {
                            // Failed to rollback - log it and continue
                            self.log.error(new Exception("Failed to rollback", errRollback));
                        }
                        // Return response
                        return callback(null, response);
                    });
                } else {
                    // Return response
                    return callback(null, response);
                }
            });
        }
    }

    /**
     * If server objects has function 'commit' - call it with following parameters:
     * <ul>
     * <li>this - {@link RPCRequest}</li>
     * <li>callback - to signal execution finish</li>
     * </ul>
     *
     * @param {function} callback - Callback executed when finished
     */
    commit(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        if (this.serverObject) {
            if (typeof this.serverObject.commit === "function") {
                return this.serverObject.commit(this, callback);
            }
        }
        return callback();
    }

    /**
     * If server objects has function 'rollback' - call it with following parameters:
     * <ul>
     * <li>this - {@link RPCRequest}</li>
     * <li>callback - to signal execution finish</li>
     * </ul>
     *
     * @param {function} callback - Callback executed when finished
     */
    rollback(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        if (this.serverObject) {
            if (typeof this.serverObject.rollback === "function") {
                return this.serverObject.rollback(this, callback);
            }
        }
        return callback();
    }

    /**
     * If server objects has function 'freeResources' - call it with following parameters:
     * <ul>
     * <li>this - {@link RPCRequest}</li>
     * <li>callback - to signal execution finish</li>
     * </ul>
     * This method will be called from {@link RPCManager}.
     *
     * @param {function} callback - Callback executed when finished
     */
    freeResources(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        if (this.serverObject) {
            if (typeof this.serverObject.freeResources === "function") {
                return this.serverObject.freeResources(this, callback);
            }
        }
        return callback();
    }

    /**
     * Loads and instantiates server object specified in RPC request.
     * Server object should be a class.
     * Object will be instantiated with 'new' with 'this' ({@link RPCRequest}) as parameter.
     *
     * @param {function} callback - Callback executed when finished
     */
    loadServerObject(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        if (!this.serverObjectID) {
            return callback();
        }
        try {
            const ServerObjectClass = require(process.cwd() + this.serverObjectID);
            if (typeof ServerObjectClass === "function") {
                const instance = new ServerObjectClass(this);
                return callback(null, instance);
            }
            return callback(new Exception("Server object '" + this.serverObjectID + "' is not a class"));
        } catch (err) {
            return callback(new Exception("Failed to load server object '" + this.serverObjectID + "'", err));
        }
    }

    /**
     * Creates RPC request object representation.
     *
     * @return {Object} RPC request representation
     */
    toObject() {
        const o = super.toObject();
        if (this.data instanceof Error) {
            o.data = this.data.message;
        } else {
            o.data = this.data;
        }
        if (this.serverObjectID) {
            o.serverObjectID = this.serverObjectID;
        }
        if (this.methodName) {
            o.methodName = this.methodName;
        }
        if (this.methodArguments) {
            o.methodArguments = this.methodArguments;
        }
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
    if (typeof RPCResponse !== "function") {
        RPCResponse = require("./RPCResponse");
    }
};

module.exports = RPCRequest;
