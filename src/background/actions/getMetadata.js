import { STORAGE_KEYS, CACHE_DURATION } from "../../common/constants.js";

/**
 * Gets org identifier from full key
 */
const getOrgKey = (key) => {
    return key?.split("!")[0] || null;
};

/**
 * Verifies if cached metadata is still valid
 */
const isMetadataValid = (lastUpdated) => {
    if (!lastUpdated) return false;
    return Date.now() - lastUpdated < CACHE_DURATION;
};

/**
 * Handles retrieving metadata from storage
 */
export const handleGetMetadata = async (data) => {
    const { key } = data;
    const orgKey = getOrgKey(key);

    const storage = await chrome.storage.local.get([
        STORAGE_KEYS.METADATA,
        STORAGE_KEYS.LAST_UPDATED,
    ]);

    const metadata = storage[STORAGE_KEYS.METADATA] || {};
    const lastUpdated = storage[STORAGE_KEYS.LAST_UPDATED] || {};

    // Check for specific key metadata
    if (metadata[key]) {
        return metadata[key];
    }

    // Check for org-level metadata
    if (metadata[orgKey] && isMetadataValid(lastUpdated[orgKey])) {
        return metadata[orgKey];
    }

    return null;
};
