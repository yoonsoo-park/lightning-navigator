import { ACTION_TYPES, STORAGE_KEYS } from "../common/constants.js";
import { handleFetchCookie } from "./actions/fetchCookie.js";
import { handleGetCommands } from "./actions/getCommands.js";
import { handleGetMetadata } from "./actions/getMetadata.js";
import { handleRefreshMetadata } from "./actions/refreshMetadata.js";
import { handleQueryLabels } from "./actions/queryLabels.js";
import { handleSearchRecords } from "./actions/searchRecords.js";

// Register message handlers at the top level
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Service worker received message:", message);

    const { action, data } = message;

    // Create handler map
    const handlers = {
        [ACTION_TYPES.FETCH_COOKIE]: handleFetchCookie,
        [ACTION_TYPES.GET_COMMANDS]: handleGetCommands,
        [ACTION_TYPES.GET_METADATA]: handleGetMetadata,
        [ACTION_TYPES.REFRESH_METADATA]: handleRefreshMetadata,
        [ACTION_TYPES.QUERY_LABELS]: handleQueryLabels,
        [ACTION_TYPES.SEARCH_RECORDS]: handleSearchRecords,
    };

    // Get handler for action
    const handler = handlers[action];
    if (!handler) {
        console.warn(`No handler found for action: ${action}`);
        return false;
    }

    // Execute handler
    try {
        handler(data, sender)
            .then((response) => {
                console.log(`Handler response for ${action}:`, response);
                sendResponse(response);
            })
            .catch((error) => {
                console.error(`Error in handler ${action}:`, error);
                sendResponse({ error: error.message });
            });
    } catch (error) {
        console.error(`Error executing handler ${action}:`, error);
        sendResponse({ error: error.message });
    }

    // Keep message channel open
    return true;
});

// Handle keyboard command
chrome.commands.onCommand.addListener((command) => {
    if (command === "show-command-bar") {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab) {
                chrome.tabs.sendMessage(tab.id, {
                    action: ACTION_TYPES.SHOW_COMMAND_BAR,
                });
            }
        });
    }
});

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        [STORAGE_KEYS.COMMANDS]: {},
        [STORAGE_KEYS.METADATA]: {},
        [STORAGE_KEYS.LABELS]: {},
        [STORAGE_KEYS.LAST_UPDATED]: {},
    });
});

// Keep service worker alive
const keepAlive = () => {
    chrome.runtime.onConnect.addListener((port) => {
        console.log("Service worker connected");
        port.onDisconnect.addListener(() => {
            console.log("Service worker disconnected");
        });
    });
};

keepAlive();
