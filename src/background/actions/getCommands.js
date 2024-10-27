import { STORAGE_KEYS, CACHE_DURATION } from "../../common/constants.js";

/**
 * Retrieves org key from the full key (orgId!userId)
 */
const getOrgKey = (key) => {
    return key?.split("!")[0] || null;
};

/**
 * Checks if cached data is still valid
 */
const isCacheValid = (lastUpdated) => {
    if (!lastUpdated) return false;
    return Date.now() - lastUpdated < CACHE_DURATION;
};

/**
 * Handles retrieving command data from storage
 */
export const handleGetCommands = async (data) => {
    const { key } = data;
    const orgKey = getOrgKey(key);

    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.COMMANDS,
        STORAGE_KEYS.LAST_UPDATED,
    ]);

    const commands = storage[STORAGE_KEYS.COMMANDS] || {};
    const lastUpdated = storage[STORAGE_KEYS.LAST_UPDATED] || {};

    // Return commands specific to the key if they exist
    if (commands[key]) {
        return commands[key];
    }

    // Return org-level commands if they're still valid
    if (commands[orgKey] && isCacheValid(lastUpdated[orgKey])) {
        return commands[orgKey];
    }

    return null;
};
