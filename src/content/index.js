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
        this.isMetadataLoading = false;
        this.lastMetadataUpdate = null;

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

            // Pre-fetch metadata immediately after cookie is available
            await this.refreshMetadata();

            // Set up periodic metadata refresh (e.g., every 5 minutes)
            setInterval(() => this.refreshMetadata(true), 5 * 60 * 1000);

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

    async refreshMetadata(background = false) {
        if (this.isMetadataLoading) return;

        try {
            this.isMetadataLoading = true;
            if (!background) {
                this.commandBar?.setLoading(true);
            }

            console.log("Refreshing metadata...");
            if (!this.cookie) {
                throw new Error("Cookie not available");
            }

            // Add retry logic
            let attempts = 0;
            const maxAttempts = 3;
            let lastError;

            while (attempts < maxAttempts) {
                try {
                    const response = await chrome.runtime.sendMessage({
                        action: ACTION_TYPES.REFRESH_METADATA,
                        data: { cookie: this.cookie },
                    });

                    if (response?.commands) {
                        this.commands = response.commands;
                        this.commandBar?.updateCommands(response.commands);
                        console.log("Metadata refreshed successfully");
                        this.lastMetadataUpdate = Date.now();
                        return;
                    }

                    // Wait before retry
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    attempts++;
                } catch (error) {
                    lastError = error;
                    console.warn(
                        `Metadata refresh attempt ${attempts + 1} failed:`,
                        error
                    );
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    attempts++;
                }
            }

            throw (
                lastError ||
                new Error("Failed to refresh metadata after multiple attempts")
            );
        } finally {
            this.isMetadataLoading = false;
            if (!background) {
                this.commandBar?.setLoading(false);
            }
        }
    }

    handleMessage = (message, sender, sendResponse) => {
        console.log("Received message:", message);
        const { action, data } = message;

        switch (action) {
            case ACTION_TYPES.SHOW_COMMAND_BAR:
                if (this.commandBar) {
                    // Check if metadata needs refresh (e.g., older than 5 minutes)
                    const shouldRefresh =
                        !this.lastMetadataUpdate ||
                        Date.now() - this.lastMetadataUpdate > 5 * 60 * 1000;

                    if (shouldRefresh) {
                        this.refreshMetadata(true); // Refresh in background
                    }
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
