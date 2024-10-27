import {
    API_PATHS,
    METADATA_TYPES,
    STORAGE_KEYS,
    ACTION_TYPES,
} from "../../common/constants.js";

/**
 * Creates or gets the offscreen document
 */
async function getOffscreenDocument() {
    try {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
        });

        if (existingContexts.length > 0) {
            return true;
        }

        await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL("offscreen.html"),
            reasons: ["DOM_PARSER"],
            justification: "Parse setup menu HTML",
        });
        return true;
    } catch (error) {
        console.error("Error creating offscreen document:", error);
        return false;
    }
}

/**
 * Fetches setup menu items using offscreen document
 */
const fetchSetupTree = async (cookie) => {
    const { domain, value } = cookie;
    const url = `https://${domain}/ui/setup/Setup`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${value}` },
    });

    const html = await response.text();

    // Ensure offscreen document is available
    await getOffscreenDocument();

    // Parse HTML in offscreen document
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            {
                action: "parseSetupHtml",
                html,
            },
            (response) => {
                if (chrome.runtime.lastError || !response) {
                    console.error(
                        "Error parsing setup HTML:",
                        chrome.runtime.lastError
                    );
                    resolve({});
                } else {
                    resolve(response.setupItems);
                }
            }
        );
    });
};

/**
 * Fetches object metadata
 */
const fetchObjectMetadata = async (cookie) => {
    const { domain, value } = cookie;
    const url = `https://${domain}/${API_PATHS.data}/sobjects/`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${value}` },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch object metadata");
    }

    const data = await response.json();
    const objects = {};

    data.sobjects.forEach((obj) => {
        if (obj.keyPrefix) {
            const { label, labelPlural, keyPrefix, name } = obj;

            // Add List view command
            const listName =
                name.includes("__") && !name.endsWith("__c")
                    ? `List ${labelPlural} (${name.split("__")[0]})`
                    : `List ${labelPlural}`;

            objects[listName] = {
                key: name,
                keyPrefix,
                url: `https://${domain}/${keyPrefix}`,
                synonyms: [name],
            };

            // Add New record command
            objects[`New ${label}`] = {
                key: name,
                keyPrefix,
                url: `https://${domain}/${keyPrefix}/e`,
                synonyms: [name],
            };
        }
    });

    return objects;
};

/**
 * Fetches metadata using SOQL query
 */
const queryMetadata = async (cookie, type, query) => {
    const { domain, value } = cookie;
    const url = `https://${domain}/${
        API_PATHS.tooling
    }/query/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${value}` },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch ${type} metadata`);
    }

    const data = await response.json();
    return data.records || [];
};

/**
 * Main handler for metadata refresh
 */
export const handleRefreshMetadata = async (data, sender) => {
    const { cookie } = data;

    // Generate the key from cookie data
    const key = `${cookie.domain}!${cookie.value.substring(0, 15)}`;
    console.log("Refreshing metadata for key:", key);
    const orgKey = key.split("!")[0];

    const commands = {
        "Refresh Metadata": {},
        Setup: {},
        Objects: {},
    };

    try {
        // Fetch all metadata in parallel
        const [
            setupItems,
            objectMetadata,
            customObjects,
            apexClasses,
            visualforcePages,
            flows,
        ] = await Promise.all([
            fetchSetupTree(cookie),
            fetchObjectMetadata(cookie),
            queryMetadata(
                cookie,
                METADATA_TYPES.CUSTOM_OBJECT,
                `SELECT Id, DeveloperName, NamespacePrefix, ManageableState 
                     FROM CustomObject 
                     WHERE ManageableState = 'unmanaged'`
            ),
            queryMetadata(
                cookie,
                METADATA_TYPES.APEX_CLASS,
                `SELECT Id, Name, NamespacePrefix 
                     FROM ApexClass`
            ),
            queryMetadata(
                cookie,
                METADATA_TYPES.VISUALFORCE_PAGE,
                `SELECT Id, Name, NamespacePrefix 
                     FROM ApexPage`
            ),
            queryMetadata(
                cookie,
                METADATA_TYPES.FLOW,
                `SELECT Id, DeveloperName 
                     FROM FlowDefinition`
            ),
        ]);

        // Combine metadata
        Object.assign(commands, setupItems, objectMetadata);

        // Process custom objects
        customObjects.forEach((obj) => {
            if (!obj.NamespacePrefix || obj.ManageableState === "unmanaged") {
                const name = `${
                    obj.NamespacePrefix ? obj.NamespacePrefix + "__" : ""
                }${obj.DeveloperName}__c`;
                commands[`Setup > Custom Object > ${name}`] = {
                    key: obj.DeveloperName,
                    keyPrefix: obj.Id,
                    url: `/lightning/setup/ObjectManager/${obj.Id}/view`,
                };
            }
        });

        // Store updated metadata
        const storage = await chrome.storage.local.get([
            STORAGE_KEYS.COMMANDS,
            STORAGE_KEYS.LAST_UPDATED,
        ]);

        const allCommands = storage[STORAGE_KEYS.COMMANDS] || {};
        const lastUpdated = storage[STORAGE_KEYS.LAST_UPDATED] || {};

        // Clear old org data
        Object.keys(allCommands).forEach((k) => {
            if (k.startsWith(orgKey)) {
                delete allCommands[k];
            }
        });

        // Store new data
        allCommands[key] = allCommands[orgKey] = commands;
        lastUpdated[orgKey] = Date.now();

        await chrome.storage.local.set({
            [STORAGE_KEYS.COMMANDS]: allCommands,
            [STORAGE_KEYS.LAST_UPDATED]: lastUpdated,
        });

        // Notify content script with the new commands
        if (sender?.tab?.id) {
            await chrome.tabs.sendMessage(sender.tab.id, {
                action: ACTION_TYPES.REFRESH_METADATA,
                commands: commands,
            });
        }

        // Return the commands in the response
        return { success: true, commands: commands };
    } catch (error) {
        console.error("Metadata refresh failed:", error);
        throw error;
    }
};
