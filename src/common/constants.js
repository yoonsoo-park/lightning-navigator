export const API_VERSION = "v57.0";

export const EXCLUDED_DOMAINS = [
    "visual.force.com",
    "content.force.com",
    "lightning.force.com",
];

export const ACTION_TYPES = {
    FETCH_COOKIE: "fetch-cookie",
    GET_COMMANDS: "get-commands",
    GET_METADATA: "get-metadata",
    REFRESH_METADATA: "refresh-metadata",
    REFRESH_METADATA_SUCCESS: "refresh-metadata-success",
    QUERY_LABELS: "query-labels",
    SHOW_COMMAND_BAR: "show-command-bar",
    SEARCH_RECORDS: "search-records",
};

export const METADATA_TYPES = {
    APEX_CLASS: "ApexClass",
    CUSTOM_OBJECT: "CustomObject",
    VISUALFORCE_PAGE: "ApexPage",
    FLOW: "Flow",
    PROFILE: "Profile",
    TRIGGER: "ApexTrigger",
    CUSTOM_LABEL: "CustomLabel",
    USER: "User",
};

export const API_PATHS = {
    tooling: `services/data/${API_VERSION}/tooling`,
    data: `services/data/${API_VERSION}`,
    query: `services/data/${API_VERSION}/query`,
};

export const QUERIES = {
    CUSTOM_OBJECTS: `
    SELECT Id, DeveloperName, NamespacePrefix, ManageableState 
    FROM CustomObject 
    WHERE ManageableState = 'unmanaged'
  `,
    CUSTOM_LABELS: `
    SELECT Id, Name, Category, Value, NamespacePrefix, MasterLabel 
    FROM ExternalString 
    ORDER BY NamespacePrefix, Category
  `,
    TRIGGERS: `SELECT Id, Name, NamespacePrefix FROM ApexTrigger`,
    PROFILES: `SELECT Id, Name FROM Profile`,
    APEX_PAGES: `SELECT Id, Name, NamespacePrefix FROM ApexPage`,
    USERS: `SELECT Id, Name FROM User`,
    APEX_COMPONENTS: `SELECT Id, Name, NamespacePrefix FROM ApexComponent`,
    APEX_CLASSES: `
    SELECT Id, Name, NamespacePrefix 
    FROM ApexClass
  `,
    FLOWS: `
    SELECT Id, DeveloperName 
    FROM FlowDefinition
  `,
    NFORCE_SYS_PROPS: `
  SELECT
    Id,
    Name,
    nFORCE__Category_Name__c,
    nFORCE__Key__c
  FROM
    nFORCE__System_Properties__c`,
    LLCBI_SYS_PROPS: `
  SELECT
    Id,
    Name,
    LLC_BI__Category_Name__c,
    LLC_BI__Key__c
  FROM
    LLC_BI__System_Properties__c`,
};

export const STORAGE_KEYS = {
    COMMANDS: "commands",
    METADATA: "metadata",
    LABELS: "labels",
    LAST_UPDATED: "lastUpdated",
};

export const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export const COMMAND_BAR_ID = "lightning-nav-command-bar";
