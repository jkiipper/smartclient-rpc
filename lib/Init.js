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
const path = require("path");

const Exception = require("srv-core").Exception;
const Config = require("srv-config").Config;
const Log = require("srv-log").Log;

// Static value for Init.initialized
let _initialized = false;

/**
 * Class for Smartclient server side initialization.
 */
class Init {

    /**
     * Returns true if system is initialized already.
     *
     * @type {boolean}
     */
    static get initialized() {
        return _initialized;
    }

    /**
     * Initializes system environment:
     * <ul>
     * <li>reads configuration</li>
     * <li>initializes logging system</li>
     * <li>sets <code>uncaughtException</code> handler</li>
     * </ul>
     *
     * @param {function} callback - Callback executed when finished
     */
    static go(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be function");
        if (Init.initialized) {
            return callback();
        }
        Config.initGlobalConfig(true, function(err) {
            if (err) {
                return callback(new Exception("Failed to initialize global config", err));
            }
            // Initialize global logger with configuration values
            Log.setDefaultConfig(Config.getValue("logging"));
            // Set uncaught exception handler
            process.on("uncaughtException", function(err) {
                Log.logger.fatal({err: err}, "Uncaught exception");
                process.exit(-1);
            });
            return callback();
        });
    }

}

module.exports = Init;
