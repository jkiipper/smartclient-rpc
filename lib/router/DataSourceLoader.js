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

const Middleware = require("srv-core").Middleware;
const Config = require("srv-config").Config;

const ConfigurationLoader = require("../datasource/ConfigurationLoader");

/**
 * Route for loading data sources.
 *
 * @extends Middleware
 */
class DataSourceLoader extends Middleware {

    /**
     * Creates data source loader middleware instance.
     * Uses <code>server.router.dataSourceLoader.path</code> configuration parameter as path for data source loader (relative to <code>basePath</code>).
     *
     * @param {function} app - Express application
     * @param {function} router - Express router to attach to
     */
    constructor(app, router) {
        super(app, router);
        this._dataSourceLoaderPath = Config.getValue("server.router.dataSourceLoader.path");
        assert.equal(typeof this._dataSourceLoaderPath, "string", "Route data source loader should be a string");
    }

    /**
     * Binds this middleware to router
     */
    bindToRouter() {
        this.router.all(this._dataSourceLoaderPath, function(req, res) {
            req.log.debug({
                params: req.params,
                query: req.query,
                body: req.body,
                files: req.files,
                rawBody: (req.rawBody)?req.rawBody.toString():""
            }, "Request");
            process.nextTick(function() {
                const loader = new ConfigurationLoader(req, res);
                loader.processRequest();
            });
        });
    }

}

module.exports = DataSourceLoader;
