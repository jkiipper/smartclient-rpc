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
const knex = require("knex");

const Exception = require("srv-core").Exception;
const Config = require("srv-config").Config;
const Log = require("srv-log").Log;
const Util = require("srv-util").Util;

const DataSource = require("./DataSource");
const Const = require("../Const");
const ConnectionPool = require("../db/ConnectionPool");

let BaseRequest;
let DSRequest;
let DSResponse;

/**
 * Data source for accessing data on SQL servers.
 */
class SQLDataSource extends DataSource {

    /**
     * Creates SQL data source instance.
     *
     * @param {Object} config - Data source configuration
     * @returns {SQLDataSource} SQL data source instance
     */
    constructor(config) {
        ensureDependencies();
        super(config);
        this._connection = null;
        this._queryBuilder = null;
    }

    /**
     * Name of data base configuration beeing used for this data source.
     * If not defined - default configuration will be used.
     *
     * @type {string}
     */
    get dbName() {
        return this.config.dbName;
    }
    set dbName(dbName) {
        assert.equal(typeof dbName, "string", "argument 'dbName' must be string");
        this.config.dbName = dbName;
    }

    /**
     * Name of table in database.
     *
     * @type {string}
     */
    get tableName() {
        if (this.config.tableName) {
            return this.config.tableName;
        }
        return this.ID;
    }
    set tableName(tableName) {
        assert.equal(typeof tableName, "string", "argument 'tableName' must be string");
        this._config.tableName = tableName;
    }

    /**
     * Data base connection.
     *
     * @type {function}
     */
    get connection() {
        return this._connection;
    }
    set connection(connection) {
        assert.equal(typeof connection, "object", "argument 'connection' must be object");
        this._connection = connection;
    }

    /**
     * Returns SQL column name for specified data source field.
     * SQL column name can be specified in </code>nativeName</code> property of field definition.
     * If </code>nativeName</code> is not specified - field </code>name</code> is returned.
     *
     * @param {type} name - Data source field name
     * @return {string} SQL column name or <code>null</code> if such field is not defined
     */
    getSQLColumn(name) {
        const field = this.getField(name);
        if (field) {
            if (field.nativeName) {
                return field.nativeName;
            }
            return field.name;
        }
        return null;
    }

    /**
     * Returns array of SQL columns for specified data source fields.
     * If field has specified native name then SQL column is in form 'nativeName as fieldName'.
     *
     * @param {Array} fields - Data source fields for which SQL columns should be created
     * @return {string[]} SQL columns for specified data source fields
     */
    getSQLColumns(fields) {
        assert.equal(Array.isArray(fields), true, "argument 'fields' must be Array");
        const columns = [];
        for (let i = 0, l = fields.length; i < l; i++) {
            columns.push(this.getSQLColumn(fields[i].name) + " as " + fields[i].name);
        }
        return columns;
    }

    /**
     * Returns object with SQL columns as properties instead of data source field names.
     *
     * @param {object} value - Data source record
     * @return {object} Object with SQL columns as properties
     */
    getSQLValue(value) {
        assert.equal(typeof value, "object", "argument 'value' must be object");
        const sqlValue = {};
        for (let key in value) {
            const column = this.getSQLColumn(key);
            if (column) {
                sqlValue[column] = value[key];
            }
        }
        return sqlValue;
    }

    /**
     * Escapes SQL wild card characters ('_' and '%') with specified character in provided value.
     *
     * @param {*} value - (Converted to string) for escaping
     * @param {string} escapeChar - Escape character
     * @return {string} Escaped value
     */
    escapeSQLLikeValue(value, escapeChar) {
        if (value === undefined || value === null) {
            return "";
        }
        value = "" + value;
        value = value.replace(new RegExp(escapeChar, 'g'), escapeChar + escapeChar);
        value = value.replace(new RegExp("_", 'g'), escapeChar + "_");
        value = value.replace(new RegExp("%", 'g'), escapeChar + "%");
        return value;
    }

    /**
     * Transforms match pattern to SQL 'like' format.
     *
     * @param {*} value - (Converted to string) patternt to transform
     * @param {string} escapeChar - Escape character
     * @return {string} Transformed pattern
     */
    matchPatternToSQL(value, escapeChar) {
        const patternEscape = "\\";
        const multiCharacterWildcard = ["*"];
        const singleCharacterWildcard = ["?", "%"];
        if (value === undefined || value === null) {
            return "";
        }
        value = "" + value;
        let newValue = "";
        let foundEscapeCharacter = false;
        for (let i = 0, l = value.length; i < l; i++) {
            const singleChar = value.substring(i, 1);
            if (foundEscapeCharacter) {
                newValue += singleChar;
                foundEscapeCharacter = false;
                continue;
            }
            if (patternEscape === singleChar) {
                foundEscapeCharacter = true;
                continue;
            }
            if (multiCharacterWildcard.includes(singleChar)) {
                newValue += "%";
                continue;
            }
            if (singleCharacterWildcard.includes(singleChar)) {
                newValue += "_";
                continue;
            }
            if (escapeChar === singleChar) {
                newValue += escapeChar + escapeChar;
                continue;
            }
            if ("%" === singleChar) {
                newValue += escapeChar + "%";
                continue;
            }
            if ("_" === singleChar) {
                newValue += escapeChar + "_";
                continue;
            }
            newValue += singleChar;
        }
        return newValue;
    }

    /**
     * (Internal) returns SQL snippet for specified text match style.
     * Supported matching styles: 'exact', 'exactCase', 'substring', 'startsWith'.
     * For styles 'exact' and 'exactCase' needed two binding parameters: column name and value.
     * For styles 'substring', 'startsWith' needed three binding parameters: column name, value and escape character.
     * Defaults to 'substring'.
     * <br/>
     * Values for SQL parameter binding will be added to <code>params</code> parameter.
     *
     * @param {string} column - SQL column name
     * @param {string} value - value
     * @param {string} textMatchStyle - text match style
     * @param {Array} parmas - Parameters array for SQL parameter binding
     * @return {string} builder
     */
    _addSQLSubstringFilter(column, value, textMatchStyle, params) {
        assert.equal(Array.isArray(params), true, "argument 'params' must be an Array");
        if (!textMatchStyle) {
            textMatchStyle = Const.TEXT_MATCH_STYLE_SUBSTRING;
        }
        let sql;
        params.push(column);
        if (Const.TEXT_MATCH_STYLE_EXACT === textMatchStyle) {
            params.push(value);
            sql = "?? = ?";
        } else if (Const.TEXT_MATCH_STYLE_EXACT_CASE === textMatchStyle) {
            params.push(value);
            sql = "upper('' || ??) = upper('' || ?)";
        } else {
            if (Const.TEXT_MATCH_STYLE_STARTS_WITH === textMatchStyle) {
                params.push("%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER));
            } else {
                //TEXT_MATCH_STYLE_SUBSTRING
                params.push("%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER) + "%");
            }
            params.push(Const.ESCAPE_CHARACTER);
            sql = "upper('' || ??) like upper(?) escape ?";
        }
        return sql;
    }

    /**
     * (Internal) parses specified advanced criteria.
     *
     * @param {object} criteria - advanced criteria
     * @return {string} SQL snippet
     */
    _parseAdvancedCriteria (criteria) {
        const self = this;
        const q = this._queryBuilder.whereRaw("");
        const operator = criteria.operator;
        this.log.info({criteria: criteria, operator: operator}, "_parseAdvancedCriteria");
        if (typeof operator !== "string") {
            this.log.warn("Found criterion with a null operator. Skipping.");
            return "";
        }
        let subCriteria = criteria.criteria;
        if (subCriteria && subCriteria.criteria) {
            subCriteria = subCriteria.criteria;
        }
        if (subCriteria && subCriteria.criterion) {
            subCriteria = subCriteria.criterion;
        }
        if (operator === Const.CRITERIA_OPERATOR_NOT) {
            if (!subCriteria) {
                this.log.warn("Found criterion '" + operator + "' with no defined sub-criteria. Skipping.");
                return "";
            }
            if (!Array.isArray(subCriteria)) {
                this.log.warn("Found criterion '" + operator + "' with sub-criteria that is not an Array."
                        + "\nReturning predicate '1=2' (always false).");
                return "1=2";
            } else {
                // "not" is implemented as a negated disjunction
                subCriteria = {
                    operator: "or",
                    criteria: subCriteria
                };
                const where = this._parseAdvancedCriteria(subCriteria);
                if (where) {
                    return "not (" + where + ")";
                }
            }
        } else if (operator === Const.CRITERIA_OPERATOR_OR) {
            if (!subCriteria) {
                this.log.warn("Found criterion '" + operator + "' with no defined sub-criteria. Skipping.");
                return "";
            }
            if (!Array.isArray(subCriteria)) {
                this.log.warn("Found criterion '" + operator + "' with sub-criteria that is not an Array."
                        + "\nReturning predicate '1=2' (always false).");
                return "1=2";
            } else {
                for (let i = 0, l = subCriteria.length; i < l; i++) {
                    q.orWhereRaw("(" + this._parseAdvancedCriteria(subCriteria[i]) + ")");
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            }
        } else if (operator === Const.CRITERIA_OPERATOR_AND) {
            if (!subCriteria) {
                this.log.warn("Found criterion '" + operator + "' with no defined sub-criteria. Skipping.");
                return "";
            }
            if (!Array.isArray(subCriteria)) {
                this.log.warn("Found criterion '" + operator + "' with sub-criteria that is not an Array."
                        + "\nReturning predicate '1=2' (always false).");
                return "1=2";
            } else {
                for (let i = 0, l = subCriteria.length; i < l; i++) {
                    q.whereRaw("(" + this._parseAdvancedCriteria(subCriteria[i]) + ")");
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            }
        } else {
            const fieldName = criteria.fieldName;
            if (typeof fieldName !== "string") {
                this.log.warn("Found criterion '" + operator + "' with no field specified. Skipping.");
                return "";
            }
            const field = this.getField(fieldName);
            if (!field) {
                this.log.warn("Field name: '" + fieldName
                        + "' specified in criteria is not defined in data source. Skipping.");
                return "";
            }
            const column = this.getSQLColumn(fieldName);
            let value = criteria.value;
            if (value === undefined) {
                value = null;
            }
            let start = criteria.start;
            if (start === undefined) {
                start = null;
            }
            let end = criteria.end;
            if (end === undefined) {
                end = null;
            }
            if (operator === Const.CRITERIA_OPERATOR_REGEXP) {
                // Not implemented - ignored
                return "";
            } else if (operator === Const.CRITERIA_OPERATOR_IREGEXP) {
                // Not implemented - ignored
                return "";
            } else if (operator === Const.CRITERIA_OPERATOR_EQUALS) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.where(column, value);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (value === null) {
                    q.whereNull(column);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                q.where(column, value).whereNotNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_EQUAL) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.where(column, "<>", value);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (value === null) {
                    q.whereNotNull(column);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                q.where(column, "<>", value).orWhereNotNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_GREATER_THAN) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.where(column, ">", value);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (value === null) {
                    // Special case
                    // null means: no lower bounds check - returning 1=1 (true)
                    return "1=1";
                }
                // null considered less than any other value
                // Added not null checking to make negation work correctly
                q.where(column, ">", value).whereNotNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_LESS_THAN) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.where(column, "<", value);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (value === null) {
                    // Special case
                    // null means: no upper bounds check - returning 1=1 (true)
                    return "1=1";
                }
                // null considered less than any other value
                q.where(column, "<", value).orWhereNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_GREATER_OR_EQUAL) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.where(column, ">=", value);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (value === null) {
                    // Special case
                    // null means: no lower bounds check - returning 1=1 (true)
                    return "1=1";
                }
                // null considered less than any other value
                // Added not null checking to make negation work correctly
                q.where(column, ">=", value).whereNotNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_LESS_OR_EQUAL) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.where(column, "<=", value);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (value === null) {
                    // Special case
                    // null means: no upper bounds check - returning 1=1 (true)
                    return "1=1";
                }
                // null considered less than any other value
                // Added not null checking to make negation work correctly
                q.where(column, "<=", value).orWhereNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_BETWEEN) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.where(column, ">", start).where(column, "<", end);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (start !== null) {
                    if (end !== null) {
                        q.where(column, ">", start).where(column, "<", end).whereNotNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    } else {
                        // null considered less than any other value
                        // Added not null checking to make negation work correctly
                        q.where(column, ">", start).whereNotNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                } else {
                    if (end !== null) {
                        // null considered less than any other value
                        // Added not null checking to make negation work correctly
                        q.where(column, "<", end).orWhereNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    } else {
                        // Special case
                        // from null to null considered to be entire data set.
                        return "1 = 1";
                    }
                }
            } else if (operator === Const.CRITERIA_OPERATOR_BETWEEN_INCLUSIVE) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.where(column, ">=", start).where(column, "<=", end);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (start !== null) {
                    if (end !== null) {
                        q.where(column, ">=", start).where(column, "<=", end).whereNotNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    } else {
                        // null considered less than any other value
                        // Added not null checking to make negation work correctly
                        q.where(column, ">=", start).whereNotNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                } else {
                    if (end !== null) {
                        // null considered less than any other value
                        // Added not null checking to make negation work correctly
                        q.where(column, "<=", end).orWhereNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    } else {
                        // Special case
                        // from null to null considered to be entire data set.
                        return "1 = 1";
                    }
                }
            } else if (operator === Const.CRITERIA_OPERATOR_I_BETWEEN) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.whereRaw("upper('' || ??) > upper('' || ?)", [column, start]);
                    q.whereRaw("upper('' || ??) < upper('' || ?)", [column, end]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (start !== null) {
                    if (end !== null) {
                        q.whereRaw("upper('' || ??) > upper('' || ?)", [column, start]);
                        q.whereRaw("upper('' || ??) < upper('' || ?)", [column, end]);
                        q.whereNotNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    } else {
                        // null considered less than any other value
                        // Added not null checking to make negation work correctly
                        q.whereRaw("upper('' || ??) > upper('' || ?)", [column, start]);
                        q.whereNotNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                } else {
                    if (end !== null) {
                        // null considered less than any other value
                        // Added not null checking to make negation work correctly
                        q.whereRaw("upper('' || ??) < upper('' || ?)", [column, end]);
                        q.orWhereNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    } else {
                        // Special case
                        // from null to null considered to be entire data set.
                        return "1 = 1";
                    }
                }
            } else if (operator === Const.CRITERIA_OPERATOR_I_BETWEEN_INCLUSIVE) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.whereRaw("upper('' || ??) >= upper('' || ?)", [column, start]);
                    q.whereRaw("upper('' || ??) <= upper('' || ?)", [column, end]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (start !== null) {
                    if (end !== null) {
                        q.whereRaw("upper('' || ??) >= upper('' || ?)", [column, start]);
                        q.whereRaw("upper('' || ??) <= upper('' || ?)", [column, end]);
                        q.whereNotNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    } else {
                        // null considered less than any other value
                        // Added not null checking to make negation work correctly
                        q.whereRaw("upper('' || ??) >= upper('' || ?)", [column, start]);
                        q.whereNotNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                } else {
                    if (end !== null) {
                        // null considered less than any other value
                        // Added not null checking to make negation work correctly
                        q.whereRaw("upper('' || ??) <= upper('' || ?)", [column, end]);
                        q.orWhereNull(column);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    } else {
                        // Special case
                        // from null to null considered to be entire data set.
                        return "1 = 1";
                    }
                }
            } else if (operator === Const.CRITERIA_OPERATOR_I_EQUALS) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.whereRaw("upper('' || ??) = upper('' || ?)", [column, value]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (value === null) {
                    q.whereNull(column);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                q.whereRaw("upper('' || ??) = upper('' || ?)", [column, value]);
                q.whereNotNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_EQUAL) {
                if (this.dsRequest.strictSQLFiltering) {
                    q.whereRaw("upper('' || ??) <> upper('' || ?)", [column, value]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                if (value === null) {
                    q.whereNotNull(column);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
                q.whereRaw("upper('' || ??) <> upper('' || ?)", [column, value]);
                q.orWhereNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_CONTAINS) {
                q.whereRaw("('' || ??) like ? escape ?",
                    [column, "%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_STARTS_WITH) {
                q.whereRaw("('' || ??) like ? escape ?",
                    [column, this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_ENDS_WITH) {
                q.whereRaw("('' || ??) like ? escape ?",
                    [column, "%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_CONTAINS) {
                q.whereRaw("upper('' || ??) like upper(?) escape ?",
                    [column, "%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_STARTS_WITH) {
                q.whereRaw("upper('' || ??) like upper(?) escape ?",
                    [column, this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_ENDS_WITH) {
                q.whereRaw("upper('' || ??) like upper(?) escape ?",
                    [column, "%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_CONTAINS) {
                q.whereRaw("('' || ??) not like ? escape ?",
                    [column, "%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_STARTS_WITH) {
                q.whereRaw("('' || ??) not like ? escape ?",
                    [column, this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_ENDS_WITH) {
                q.whereRaw("('' || ??) not like ? escape ?",
                    [column, "%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_CONTAINS) {
                q.whereRaw("upper('' || ??) not like upper(?) escape ?",
                    [column, "%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_STARTS_WITH) {
                q.whereRaw("upper('' || ??) not like upper(?) escape ?",
                    [column, this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_ENDS_WITH) {
                q.whereRaw("upper('' || ??) not like upper(?) escape ?",
                    [column, "%" + this.escapeSQLLikeValue(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_MATCHES_PATTERN) {
                q.whereRaw("('' || ??) like ? escape ?",
                    [column, this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_MATCHES_PATTERN) {
                q.whereRaw("upper('' || ??) like upper(?) escape ?",
                    [column, this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_CONTAINS_PATTERN) {
                q.whereRaw("('' || ??) like ? escape ?",
                    [column, "%" + this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_STARTS_WITH_PATTERN) {
                q.whereRaw("('' || ??) like ? escape ?",
                    [column, this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_ENDS_WITH_PATTERN) {
                q.whereRaw("('' || ??) like ? escape ?",
                    [column, "%" + this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_CONTAINS_PATTERN) {
                q.whereRaw("upper('' || ??) like upper(?) escape ?",
                    [column, "%" + this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_STARTS_WITH_PATTERN) {
                q.whereRaw("upper('' || ??) like upper(?) escape ?",
                    [column, this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_ENDS_WITH_PATTERN) {
                q.whereRaw("upper('' || ??) like upper(?) escape ?",
                    [column, "%" + this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_CONTAINS_PATTERN) {
                q.whereRaw("('' || ??) not like ? escape ?",
                    [column, "%" + this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_STARTS_WITH_PATTERN) {
                q.whereRaw("('' || ??) not like ? escape ?",
                    [column, this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_ENDS_WITH_PATTERN) {
                q.whereRaw("('' || ??) not like ? escape ?",
                    [column, "%" + this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_CONTAINS_PATTERN) {
                q.whereRaw("upper('' || ??) not like upper(?) escape ?",
                    [column, "%" + this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_STARTS_WITH_PATTERN) {
                q.whereRaw("upper('' || ??) not like upper(?) escape ?",
                    [column, this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER) + "%", Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_ENDS_WITH_PATTERN) {
                q.whereRaw("upper('' || ??) not like upper(?) escape ?",
                    [column, "%" + this.matchPatternToSQL(value, Const.ESCAPE_CHARACTER), Const.ESCAPE_CHARACTER]);
                if (!this.strictSQLFiltering) {
                    q.whereNotNull(column);
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_IS_BLANK) {
                q.where(column, "").orWhereNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_BLANK) {
                q.where(column, "<>", "").whereNotNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_IS_NULL) {
                q.whereNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_NULL) {
                q.whereNotNull(column);
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_IN_SET) {
                if (value === null) {
                    this.log.warn("Found criterion '" + operator + "' with no value specified. Returning '1=2' (always false).");
                    return "1=2";
                }
                if (!Array.isArray(value)) {
                    value = [value];
                }
                if (value.length <= 0) {
                    this.log.warn("Found criterion '" + operator + "' with empty value list. Returning '1=2' (always false).");
                    return "1=2";
                }
                let hasNulls = false;
                let valueSet = [];
                for (let i = 0, l = value.length; i < l; i++) {
                    if (value[i] === undefined || value[i] === null) {
                        hasNulls = true;
                        continue;
                    }
                    valueSet.push(value[i]);
                }
                q.whereIn(column, valueSet);
                if (valueSet.length > 0) {
                    if (hasNulls) {
                        q.orWhereNull(column);
                    } else {
                        q.whereNotNull(column);
                    }
                } else {
                    if (hasNulls) {
                        q.whereNull(column);
                    } else {
                        // Should never get here.
                        q.whereRaw("1=2");
                    }
                }
                // Strip 'select * where ' part
                return q.toString().slice(15);
            } else if (operator === Const.CRITERIA_OPERATOR_NOT_IN_SET) {
                criteria.operator = "inSet";
                let where = this._parseAdvancedCriteria(criteria);
                if (where) {
                    where = "not (" + where + ")";
                } else {
                    // Should never happen.
                    // empty where part means no criteria applied (all records).
                    // We return opposite to all records predicate '1=2' (always false).
                    where = "1=2";
                }
                return where;
            } else {
                let otherFieldName = value;
                if (typeof otherFieldName !== "string") {
                    this.log.warn("Found criterion '" + operator + "' with no 'other' field specified. Returning '1=1' (always true).");
                    return "1=1";
                }
                let otherField = this.getField(otherFieldName);
                if (!otherField) {
                    this.log.warn("'Other' field name: '" + otherFieldName
                            + "' specified in criteria is not defined in data source. Returning '1=1' (always true).");
                    return "1=1";
                }
                let otherColumnName = this.getSQLColumn(otherFieldName);
                if (operator === Const.CRITERIA_OPERATOR_EQUALS_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(?? = ??)",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null and ?? is null) or (?? = ?? and ?? is not null and ?? is not null)",
                        [fieldName, otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_NOT_EQUAL_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(?? <> ??)",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("((?? is null and ?? is not null) or (?? is not null and ?? is null)) or (?? <> ?? and ?? is not null and ?? is not null)",
                        [fieldName, otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_I_EQUALS_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("upper('' || ??) = upper('' || ??)",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null and ?? is null) or (upper('' || ??) = upper('' || ??) and ?? is not null and ?? is not null)",
                        [fieldName, otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_EQUAL_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("upper('' || ??) <> upper('' || ??)",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("((?? is null and ?? is not null) or (?? is not null and ?? is null)) or (upper('' || ??) <> upper('' || ??) and ?? is not null and ?? is not null)",
                        [fieldName, otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                } else if (operator === Const.CRITERIA_OPERATOR_GREATER_THAN_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(?? > ??)",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is not null and ?? is null) or (?? > ?? and ?? is not null and ?? is not null)",
                        [fieldName, otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_LESS_THAN_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(?? < ??)",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null and ?? is not null) or (?? < ?? and ?? is not null and ?? is not null)",
                        [fieldName, otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_GREATER_OR_EQUAL_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(?? >= ??)",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null) or (?? >= ?? and ?? is not null and ?? is not null)",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_LESS_OR_EQUAL_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(?? <= ??)",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null) or (?? <= ?? and ?? is not null and ?? is not null)",
                        [fieldName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_CONTAINS_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(('' || ??) like ('%' || ?? || '%'))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null) or (('' || ??) like ('%' || ?? || '%') and ?? is not null and ?? is not null)",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_STARTS_WITH_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(('' || ??) like ('' || ?? || '%'))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null) or (('' || ??) like ('' || ?? || '%') and ?? is not null and ?? is not null)",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_ENDS_WITH_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(('' || ??) like ('%' || ??))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null) or (('' || ??) like ('%' || ??) and ?? is not null and ?? is not null)",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_I_CONTAINS_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(upper('' || ??) like upper('%' || ?? || '%'))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null) or (upper('' || ??) like upper('%' || ?? || '%') and ?? is not null and ?? is not null)",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_I_STARTS_WITH_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(upper('' || ??) like upper('' || ?? || '%'))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null) or (upper('' || ??) like upper('' || ?? || '%') and ?? is not null and ?? is not null)",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_I_ENDS_WITH_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(upper('' || ??) like upper('%' || ??))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("(?? is null) or (upper('' || ??) like upper('%' || ??) and ?? is not null and ?? is not null)",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_NOT_CONTAINS_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(('' || ??) not like ('%' || ?? || '%'))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("not ((?? is null) or (('' || ??) like ('%' || ?? || '%') and ?? is not null and ?? is not null))",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_NOT_STARTS_WITH_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(('' || ??) not like ('' || ?? || '%'))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("not ((?? is null) or (('' || ??) like ('' || ?? || '%') and ?? is not null and ?? is not null))",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_NOT_ENDS_WITH_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(('' || ??) not like ('%' || ??))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("not ((?? is null) or (('' || ??) like ('%' || ??) and ?? is not null and ?? is not null))",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_CONTAINS_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(upper('' || ??) not like upper('%' || ?? || '%'))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("not ((?? is null) or (upper('' || ??) like upper('%' || ?? || '%') and ?? is not null and ?? is not null))",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_STARTS_WITH_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(upper('' || ??) not like upper('' || ?? || '%'))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("not ((?? is null) or (upper('' || ??) like upper('' || ?? || '%') and ?? is not null and ?? is not null))",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                } else if (operator === Const.CRITERIA_OPERATOR_I_NOT_ENDS_WITH_FIELD) {
                    if (this.dsRequest.strictSQLFiltering) {
                        q.whereRaw("(upper('' || ??) not like upper('%' || ??))",
                            [fieldName, otherColumnName]);
                        // Strip 'select * where ' part
                        return q.toString().slice(15);
                    }
                    q.whereRaw("not ((?? is null) or (upper('' || ??) like upper('%' || ??) and ?? is not null and ?? is not null))",
                        [otherColumnName, fieldName, otherColumnName, fieldName, otherColumnName]);
                    // Strip 'select * where ' part
                    return q.toString().slice(15);
                }
            }
        }
        this.log.warn("Not supported criterion '" + operator + "'. Skipping.");
        return "";
    }

    /**
     * Initializes data source with provided DS request.
     *
     * @param {DSRequest} dsRequest - Data source request
     * @param {function} callback - Callback executed when finished
     */
    init(dsRequest, callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        this.dsRequest = dsRequest;
        try {
            this._queryBuilder = knex({client: ConnectionPool.getDBType(this.dbName)});
        } catch(err) {
            return callback(new Exception("Data base type is not specifed", err));
        }
        const self = this;
        ConnectionPool.acquire(this.dbName, function(err, connection) {
            if (err) {
                return callback(new Exception("Failed to acquire data base connection", err));
            }
            self.connection = connection;
            return callback();
        });
    }

    /**
     * Starts data base transaction.
     *
     * @param {function} callback - Callback executed when finished
     */
    startTransaction(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        this._queryBuilder.client.query(this.connection, "begin").then(function(result) {
            return callback();
        }, function(err) {
            return callback(new Exception("Failed to start data base transaction", err));
        });
    }

    /**
     * Executes DS request fetch.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeFetch(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        const self = this;
        const q = this._queryBuilder(this.tableName).select(this.getSQLColumns(this.fields));
        if (this.dsRequest.isAdvancedCriteria) {
            if (this.dsRequest.strictSQLFiltering === undefined) {
                this.dsRequest.strictSQLFiltering = Config.getValue("dataSource.strictSQLFiltering");
            }
            if (typeof this.dsRequest.strictSQLFiltering === "boolean") {
                this.dsRequest.strictSQLFiltering = false;
            }
            let criteriaSQL = this._parseAdvancedCriteria(this.dsRequest.criteria);
            q.whereRaw(criteriaSQL);
        } else {
            for (let key in this.dsRequest.criteria) {
                const field = this.getField(key);
                if (field) {
                    const column = this.getSQLColumn(key);
                    const value = this.dsRequest.criteria[key];
                    if (value === undefined || value === null) {
                        q.whereNull(column);
                    } else if (Array.isArray(value)) {
                        q.where(function() {
                            let hasNulls = false;
                            let orAdded = false;
                            for (let i = 0, l = value.length; i < l; i++) {
                                if (value[i] === undefined || value[i] === null) {
                                    hasNulls = true;
                                } else {
                                    const params = [];
                                    const matchSQL = self._addSQLSubstringFilter(column, value[i], self.dsRequest.textMatchStyle, params);
                                    this.orWhereRaw(matchSQL, params);
                                    orAdded = true;
                                }
                            }
                            if (orAdded) {
                                if (hasNulls) {
                                    this.orWhereNull(column);
                                }
                            } else {
                                if (hasNulls) {
                                    this.orWhereNull(column);
                                } else {
                                    this.whereRaw("1=2");
                                }
                            }
                        });
                    } else {
                        const params = [];
                        const matchSQL = self._addSQLSubstringFilter(column, value, this.dsRequest.textMatchStyle, params);
                        q.whereRaw(matchSQL, params);
                    }
                } else {
                    this.log.warn("Field '" + key + "' is not defined in data source. Skipping.");
                }
            }
        }
        if (this.dsRequest.sortBy) {
            if (!Array.isArray(this.dsRequest.sortBy)) {
                const a = [];
                a.push(this.dsRequest.sortBy);
                this.dsRequest.sortBy = a;
            }
            for (let i = 0, l = this.dsRequest.sortBy.length; i < l; i++) {
                if (this.dsRequest.sortBy[i].startsWith("-")) {
                    q.orderBy(this.dsRequest.sortBy[i].slice(1), "desc");
                } else {
                    q.orderBy(this.dsRequest.sortBy[i]);
                }
            }
        }
        let startRow = parseInt(this.dsRequest.startRow);
        if (!isNaN(startRow)) {
            q.offset(startRow);
        } else {
            startRow = 0;
        }
        let endRow = parseInt(this.dsRequest.endRow);
        if (!isNaN(endRow)) {
            q.limit(endRow);
        }
        this.log.debug({sql: q.toString()}, "FETCH");
        this._queryBuilder.client.query(this.connection, q.toSQL()).then(function(result) {
            result = self._queryBuilder.client.processResponse(result);
            const response = new DSResponse(Const.STATUS_SUCCESS, self.toRecords(result));
            response.startRow = startRow;
            response.endRow = startRow + result.length;
            response.totalRows = result.length;
            return callback(null, response);
        }, function(err) {
            return callback(new Exception("Failed to retrieve data from data base", err));
        });
    }

    /**
     * Executes DS request add.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeAdd(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        const self = this;
        const insertParams = {};
        for (let i = 0, l = this.fields.length; i < l; i++) {
            const field = this.fields[i];
            if (this.dsRequest.values.hasOwnProperty(field.name)) {
                insertParams[this.getSQLColumn(field.name)] = this.dsRequest.values[field.name];
            }
        }
        const q = this._queryBuilder(this.tableName).insert(insertParams);
        this.log.debug({sql: q.toString()}, "ADD");
        this._queryBuilder.client.query(this.connection, q.toSQL()).then(function(result) {
            result = self._queryBuilder.client.processResponse(result);
            for (let i = 0, l = self.fields.length; i < l; i++) {
                const field = self.fields[i];
                if (field.type === Const.FIELD_TYPE_SEQUENCE) {
                    self.dsRequest.values[field.name] = result[0];
                    break;
                }
            }
            let pkValue;
            let sqlPKValue;
            try {
                pkValue = self.getPKValue(self.dsRequest.values);
                sqlPKValue = self.getSQLValue(pkValue);
            } catch (err) {
                return callback(err);
            }
            if (Object.keys(pkValue).length < 1) {
                return callback(new Exception("Missing primary key"));
            }
            const refreshQ = self._queryBuilder(self.tableName).select(self.getSQLColumns(self.fields)).where(sqlPKValue);
            self.log.debug({sql: refreshQ.toString()}, "ADD_REFRESH");
            self._queryBuilder.client.query(self.connection, refreshQ.toSQL()).then(function(result) {
                result = self._queryBuilder.client.processResponse(result);
                const response = new DSResponse(Const.STATUS_SUCCESS, self.toRecords(result));
                return callback(null, response);
            }, function(err) {
                return callback(new Exception("Failed to refresh inserted data in data base", err));
            });
        }, function(err) {
            return callback(new Exception("Failed to insert data to data base", err));
        });
    }

    /**
     * Executes DS request remove.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeRemove(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        const self = this;
        let pkValue;
        let sqlPKValue;
        try {
            pkValue = this.getPKValue(this.dsRequest.criteria);
            sqlPKValue = this.getSQLValue(pkValue);
        } catch (err) {
            return callback(err);
        }
        if (Object.keys(pkValue).length < 1) {
            return callback(new Exception("Missing primary key"));
        }
        const q = this._queryBuilder(this.tableName).where(sqlPKValue).delete();
        this.log.debug({sql: q.toString()}, "REMOVE");
        this._queryBuilder.client.query(this.connection, q.toSQL()).then(function(result) {
            result = self._queryBuilder.client.processResponse(result);
            if (result < 1) {
                return callback(new Exception("Remove failed. Row does not exists in data base. PK=" + JSON.stringify(pkValue)));
            }
            const response = new DSResponse(Const.STATUS_SUCCESS, pkValue);
            return callback(null, response);
        }, function(err) {
            return callback(new Exception("Failed to remove data from data base", err));
        });
    }

    /**
     * Executes DS request update.
     *
     * @param {function} callback - Callback executed when finished
     */
    executeUpdate(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        const self = this;
        let pkValue;
        let sqlPKValue;
        try {
            pkValue = this.getPKValue(this.dsRequest.criteria);
            sqlPKValue = this.getSQLValue(pkValue);
        } catch (err) {
            return callback(err);
        }
        if (Object.keys(pkValue).length < 1) {
            return callback(new Exception("Missing primary key"));
        }
        let updateValue = this.getNonPKValue(this.dsRequest.values);
        let sqlUpdateValue = this.getSQLValue(updateValue);
        const q = this._queryBuilder(this.tableName).where(sqlPKValue).update(sqlUpdateValue);
        this.log.debug({sql: q.toString()}, "UPDATE");
        this._queryBuilder.client.query(this.connection, q.toSQL()).then(function(result) {
            result = self._queryBuilder.client.processResponse(result);
            if (result < 1) {
                return callback(new Exception("Update failed. Row does not exists in data base. PK=" + JSON.stringify(pkValue)));
            }
            const refreshQ = self._queryBuilder(self.tableName).select(self.getSQLColumns(self.fields)).where(sqlPKValue);
            self.log.debug({sql: refreshQ.toString()}, "UPDATE_REFRESH");
            self._queryBuilder.client.query(self.connection, refreshQ.toSQL()).then(function(result) {
                result = self._queryBuilder.client.processResponse(result);
                const response = new DSResponse(Const.STATUS_SUCCESS, self.toRecords(result));
                return callback(null, response);
            }, function(err) {
                return callback(new Exception("Failed to refresh updated data in data base", err));
            });
        }, function(err) {
            return callback(new Exception("Failed to update data in data base", err));
        });
    }

    /**
     * Commits transaction. Should be overridden if data source uses transactions.
     *
     * @param {function} callback - Callback executed when finished
     */
    commit(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        this._queryBuilder.client.query(this.connection, "commit").then(function(result) {
            return callback();
        }, function(err) {
            return callback(new Exception("Failed to commit data base transaction", err));
        });
    }

    /**
     * Rolls back transaction. Should be overridden if data source uses transactions.
     *
     * @param {function} callback - Callback executed when finished
     */
    rollback(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        this._queryBuilder.client.query(this.connection, "rollback").then(function(result) {
            return callback();
        }, function(err) {
            return callback(new Exception("Failed to roll back data base transaction", err));
        });
    }

    /**
     * Frees resources tied up by this data source.
     *
     * @param {function} callback - Callback executed when finished
     */
    freeResources(callback) {
        assert.equal(typeof callback, "function", "argument 'callback' must be a function");
        if (this.connection) {
            const self = this;
            ConnectionPool.release(this.dbName, this.connection, function(err) {
                if (err) {
                    err = new Exception("Error occured while releasing data base connection", err);
                }
                self.connection = null;
                return callback(err);
            });
        } else {
            return callback();
        }
    }

    // Class logger
    get log() {
        return _log;
    }

}

// Static value for SQLDataSource.log
const _log = new Log(SQLDataSource);

/**
 * Ensures that dependencies are loaded correctly.
 * Solves cyclic references loading problem.
 */
const ensureDependencies = function() {
    if (typeof BaseRequest !== "function") {
        BaseRequest = require("../BaseRequest");
    }
    if (typeof DSRequest !== "function") {
        DSRequest = require("./DSRequest");
    }
    if (typeof DSResponse !== "function") {
        DSResponse = require("./DSResponse");
    }
};

module.exports = SQLDataSource;
