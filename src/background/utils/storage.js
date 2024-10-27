import { STORAGE_KEYS } from "../../common/constants.js";

/**
 * Utility class for handling chrome.storage operations
 */
export class StorageManager {
    /**
     * Stores data with automatic org-level duplication
     */
    static async store(key, data, orgKey) {
        const storage = await chrome.storage.local.get([STORAGE_KEYS.METADATA]);
        const metadata = storage[STORAGE_KEYS.METADATA] || {};

        // Store data for both specific key and org-level key
        metadata[key] = data;
        if (orgKey) {
            metadata[orgKey] = data;
        }

        await chrome.storage.local.set({
            [STORAGE_KEYS.METADATA]: metadata,
            [STORAGE_KEYS.LAST_UPDATED]: {
                ...storage[STORAGE_KEYS.LAST_UPDATED],
                [orgKey]: Date.now(),
            },
        });
    }

    /**
     * Cleans up old data for an org
     */
    static async cleanupOrgData(orgKey) {
        const storage = await chrome.storage.local.get([
            STORAGE_KEYS.METADATA,
            STORAGE_KEYS.COMMANDS,
            STORAGE_KEYS.LABELS,
        ]);

        // Remove old data for all keys associated with the org
        Object.keys(storage[STORAGE_KEYS.METADATA] || {}).forEach((key) => {
            if (key.startsWith(orgKey)) {
                delete storage[STORAGE_KEYS.METADATA][key];
            }
        });

        Object.keys(storage[STORAGE_KEYS.COMMANDS] || {}).forEach((key) => {
            if (key.startsWith(orgKey)) {
                delete storage[STORAGE_KEYS.COMMANDS][key];
            }
        });

        Object.keys(storage[STORAGE_KEYS.LABELS] || {}).forEach((key) => {
            if (key.startsWith(orgKey)) {
                delete storage[STORAGE_KEYS.LABELS][key];
            }
        });

        await chrome.storage.local.set(storage);
    }

    /**
     * Gets all data for a specific org
     */
    static async getOrgData(orgKey) {
        const storage = await chrome.storage.local.get([
            STORAGE_KEYS.METADATA,
            STORAGE_KEYS.COMMANDS,
            STORAGE_KEYS.LABELS,
            STORAGE_KEYS.LAST_UPDATED,
        ]);

        return {
            metadata: storage[STORAGE_KEYS.METADATA]?.[orgKey] || null,
            commands: storage[STORAGE_KEYS.COMMANDS]?.[orgKey] || null,
            labels: storage[STORAGE_KEYS.LABELS]?.[orgKey] || null,
            lastUpdated: storage[STORAGE_KEYS.LAST_UPDATED]?.[orgKey] || null,
        };
    }
}
