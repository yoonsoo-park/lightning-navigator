import { ACTION_TYPES } from "../common/constants.js";
import { CommandBar } from "./components/CommandBar.js";
import { LabelsPanel } from "./components/LabelsPanel.js";

class LightningNavigator {
    constructor() {
        this.commandBar = null;
        this.labelsPanel = null;
        this.cookie = null;
        this.commands = null;
        this.initialized = false;

        // Initialize
        this.init();
    }

    async init() {
        try {
            console.log("Initializing LightningNavigator...");

            // Fetch cookie first
            const cookieResult = await this.fetchCookie();
            if (!cookieResult) {
                console.error("Failed to get cookie");
                return;
            }

            console.log("Cookie fetched successfully:", this.cookie);

            // Initialize UI components after cookie is available
            this.commandBar = new CommandBar(this.cookie);
            this.labelsPanel = new LabelsPanel(this.cookie);

            // Set up message listener
            chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

            // Set up keyboard shortcut listener
            document.addEventListener(
                "keydown",
                this.handleKeyboardShortcut.bind(this)
            );

            // Fetch initial metadata
            await this.refreshMetadata();

            this.initialized = true;
            console.log("LightningNavigator initialized successfully");
        } catch (error) {
            console.error("Initialization failed:", error);
        }
    }

    async fetchCookie() {
        try {
            console.log("Fetching cookie...");
            const response = await chrome.runtime.sendMessage({
                action: ACTION_TYPES.FETCH_COOKIE,
            });

            if (response?.cookie) {
                this.cookie = response.cookie;
                return true;
            }
            return false;
        } catch (error) {
            console.error("Failed to fetch cookie:", error);
            return false;
        }
    }

    async refreshMetadata() {
        try {
            console.log("Refreshing metadata...");
            if (!this.cookie) {
                throw new Error("Cookie not available");
            }

            const response = await chrome.runtime.sendMessage({
                action: ACTION_TYPES.REFRESH_METADATA,
                data: { cookie: this.cookie },
            });

            if (response?.commands) {
                this.commands = response.commands;
                this.commandBar?.updateCommands(response.commands);
                console.log("Metadata refreshed successfully");
            }
        } catch (error) {
            console.error("Failed to refresh metadata:", error);
        }
    }

    handleMessage = (message, sender, sendResponse) => {
        console.log("Received message:", message);
        const { action, data } = message;

        switch (action) {
            case ACTION_TYPES.SHOW_COMMAND_BAR:
                if (this.commandBar) {
                    this.commandBar.show();
                }
                break;

            case ACTION_TYPES.REFRESH_METADATA:
                if (data?.commands) {
                    this.commands = data.commands;
                    this.commandBar?.updateCommands(data.commands);
                }
                break;
        }
    };

    handleKeyboardShortcut = (event) => {
        if (
            event.key === " " &&
            (event.metaKey || event.ctrlKey) &&
            event.shiftKey
        ) {
            event.preventDefault();
            this.commandBar?.show();
        }
    };
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        () => new LightningNavigator()
    );
} else {
    new LightningNavigator();
}
