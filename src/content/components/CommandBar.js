import { ACTION_TYPES } from "../../common/constants.js";

export class CommandBar {
    constructor(cookie) {
        if (!cookie) {
            throw new Error("Cookie is required for CommandBar initialization");
        }

        this.cookie = cookie;
        this.commands = null;
        this.visible = false;
        this.selectedIndex = -1;
        this.filterTimeout = null;
        this.currentQuery = "";

        console.log("Initializing CommandBar with cookie:", cookie);

        // Create DOM elements
        this.createElements();

        // Initialize
        this.initialize();
    }

    createElements() {
        console.log("Creating CommandBar elements...");

        // Main container
        this.container = document.createElement("div");
        this.container.className = "lightning-nav-command-bar";

        // Search input
        this.input = document.createElement("input");
        this.input.type = "text";
        this.input.className = "lightning-nav-search";
        this.input.placeholder =
            "Type to search Salesforce setup, metadata, and more...";

        // Results container
        this.resultsList = document.createElement("div");
        this.resultsList.className = "lightning-nav-results";

        // Assemble
        this.container.appendChild(this.input);
        this.container.appendChild(this.resultsList);
        document.body.appendChild(this.container);
    }

    async initialize() {
        try {
            console.log("Initializing CommandBar...");

            // Set up event listeners first
            this.setupEventListeners();

            // Add message listener for metadata refresh
            this.setupMessageListener();

            // Fetch initial commands
            await this.fetchCommands();

            console.log("CommandBar initialized successfully");
        } catch (error) {
            console.error("CommandBar initialization failed:", error);
        }
    }

    setupEventListeners() {
        console.log("Setting up event listeners");

        // Input event for handling text changes
        this.input.addEventListener("input", (event) => {
            this.currentQuery = event.target.value;
            if (this.filterTimeout) {
                clearTimeout(this.filterTimeout);
            }
            this.filterTimeout = setTimeout(() => {
                this.filterCommands(this.currentQuery);
            }, 150);
        });

        // Keydown event for navigation
        this.input.addEventListener("keydown", this.handleKeydown.bind(this));

        // Click outside event
        document.addEventListener("click", this.handleClickOutside.bind(this));

        console.log("Event listeners setup complete");
    }

    setupMessageListener() {
        console.log("Setting up message listener");

        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                console.log("CommandBar received message:", message);

                if (message.action === ACTION_TYPES.REFRESH_METADATA) {
                    console.log("Received metadata refresh:", message.commands);
                    this.updateCommands(message.commands);
                    return true;
                }

                return false;
            }
        );

        console.log("Message listener setup complete");
    }

    async fetchCommands() {
        try {
            console.log("Fetching commands...");
            if (!this.cookie) {
                throw new Error("Cookie not available");
            }

            const key = `${this.cookie.domain}!${this.cookie.value.substring(
                0,
                15
            )}`;

            // First try to get existing commands
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        action: ACTION_TYPES.GET_COMMANDS,
                        data: { key },
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(response);
                        }
                    }
                );
            });

            if (response) {
                console.log("Commands received:", response);
                this.updateCommands(response);
            } else {
                console.log(
                    "No commands received, initiating metadata refresh"
                );

                const refreshResponse = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        {
                            action: ACTION_TYPES.REFRESH_METADATA,
                            data: {
                                cookie: this.cookie,
                                key: key,
                            },
                        },
                        (response) => {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve(response);
                            }
                        }
                    );
                });

                if (refreshResponse && refreshResponse.commands) {
                    console.log(
                        "Received commands from refresh:",
                        refreshResponse.commands
                    );
                    this.updateCommands(refreshResponse.commands);
                } else {
                    console.warn("No commands received from refresh");
                }
            }
        } catch (error) {
            console.error("Failed to fetch commands:", error);
            // Handle error appropriately
            this.showError("Failed to fetch commands. Please try again.");
        }
    }

    showError(message) {
        // Add this method to show errors to the user
        const errorDiv = document.createElement("div");
        errorDiv.className = "lightning-nav-error";
        errorDiv.textContent = message;
        this.container.insertBefore(errorDiv, this.resultsList);

        // Remove error after 3 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    updateCommands(commands) {
        if (!commands) {
            console.warn("Received null or undefined commands");
            return;
        }

        console.log("Updating commands:", Object.keys(commands).length);
        this.commands = commands;

        // If visible, refresh the current search
        if (this.visible) {
            this.filterCommands(this.currentQuery);
        }
    }

    show() {
        console.log("Showing command bar");
        this.visible = true;
        this.container.classList.add("visible");
        this.input.value = "";
        this.currentQuery = "";
        this.input.focus();
        this.filterCommands("");
    }

    hide() {
        this.visible = false;
        this.container.classList.remove("visible");
        this.input.value = "";
        this.currentQuery = "";
        this.selectedIndex = -1;
    }

    async filterCommands(query) {
        console.log("Filtering commands with query:", query);
        if (!this.commands) {
            console.warn("No commands available for filtering");
            this.renderResults([]);
            return;
        }

        const results = [];
        const normalizedQuery = query.toLowerCase();

        // If query is at least 2 characters, search for records
        if (normalizedQuery.length >= 2) {
            try {
                // Search for records in parallel with metadata search
                const recordResults = await this.searchRecords(normalizedQuery);
                results.push(...recordResults);
            } catch (error) {
                console.error("Error searching records:", error);
            }
        }

        // Search metadata commands
        Object.entries(this.commands).forEach(([name, command]) => {
            if (!command) return;

            const normalizedName = name.toLowerCase();
            let score = 0;

            if (normalizedName === normalizedQuery) {
                score = 1;
            } else if (normalizedName.startsWith(normalizedQuery)) {
                score = 0.9;
            } else if (normalizedName.includes(normalizedQuery)) {
                score = 0.7;
            } else if (
                command.synonyms?.some((syn) =>
                    syn.toLowerCase().includes(normalizedQuery)
                )
            ) {
                score = 0.6;
            } else if (name.includes(" > ")) {
                const parts = name.split(" > ");
                if (
                    parts.some((part) =>
                        part.toLowerCase().includes(normalizedQuery)
                    )
                ) {
                    score = 0.5;
                }
            }

            if (score > 0) {
                results.push({
                    name,
                    command,
                    score,
                });
            }
        });

        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.name.localeCompare(b.name);
        });

        console.log(`Found ${results.length} matching items`);
        this.renderResults(results);
    }

    async searchRecords(query) {
        const results = [];
        const searchObjects = ["User", "Account", "Contact"]; // Add more objects as needed

        try {
            // Send message to background script to perform SOSL search
            const response = await chrome.runtime.sendMessage({
                action: ACTION_TYPES.SEARCH_RECORDS,
                data: {
                    cookie: this.cookie,
                    query,
                    objects: searchObjects,
                },
            });

            if (response?.records) {
                response.records.forEach((record) => {
                    results.push({
                        name: `${record.type}: ${record.Name}`,
                        command: {
                            url: `/lightning/r/${record.type}/${record.Id}/view`,
                            key: record.Id,
                            type: "record",
                        },
                        score: 0.95, // Give records high priority
                    });
                });
            }
        } catch (error) {
            console.error("Error searching records:", error);
        }

        return results;
    }

    getHighlights(text, query) {
        const segments = [];
        let lastIndex = 0;
        const normalizedText = text.toLowerCase();
        const indices = [];

        // Find all occurrences of the query
        let index = normalizedText.indexOf(query);
        while (index !== -1) {
            indices.push(index);
            index = normalizedText.indexOf(query, index + 1);
        }

        // Create segments with highlighting
        indices.forEach((start) => {
            const end = start + query.length;
            if (start > lastIndex) {
                segments.push({
                    text: text.substring(lastIndex, start),
                    highlight: false,
                });
            }
            segments.push({
                text: text.substring(start, end),
                highlight: true,
            });
            lastIndex = end;
        });

        if (lastIndex < text.length) {
            segments.push({
                text: text.substring(lastIndex),
                highlight: false,
            });
        }

        return segments;
    }

    renderResults(results) {
        this.resultsList.innerHTML = "";
        this.selectedIndex = -1;

        if (results.length === 0) {
            const noResults = document.createElement("div");
            noResults.className = "lightning-nav-no-results";
            noResults.textContent = "No matching items found";
            this.resultsList.appendChild(noResults);
            return;
        }

        results.forEach(({ name, command }, index) => {
            const item = document.createElement("div");
            item.className = "lightning-nav-result";

            const nameSpan = document.createElement("span");
            nameSpan.className = "lightning-nav-result-name";

            // Add icon for record results
            if (command.type === "record") {
                const icon = document.createElement("span");
                icon.className = "lightning-nav-result-icon";
                icon.textContent = "📄 "; // You can replace this with an actual icon
                nameSpan.appendChild(icon);
            }

            const textSpan = document.createElement("span");
            textSpan.textContent = name;
            nameSpan.appendChild(textSpan);

            item.appendChild(nameSpan);
            item.addEventListener("click", () => {
                this.executeCommand(command);
            });

            this.resultsList.appendChild(item);
        });

        this.updateSelection(0);
    }

    handleKeydown(event) {
        const results = this.resultsList.querySelectorAll(
            ".lightning-nav-result"
        );
        const resultsCount = results.length;

        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                this.updateSelection(
                    Math.min(this.selectedIndex + 1, resultsCount - 1)
                );
                break;

            case "ArrowUp":
                event.preventDefault();
                this.updateSelection(Math.max(this.selectedIndex - 1, 0));
                break;

            case "Enter":
                event.preventDefault();
                if (this.selectedIndex >= 0 && results[this.selectedIndex]) {
                    const command = this.getCommandFromResults(
                        this.selectedIndex
                    );
                    if (command) {
                        this.executeCommand(command);
                    }
                }
                break;

            case "Escape":
                event.preventDefault();
                this.hide();
                break;
        }
    }

    updateSelection(index) {
        const results = this.resultsList.querySelectorAll(
            ".lightning-nav-result"
        );
        results.forEach((result, i) => {
            if (i === index) {
                result.classList.add("selected");
                result.scrollIntoView({ block: "nearest" });
            } else {
                result.classList.remove("selected");
            }
        });
        this.selectedIndex = index;
    }

    getCommandFromResults(index) {
        const results = this.resultsList.querySelectorAll(
            ".lightning-nav-result"
        );
        const item = results[index];
        if (!item) return null;

        const name = item.querySelector(
            ".lightning-nav-result-name"
        ).textContent;
        return this.commands[name];
    }

    executeCommand(command) {
        if (!command?.url) return;

        const url = command.url.startsWith("http")
            ? command.url
            : `https://${this.cookie.domain}${command.url}`;

        window.location.href = url;
        this.hide();
    }

    handleClickOutside(event) {
        if (this.visible && !this.container.contains(event.target)) {
            this.hide();
        }
    }
}
