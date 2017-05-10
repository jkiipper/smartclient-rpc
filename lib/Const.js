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

/**
 * Class holds various contants.
 */
class Const {

///////////////////////////////////////////////////////////////////////////////
// Constants used in BaseResponse class.
///////////////////////////////////////////////////////////////////////////////

    /**
     * Property name for data.
     *
     * @type {string}
     */
    static get DATA() {
        return "data";
    }

    /**
     * Property name for status.
     *
     * @type {string}
     */
    static get STATUS() {
        return "status";
    }

    /**
     * Property name for queue status.
     *
     * @type {string}
     */
    static get QUEUE_STATUS() {
        return "queueStatus";
    }

    /**
     * Response status success.
     *
     * @type {number}
     */
    static get STATUS_SUCCESS() {
        return 0;
    }

    /**
     * Response status failure.
     *
     * @type {number}
     */
    static get STATUS_FAILURE() {
        return -1;
    }

    /**
     * Response status validation failure.
     *
     * @type {number}
     */
    static get STATUS_VALIDATION_ERROR() {
        return -4;
    }

    /**
     * Response status failure.
     *
     * @type {number}
     */
    static get STATUS_TRANSACTION_FAILED() {
        return -10;
    }

///////////////////////////////////////////////////////////////////////////////
// Constants used in RPCRequest class.
///////////////////////////////////////////////////////////////////////////////

    /**
     * Property name for server object ID.
     *
     * @type {string}
     */
    static get CLASS_NAME() {
        return "className";
    }

    /**
     * Parameter name for method.
     *
     * @type {string}
     */
    static get METHOD_NAME() {
        return "methodName";
    }

    /**
     * Parameter name for method arguments.
     *
     * @type {string}
     */
    static get ARGUMENTS() {
        return "arguments";
    }

///////////////////////////////////////////////////////////////////////////////
// Constants used in RPCResponse class.
///////////////////////////////////////////////////////////////////////////////

    /**
     * Property name for stacktrace.
     *
     * @type {string}
     */
    static get STACKTRACE() {
        return "stacktrace";
    }

///////////////////////////////////////////////////////////////////////////////
// Constants used in IDAProcessor, RESTProcessor, RPCManager classes.
///////////////////////////////////////////////////////////////////////////////

    /**
     * Parameter name for defining RPC request.
     *
     * @type {string}
     */
    static get ISC_RPC() {
        return "isc_rpc";
    }

    /**
     * Parameter name for defining RPC request - back compat.
     *
     * @type {string}
     */
    static get IS_ISC_RPC() {
        return "is_isc_rpc";
    }

    /**
     * Parameter name for defining XMLHttpRequest.
     *
     * @type {string}
     */
    static get ISC_XHR() {
        return "isc_xhr";
    }

    /**
     * Parameter name for defining XMLHttpRequest - back compat.
     *
     * @type {string}
     */
    static get XML_HTTP() {
        return "xmlHttp";
    }

    /**
     * Parameter name for client version.
     *
     * @type {string}
     */
    static get ISC_V() {
        return "isc_v";
    }

    /**
     * Parameter name for client version - back compat.
     *
     * @type {string}
     */
    static get ISC_CLIENT_VERSION() {
        return "isc_clientVersion";
    }

    /**
     * Parameter name for locale.
     *
     * @type {string}
     */
    static get LOCALE() {
        return "locale";
    }

    /**
     * Parameter name for document domain.
     *
     * @type {string}
     */
    static get ISC_DD() {
        return "isc_dd";
    }

    /**
     * Parameter name for document domain - back compat.
     *
     * @type {string}
     */
    static get DOC_DOMAIN() {
        return "docDomain";
    }

    /**
     * Parameter name for transaction number.
     *
     * @type {string}
     */
    static get ISC_TNUM() {
        return "isc_tnum";
    }

    /**
     * Parameter name for transaction.
     *
     * @type {string}
     */
    static get _TRANSACTION() {
        return "_transaction";
    }

    /**
     * Parameter name for transaction number in transaction object.
     *
     * @type {string}
     */
    static get TRANSACTION_NUM() {
        return "transactionNum";
    }

    /**
     * Parameter name for resubmit request.
     *
     * @type {string}
     */
    static get ISC_RESUBMIT() {
        return "isc_resubmit";
    }

    /**
     * Parameter name for JS callback in transaction object.
     *
     * @type {string}
     */
    static get JSCALLBACK() {
        return "jscallback";
    }

    /**
     * Parameter name for list of operations in transaction object.
     *
     * @type {string}
     */
    static get OPERATIONS() {
        return "operations";
    }

    /**
     * <code>null</copde> value marker.
     *
     * @type {string}
     */
    static get ISC_NULL() {
        return "__ISC_NULL__";
    }

    /**
     * Empty string value marker.
     *
     * @type {string}
     */
    static get ISC_EMPTY_STRING() {
        return "__ISC_EMPTY_STRING__";
    }

    /**
     * Name of JSON data format.
     *
     * @type {string}
     */
    static get DATA_FORMAT_JSON() {
        return "json";
    }

    /**
     * Name of XML data format.
     *
     * @type {string}
     */
    static get DATA_FORMAT_XML() {
        return "xml";
    }

    /**
     * Name of custom data format.
     *
     * @type {string}
     */
    static get DATA_FORMAT_CUSTOM() {
        return "custom";
    }

    /**
     * Text marker for response start.
     *
     * @type {string}
     */
    static get STRUCTURED_RPC_START() {
        return "//isc_RPCResponseStart-->";
    }

    /**
     * Text marker for response start.
     *
     * @type {string}
     */
    static get STRUCTURED_RPC_END() {
        return "//isc_RPCResponseEnd";
    }

    /**
     * Possible value of JS callback.
     *
     * @type {string}
     */
    static get IFRAME_NEW_WINDOW() {
        return "iframeNewWindow";
    }

    /**
     * Possible value of JS callback.
     *
     * @type {string}
     */
    static get IFRAME_RECURSE_UP() {
        return "iframe";
    }

    /**
     * JS callback method name.
     *
     * @type {string}
     */
    static get IFRAME_CALLBACK_METHOD() {
        return "isc.Comm.hiddenFrameReply";
    }

    /**
     * Top element name in JSON response.
     *
     * @type {string}
     */
    static get JSON_RESPONSE() {
        return "response";
    }

    /**
     * Top element name in JSON for multiple responses.
     *
     * @type {string}
     */
    static get JSON_RESPONSES() {
        return "responses";
    }

    /**
     * Top element name in response XML with multiple responses.
     *
     * @type {string}
     */
    static get XML_RESPONSES() {
        return "responses";
    }

    /**
     * Top element name in response XML with single response.
     *
     * @type {string}
     */
    static get XML_RESPONSE() {
        return "response";
    }

///////////////////////////////////////////////////////////////////////////////
// Constants used in DSRequest class.
///////////////////////////////////////////////////////////////////////////////

    /**
     * Parameter name for appID in operation.
     *
     * @type {string}
     */
    static get APP_ID() {
        return "appID";
    }

    /**
     * Name of built-in application.
     *
     * @type {string}
     */
    static get BUILTIN_APPLICATION() {
        return "builtinApplication";
    }

    /**
     * Parameter name for operation name in operation.
     *
     * @type {string}
     */
    static get OPERATION() {
        return "operation";
    }

    /**
     * Parameter name for operation config.
     *
     * @type {string}
     */
    static get OPERATION_CONFIG() {
        return "operationConfig";
    }

    /**
     * Parameter name for data source name.
     *
     * @type {string}
     */
    static get DATA_SOURCE_NAME() {
        return "dataSource";
    }

    /**
     * Parameter name for operation type.
     *
     * @type {string}
     */
    static get OPERATION_TYPE() {
        return "operationType";
    }

    /**
     * Name for fetch operation type.
     *
     * @type {string}
     */
    static get OPERATION_TYPE_FETCH() {
        return "fetch";
    }

    /**
     * Name for add operation type.
     *
     * @type {string}
     */
    static get OPERATION_TYPE_ADD() {
        return "add";
    }

    /**
     * Name for update operation type.
     *
     * @type {string}
     */
    static get OPERATION_TYPE_UPDATE() {
        return "update";
    }

    /**
     * Name for remove operation type.
     *
     * @type {string}
     */
    static get OPERATION_TYPE_REMOVE() {
        return "remove";
    }

    /**
     * Name for custom operation type.
     *
     * @type {string}
     */
    static get OPERATION_TYPE_CUSTOM() {
        return "custom";
    }

    /**
     * Parameter name for operation type.
     *
     * @type {string}
     */
    static get TEXT_MATCH_STYLE() {
        return "textMatchStyle";
    }

    /**
     * Name of text match style - case-insensitive exact match.
     *
     * @type {string}
     */
    static get TEXT_MATCH_STYLE_EXACT() {
        return "exact";
    }

    /**
     * Name of text match style - case-sensitive exact match.
     *
     * @type {string}
     */
    static get TEXT_MATCH_STYLE_EXACT_CASE() {
        return "exactCase";
    }

    /**
     * Name of text match style - case-sensitive substring match.
     *
     * @type {string}
     */
    static get TEXT_MATCH_STYLE_SUBSTRING() {
        return "substring";
    }

    /**
     * Name of text match style - case-sensitive substring match.
     *
     * @type {string}
     */
    static get TEXT_MATCH_STYLE_STARTS_WITH() {
        return "startsWith";
    }

    /**
     * Parameter name for sort by.
     *
     * @type {string}
     */
    static get SORT_BY() {
        return "sortBy";
    }

    /**
     * Parameter name for start row.
     *
     * @type {string}
     */
    static get START_ROW() {
        return "startRow";
    }

    /**
     * Parameter name for end row.
     *
     * @type {string}
     */
    static get END_ROW() {
        return "endRow";
    }

    /**
     * Parameter name for component ID.
     *
     * @type {string}
     */
    static get COMPONENT_ID() {
        return "componentId";
    }

    /**
     * Parameter name for criteria.
     *
     * @type {string}
     */
    static get CRITERIA() {
        return "criteria";
    }

    /**
     * Parameter name for constructor.
     *
     * @type {string}
     */
    static get _CONSTRUCTOR() {
        return "_constructor";
    }

    /**
     * Constructor name for advanced criteria.
     *
     * @type {string}
     */
    static get ADVANCED_CRITERIA() {
        return "AdvancedCriteria";
    }

    /**
     * Parameter name in advanced criteria for strict SQL filtering.
     *
     * @type {string}
     */
    static get STRICT_SQL_FILTERING() {
        return "strictSQLFiltering";
    }

    /**
     * Parameter name for values.
     *
     * @type {string}
     */
    static get VALUES() {
        return "values";
    }

    /**
     * Parameter name for old values.
     *
     * @type {string}
     */
    static get OLD_VALUES() {
        return "oldValues";
    }

///////////////////////////////////////////////////////////////////////////////
// Constants used in RESTDSRequest class.
///////////////////////////////////////////////////////////////////////////////

    /**
     * Data format parameter name.
     *
     * @type {string}
     */
    static get ISC_DATA_FORMAT() {
        return "isc_dataFormat";
    }

    /**
     * Meta data prefix parameter name.
     *
     * @type {string}
     */
    static get ISC_META_DATA_PREFIX() {
        return "isc_metaDataPrefix";
    }

    /**
     * Default meta data prefix.
     *
     * @type {string}
     */
    static get DEFAULT_META_DATA_PREFIX() {
        return "_";
    }

    /**
     * Default JSON wrapper prefix.
     *
     * @type {string}
     */
    static get DEFAULT_JSON_PREFIX() {
        return "<SCRIPT>//'\"]]>>isc_JSONResponseStart>>";
    }

    /**
     * Default JSON wrapper suffix.
     *
     * @type {string}
     */
    static get DEFAULT_JSON_SUFFIX() {
        return "//isc_JSONResponseEnd";
    }

///////////////////////////////////////////////////////////////////////////////
// Constants used in DSResponse class.
///////////////////////////////////////////////////////////////////////////////

    /**
     * Property name for specifying DS response.
     *
     * @type {string}
     */
    static get IS_DS_RESPONSE() {
        return "isDSResponse";
    }

    /**
     * Property name for specifying should cache be invalidated.
     *
     * @type {string}
     */
    static get INVALIDATE_CACHE() {
        return "invalidateCache";
    }

    /**
     * Property name for affected rows.
     *
     * @type {string}
     */
    static get AFFECTED_ROWS() {
        return "affectedRows";
    }

    /**
     * Property name for start row.
     *
     * @type {string}
     */
    static get START_ROW() {
        return "startRow";
    }

    /**
     * Property name for end row.
     *
     * @type {string}
     */
    static get END_ROW() {
        return "endRow";
    }

    /**
     * Property name for total rows.
     *
     * @type {string}
     */
    static get TOTAL_ROWS() {
        return "totalRows";
    }

    /**
     * Property name for validation errors.
     *
     * @type {string}
     */
    static get ERRORS() {
        return "errors";
    }

    /**
     * Property name for validation error message.
     *
     * @type {string}
     */
    static get ERROR_MESSAGE() {
        return "errorMessage";
    }

    /**
     * Property name for validation error suggested value.
     *
     * @type {string}
     */
    static get SUGGESTED_VALUE() {
        return "suggestedValue";
    }

///////////////////////////////////////////////////////////////////////////////
// Constants used in DataSourceFactory class.
///////////////////////////////////////////////////////////////////////////////

    /**
     * File extention for data source XML configuration files.
     *
     * @type {string}
     */
    static get XML_DATA_SOURCE_FILE_EXTENTION() {
        return ".ds.xml";
    }

    /**
     * File extention for data source JSON configuration files.
     *
     * @type {string}
     */
    static get JS_DATA_SOURCE_FILE_EXTENTION() {
        return ".ds.js";
    }

    /**
     * Data source server type for generic data sources.
     *
     * @type {string}
     */
    static get DATA_SOURCE_TYPE_GENERIC() {
        return "generic";
    }

    /**
     * Data source server type for sql data sources.
     *
     * @type {string}
     */
    static get DATA_SOURCE_TYPE_SQL() {
        return "sql";
    }

    /**
     * Data source server type for JSON file data sources.
     *
     * @type {string}
     */
    static get DATA_SOURCE_TYPE_JSON() {
        return "json";
    }

///////////////////////////////////////////////////////////////////////////////
// Constants used in DataSource class.
///////////////////////////////////////////////////////////////////////////////

    /**
     * Operator name in advenced criteria - not.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT() {
        return "not";
    }

    /**
     * Operator name in advenced criteria - or.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_OR() {
        return "or";
    }

    /**
     * Operator name in advenced criteria - and.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_AND() {
        return "and";
    }

    /**
     * Operator name in advenced criteria - regexp.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_REGEXP() {
        return "regexp";
    }

    /**
     * Operator name in advenced criteria - iregexp.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_IREGEXP() {
        return "iregexp";
    }

    /**
     * Operator name in advenced criteria - equals.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_EQUALS() {
        return "equals";
    }

    /**
     * Operator name in advenced criteria - notEqual.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_EQUAL() {
        return "notEqual";
    }

    /**
     * Operator name in advenced criteria - greaterThan.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_GREATER_THAN() {
        return "greaterThan";
    }

    /**
     * Operator name in advenced criteria - lessThan.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_LESS_THAN() {
        return "lessThan";
    }

    /**
     * Operator name in advenced criteria - greaterOrEqual.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_GREATER_OR_EQUAL() {
        return "greaterOrEqual";
    }

    /**
     * Operator name in advenced criteria - lessOrEqual.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_LESS_OR_EQUAL() {
        return "lessOrEqual";
    }

    /**
     * Operator name in advenced criteria - between.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_BETWEEN() {
        return "between";
    }

    /**
     * Operator name in advenced criteria - betweenInclusive.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_BETWEEN_INCLUSIVE() {
        return "betweenInclusive";
    }

    /**
     * Operator name in advenced criteria - iBetween.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_BETWEEN() {
        return "iBetween";
    }

    /**
     * Operator name in advenced criteria - iBetweenInclusive.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_BETWEEN_INCLUSIVE() {
        return "iBetweenInclusive";
    }

    /**
     * Operator name in advenced criteria - iEquals.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_EQUALS() {
        return "iEquals";
    }

    /**
     * Operator name in advenced criteria - iNotEqual.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_EQUAL() {
        return "iNotEqual";
    }

    /**
     * Operator name in advenced criteria - contains.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_CONTAINS() {
        return "contains";
    }

    /**
     * Operator name in advenced criteria - startsWith.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_STARTS_WITH() {
        return "startsWith";
    }

    /**
     * Operator name in advenced criteria - endsWith.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_ENDS_WITH() {
        return "endsWith";
    }

    /**
     * Operator name in advenced criteria - iContains.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_CONTAINS() {
        return "iContains";
    }

    /**
     * Operator name in advenced criteria - iStartsWith.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_STARTS_WITH() {
        return "iStartsWith";
    }

    /**
     * Operator name in advenced criteria - iEndsWith.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_ENDS_WITH() {
        return "iEndsWith";
    }

    /**
     * Operator name in advenced criteria - notContains.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_CONTAINS() {
        return "notContains";
    }

    /**
     * Operator name in advenced criteria - notStartsWith.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_STARTS_WITH() {
        return "notStartsWith";
    }

    /**
     * Operator name in advenced criteria - notEndsWith.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_ENDS_WITH() {
        return "notEndsWith";
    }

    /**
     * Operator name in advenced criteria - iNotContains.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_CONTAINS() {
        return "iNotContains";
    }

    /**
     * Operator name in advenced criteria - iNotStartsWith.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_STARTS_WITH() {
        return "iNotStartsWith";
    }

    /**
     * Operator name in advenced criteria - iNotEndsWith.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_ENDS_WITH() {
        return "iNotEndsWith";
    }

    /**
     * Operator name in advenced criteria - matchesPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_MATCHES_PATTERN() {
        return "matchesPattern";
    }

    /**
     * Operator name in advenced criteria - iMatchesPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_MATCHES_PATTERN() {
        return "iMatchesPattern";
    }

    /**
     * Operator name in advenced criteria - containsPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_CONTAINS_PATTERN() {
        return "containsPattern";
    }

    /**
     * Operator name in advenced criteria - startsWithPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_STARTS_WITH_PATTERN() {
        return "startsWithPattern";
    }

    /**
     * Operator name in advenced criteria - endsWithPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_ENDS_WITH_PATTERN() {
        return "endsWithPattern";
    }

    /**
     * Operator name in advenced criteria - iContainsPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_CONTAINS_PATTERN() {
        return "iContainsPattern";
    }

    /**
     * Operator name in advenced criteria - iStartsWithPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_STARTS_WITH_PATTERN() {
        return "iStartsWithPattern";
    }

    /**
     * Operator name in advenced criteria - iEndsWithPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_ENDS_WITH_PATTERN() {
        return "iEndsWithPattern";
    }

    /**
     * Operator name in advenced criteria - notContainsPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_CONTAINS_PATTERN() {
        return "notContainsPattern";
    }

    /**
     * Operator name in advenced criteria - notStartsWithPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_STARTS_WITH_PATTERN() {
        return "notStartsWithPattern";
    }

    /**
     * Operator name in advenced criteria - notEndsWithPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_ENDS_WITH_PATTERN() {
        return "notEndsWithPattern";
    }

    /**
     * Operator name in advenced criteria - iNotContainsPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_CONTAINS_PATTERN() {
        return "iNotContainsPattern";
    }

    /**
     * Operator name in advenced criteria - iNotStartsWithPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_STARTS_WITH_PATTERN() {
        return "iNotStartsWithPattern";
    }

    /**
     * Operator name in advenced criteria - iNotEndsWithPattern.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_ENDS_WITH_PATTERN() {
        return "iNotEndsWithPattern";
    }

    /**
     * Operator name in advenced criteria - isBlank.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_IS_BLANK() {
        return "isBlank";
    }

    /**
     * Operator name in advenced criteria - notBlank.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_BLANK() {
        return "notBlank";
    }

    /**
     * Operator name in advenced criteria - isNull.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_IS_NULL() {
        return "isNull";
    }

    /**
     * Operator name in advenced criteria - notNull.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_NULL() {
        return "notNull";
    }

    /**
     * Operator name in advenced criteria - inSet.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_IN_SET() {
        return "inSet";
    }

    /**
     * Operator name in advenced criteria - notInSet.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_IN_SET() {
        return "notInSet";
    }

    /**
     * Operator name in advenced criteria - equalsField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_EQUALS_FIELD() {
        return "equalsField";
    }

    /**
     * Operator name in advenced criteria - notEqualField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_EQUAL_FIELD() {
        return "notEqualField";
    }

    /**
     * Operator name in advenced criteria - iEqualsField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_EQUALS_FIELD() {
        return "iEqualsField";
    }

    /**
     * Operator name in advenced criteria - iNotEqualField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_EQUAL_FIELD() {
        return "iNotEqualField";
    }

    /**
     * Operator name in advenced criteria - greaterThanField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_GREATER_THAN_FIELD() {
        return "greaterThanField";
    }

    /**
     * Operator name in advenced criteria - lessThanField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_LESS_THAN_FIELD() {
        return "lessThanField";
    }

    /**
     * Operator name in advenced criteria - greaterOrEqualField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_GREATER_OR_EQUAL_FIELD() {
        return "greaterOrEqualField";
    }

    /**
     * Operator name in advenced criteria - lessOrEqualField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_LESS_OR_EQUAL_FIELD() {
        return "lessOrEqualField";
    }

    /**
     * Operator name in advenced criteria - containsField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_CONTAINS_FIELD() {
        return "containsField";
    }

    /**
     * Operator name in advenced criteria - startsWithField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_STARTS_WITH_FIELD() {
        return "startsWithField";
    }

    /**
     * Operator name in advenced criteria - endsWithField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_ENDS_WITH_FIELD() {
        return "endsWithField";
    }

    /**
     * Operator name in advenced criteria - iContainsField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_CONTAINS_FIELD() {
        return "iContainsField";
    }

    /**
     * Operator name in advenced criteria - iStartsWithField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_STARTS_WITH_FIELD() {
        return "iStartsWithField";
    }

    /**
     * Operator name in advenced criteria - iEndsWithField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_ENDS_WITH_FIELD() {
        return "iEndsWithField";
    }

    /**
     * Operator name in advenced criteria - notContainsField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_CONTAINS_FIELD() {
        return "notContainsField";
    }

    /**
     * Operator name in advenced criteria - notStartsWithField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_STARTS_WITH_FIELD() {
        return "notStartsWithField";
    }

    /**
     * Operator name in advenced criteria - notEndsWithField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_NOT_ENDS_WITH_FIELD() {
        return "notEndsWithField";
    }

    /**
     * Operator name in advenced criteria - iNotContainsField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_CONTAINS_FIELD() {
        return "iNotContainsField";
    }

    /**
     * Operator name in advenced criteria - iNotStartsWithField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_STARTS_WITH_FIELD() {
        return "iNotStartsWithField";
    }

    /**
     * Operator name in advenced criteria - iNotEndsWithField.
     *
     * @type {string}
     */
    static get CRITERIA_OPERATOR_I_NOT_ENDS_WITH_FIELD() {
        return "iNotEndsWithField";
    }

///////////////////////////////////////////////////////////////////////////////
// Constants used in SQLDataSource class.
///////////////////////////////////////////////////////////////////////////////

    /**
     * Escape character used in SQL for 'like' operator.
     *
     * @type {string}
     */
    static get ESCAPE_CHARACTER() {
        return "~";
    }

}

module.exports = Const;
