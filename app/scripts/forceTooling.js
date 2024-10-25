/*
 * Copyright (c) 2011, salesforce.com, inc.
 * All rights reserved.
 */

var forceTooling = window.forceTooling;

if (forceTooling === undefined) {
  forceTooling = {};
}

if (forceTooling.ApexLogs === undefined) {
  forceTooling.ApexLogs = {};
  forceTooling.ApexLogs.queryString =
    "SELECT Id,Application,DurationMilliseconds,Location,LogLength,LogUserId,Operation,Request,StartTime,Status FROM ApexLog";
}

if (forceTooling.CustomFields === undefined) {
  forceTooling.CustomFields = {};

  forceTooling.CustomFields.CustomField = function (
    sobject,
    sobjectId,
    name,
    type,
    helpText,
    length,
    leftDecimals,
    rightDecimals,
    picklistValues,
    referenceTo,
    visibleLines
  ) {
    this.Metadata = new forceTooling.CustomFields.Metadata(
      name,
      sobject,
      type,
      helpText,
      length,
      leftDecimals,
      rightDecimals,
      picklistValues,
      referenceTo,
      visibleLines
    );
    this.FullName = sobject + "." + this.Metadata.fullName;
  };

  forceTooling.CustomFields.Metadata = function (
    name,
    sobject,
    type,
    helpText,
    length,
    leftDecimals,
    rightDecimals,
    picklistValues,
    referenceTo,
    visibleLines
  ) {
    var tempName = name;
    if (name.toLowerCase().substring(name.length - 3, name.length) == "__c") {
      this.fullName = name;
      tempName = name.replace("__c", "").replace("__C", "").replace("_", " ");
      this.label = tempName;
    } else {
      this.label = name;
      tempName = name.replace(" ", "_") + "__c";
      this.fullName = tempName;
    }

    this.type = type;
    this.inlineHelpText = helpText;
    this.length = parseInt(length);
    if (leftDecimals != null && rightDecimals != null) {
      this.precision = parseInt(leftDecimals + rightDecimals);
    }
    this.scale = rightDecimals;

    if (picklistValues !== null) {
      this.picklist = {
        sorted: false,
        restrictedPicklist: null,
        controllingField: null,
        picklistValues: picklistValues,
      };
    }

    // Set default values for booleans
    this.caseSensitive = false;
    this.deprecated = false;
    this.displayLocationInDecimal = false;
    this.externalId = false;
    this.indexed = false;
    this.populateExistingRows = false;
    this.reparentableMasterDetail = false;
    this.stripMarkup = false;
    this.trackFeedHistory = false;
    this.trackHistory = false;
    this.trueValueIndexed = false;
    this.unique = false;
    this.writeRequiresMasterRead = false;

    if (visibleLines != null) this.visibleLines = visibleLines;
    if (this.type == "Checkbox") this.defaultValue = false;
    if (referenceTo != null) {
      this.deleteConstraint = "SetNull";
      this.referenceTo = referenceTo;
      this.relationshipLabel = sobject;
      this.relationshipName = sobject;
    }
  };

  forceTooling.CustomFields.queryString =
    "Select Id, DeveloperName, NamespacePrefix, TableEnumOrId, Fullname, Metadata FROM CustomField";

  forceTooling.CustomFields.TYPES = {
    AUTONUMBER: { name: "AutoNumber", code: "auto" },
    CHECKBOX: { name: "Checkbox", code: "cb" },
    CURRENCY: { name: "Currency", code: "curr" },
    DATE: { name: "Date", code: "d" },
    DATETIME: { name: "DateTime", code: "dt" },
    EMAIL: { name: "Email", code: "e" },
    FORMULA: { name: "FORMULA", code: "form" },
    GEOLOCATION: { name: "Location", code: "geo" },
    HIERARCHICALRELATIONSHIP: { name: "Hierarchy", code: "hr" },
    LOOKUPRELATIONSHIP: { name: "Lookup", code: "look" },
    MASTERDETAILRELATIONSHIP: { name: "MasterDetail", code: "md" },
    NUMBER: { name: "Number", code: "n" },
    PERCENT: { name: "Percent", code: "per" },
    PHONE: { name: "Phone", code: "ph" },
    PICKLIST: { name: "Picklist", code: "pl" },
    PICKLISTMS: { name: "MultiselectPicklist", code: "plms" },
    ROLLUPSUMMARY: { name: "Summary", code: "rup" },
    TEXT: { name: "Text", code: "t" },
    TEXTENCRYPTED: { name: "EcryptedText", code: "te" },
    TEXTAREA: { name: "TextArea", code: "ta" },
    TEXTAREALONG: { name: "LongTextArea", code: "tal" },
    TEXTAREARICH: { name: "Html", code: "tar" },
    URL: { name: "Url", code: "url" },
  };
}

if (forceTooling.Client === undefined) {
  if (window.$j === undefined) {
    $j = $;
  }

  forceTooling.Client = function (clientId, loginUrl, proxyUrl) {
    this.clientId = clientId;
    this.loginUrl = loginUrl || "https://login.salesforce.com/";
    if (typeof proxyUrl === "undefined" || proxyUrl === null) {
      if (location.protocol === "file:") {
        this.proxyUrl = null;
      } else {
        this.proxyUrl =
          location.protocol + "//" + location.hostname + "/services/proxy";
      }
      this.authzHeader = "Authorization";
    } else {
      this.proxyUrl = proxyUrl;
      this.authzHeader = "X-Authorization";
    }
    this.refreshToken = null;
    this.sessionId = null;
    this.apiVersion = null;
    this.instanceUrl = null;
    this.asyncAjax = true;
  };

  forceTooling.Client.prototype.setRefreshToken = function (refreshToken) {
    this.refreshToken = refreshToken;
  };

  forceTooling.Client.prototype.setSessionToken = function (
    sessionId,
    apiVersion,
    instanceUrl
  ) {
    this.sessionId = sessionId;
    this.apiVersion =
      typeof apiVersion === "undefined" || apiVersion === null
        ? "v27.0"
        : apiVersion;

    if (typeof instanceUrl === "undefined" || instanceUrl === null) {
      const elements = location.hostname.split(".");
      let instance = null;

      if (elements.length == 4 && elements[1] === "my") {
        instance = elements[0] + "." + elements[1];
      } else if (elements.length == 3) {
        instance = elements[0];
      } else {
        instance = elements[1];
      }

      this.instanceUrl = "https://" + instance + ".salesforce.com";
    } else {
      this.instanceUrl = instanceUrl;
    }
  };

  forceTooling.Client.prototype.ajax = function (
    path,
    callback,
    error,
    method,
    payload,
    retry
  ) {
    const that = this;
    const url = this.instanceUrl + "/services/data" + path;

    return $j.ajax({
      type: method || "GET",
      async: this.asyncAjax,
      url: this.proxyUrl !== null ? this.proxyUrl : url,
      contentType: method == "DELETE" ? null : "application/json",
      cache: false,
      processData: false,
      data: payload,
      success: callback,
      error:
        !this.refreshToken || retry
          ? error
          : function (jqXHR, textStatus, errorThrown) {
              if (jqXHR.status === 401) {
                that.refreshAccessToken(function (oauthResponse) {
                  that.setSessionToken(
                    oauthResponse.access_token,
                    null,
                    oauthResponse.instance_url
                  );
                  that.ajax(path, callback, error, method, payload, true);
                }, error);
              } else {
                error(jqXHR, textStatus, errorThrown);
              }
            },
      dataType: "json",
      beforeSend: function (xhr) {
        if (that.proxyUrl !== null) {
          xhr.setRequestHeader("SalesforceProxy-Endpoint", url);
        }
        xhr.setRequestHeader(that.authzHeader, "OAuth " + that.sessionId);
        xhr.setRequestHeader(
          "X-User-Agent",
          "salesforce-toolkit-rest-javascript/" + that.apiVersion
        );
      },
    });
  };

  // Core API methods
  forceTooling.Client.prototype.create = function (
    metaDataType,
    payload,
    callback,
    error
  ) {
    return this.ajax(
      "/" + this.apiVersion + "/tooling/sobjects/" + metaDataType + "/",
      callback,
      error,
      "POST",
      JSON.stringify(payload)
    );
  };

  forceTooling.Client.prototype.update = function (
    metaDataType,
    id,
    payload,
    callback,
    error
  ) {
    return this.ajax(
      "/" +
        this.apiVersion +
        "/tooling/sobjects/" +
        metaDataType +
        "/" +
        id +
        "?_HttpMethod=PATCH",
      callback,
      error,
      "POST",
      JSON.stringify(payload)
    );
  };

  forceTooling.Client.prototype.query = function (
    queryString,
    callback,
    error
  ) {
    return this.ajax(
      "/" + this.apiVersion + "/tooling/query/?q=" + queryString,
      callback,
      error
    );
  };

  // Convenience methods for common queries
  forceTooling.Client.prototype.queryFieldsByName = function (
    name,
    objectName,
    callback,
    error
  ) {
    const queryString =
      forceTooling.CustomFields.queryString +
      ` WHERE DeveloperName='${name}' AND TableEnumOrId='${objectName}'`;
    return this.query(queryString, callback, error);
  };

  forceTooling.Client.prototype.queryFieldsById = function (
    id,
    callback,
    error
  ) {
    const queryString =
      forceTooling.CustomFields.queryString + ` WHERE Id='${id}'`;
    return this.query(queryString, callback, error);
  };

  forceTooling.Client.prototype.queryFieldsForObject = function (
    objectName,
    callback,
    error
  ) {
    const queryString =
      forceTooling.CustomFields.queryString +
      ` WHERE TableEnumOrId='${objectName}'`;
    return this.query(queryString, callback, error);
  };

  forceTooling.Client.prototype.queryLogsById = function (id, callback, error) {
    return this.ajax(
      "/" + this.apiVersion + "/tooling/sobjects/ApexLog/" + id,
      callback,
      error
    );
  };

  forceTooling.Client.prototype.queryLogsByUserId = function (
    userId,
    callback,
    error
  ) {
    const queryString =
      forceTooling.ApexLogs.queryString + ` WHERE LogUserId='${userId}'`;
    return this.query(queryString, callback, error);
  };

  forceTooling.Client.prototype.queryLogBodyByLogId = function (
    id,
    callback,
    error
  ) {
    return this.ajax(
      "/" + this.apiVersion + "/tooling/sobjects/ApexLog/" + id + "/Body/",
      callback,
      error
    );
  };
}
