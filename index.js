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

const Init = require("./lib/Init");
const Const = require("./lib/Const");
const BaseRequest = require("./lib/BaseRequest");
const BaseResponse = require("./lib/BaseResponse");
const RPCRequest = require("./lib/RPCRequest");
const RPCResponse = require("./lib/RPCResponse");
const RPCManager = require("./lib/RPCManager");
const DSRequest = require("./lib/datasource/DSRequest");
const DSResponse = require("./lib/datasource/DSResponse");
const DataSource = require("./lib/datasource/DataSource");
const DataSourceFactory = require("./lib/datasource/DataSourceFactory");
const DataSourcePool = require("./lib/datasource/DataSourcePool");
const JSONDataSource = require("./lib/datasource/JSONDataSource");
const RESTDSRequest = require("./lib/datasource/RESTDSRequest");
const SQLDataSource = require("./lib/datasource/SQLDataSource");
const ConnectionPool = require("./lib/db/ConnectionPool");
const MysqlFactory = require("./lib/db/MysqlFactory");
const PostgreSQLFactory = require("./lib/db/PostgreSQLFactory");
const DataSourceLoader = require("./lib/router/DataSourceLoader");
const IDACall = require("./lib/router/IDACall");
const RESTCall = require("./lib/router/RESTCall");

module.exports = {
    Init: Init,
    Const: Const,
    BaseRequest: BaseRequest,
    BaseResponse: BaseResponse,
    RPCRequest: RPCRequest,
    RPCResponse: RPCResponse,
    RPCManager: RPCManager,
    DSRequest: DSRequest,
    DSResponse: DSResponse,
    DataSource: DataSource,
    DataSourceFactory: DataSourceFactory,
    DataSourcePool: DataSourcePool,
    JSONDataSource: JSONDataSource,
    RESTDSRequest: RESTDSRequest,
    SQLDataSource: SQLDataSource,
    ConnectionPool: ConnectionPool,
    MysqlFactory: MysqlFactory,
    PostgreSQLFactory: PostgreSQLFactory,
    DataSourceLoader: DataSourceLoader,
    IDACall: IDACall,
    RESTCall: RESTCall
};
