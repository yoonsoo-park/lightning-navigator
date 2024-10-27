/**
 * Common utility functions
 */

/**
 * Debounce function execution
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Parse Salesforce ID to get object type
 */
export const parseIdType = (id) => {
    if (!id || id.length !== 18) return null;
    const prefix = id.substring(0, 3);

    const prefixMap = {
        "001": "Account",
        "003": "Contact",
        "00D": "Organization",
        "00E": "User",
        "01p": "ApexClass",
        "066": "CustomObject",
        "0Hc": "Flow",
        // Add more as needed
    };

    return prefixMap[prefix] || null;
};

/**
 * Format timestamp to locale string
 */
export const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString();
};

/**
 * Generate unique key for org+user combination
 */
export const generateKey = (cookie) => {
    const domain = cookie.domain;
    const orgId = domain.split(".")[0];
    return `${orgId}!${cookie.value.substring(0, 15)}`;
};

/**
 * Compare version strings
 */
export const compareVersions = (v1, v2) => {
    const normalize = (str) => str.split(".").map((part) => parseInt(part, 10));
    const parts1 = normalize(v1);
    const parts2 = normalize(v2);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        if (num1 !== num2) return num1 - num2;
    }
    return 0;
};

/**
 * Extract org name from domain
 */
export const getOrgName = (domain) => {
    const parts = domain.split(".");
    let orgName = parts[0];

    // Handle custom domains
    while (orgName.includes("--")) {
        orgName = orgName.substring(0, orgName.lastIndexOf("--"));
    }

    return orgName;
};

/**
 * Sanitize string for use in DOM
 */
export const sanitizeHTML = (str) => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
};

/**
 * Group array by key
 */
export const groupBy = (array, key) => {
    return array.reduce((result, item) => {
        const group = item[key];
        result[group] = result[group] || [];
        result[group].push(item);
        return result;
    }, {});
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(deepClone);

    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key, deepClone(value)])
    );
};
