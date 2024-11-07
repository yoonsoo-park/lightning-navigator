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
        this.isLoading = false;
        this.loadingStage = null; // 'initial', 'full', null
        this.retryCount = 0;
        this.maxRetries = 3;
        this.currentPage = 0;
        this.hasMoreResults = false;
        this.allResults = []; // Store all filtered results

        console.log("Initializing CommandBar with cookie:", cookie);

        // Create DOM elements
        this.createElements();

        // Initialize
        this.initialize();

        // Add debounced search records
        this.debouncedSearchRecords = this.debounce(
            this.searchRecords.bind(this),
            300
        );
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

        // Add scroll event listener
        this.resultsList.addEventListener(
            "scroll",
            this.handleScroll.bind(this)
        );

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

    async show() {
        this.visible = true;
        this.container.classList.add("visible");
        this.input.value = "";
        this.currentQuery = "";
        this.input.focus();

        // Try to load cached data first
        const cachedData = await this.loadCachedMetadata();
        if (cachedData) {
            this.updateCommands(cachedData);
            this.filterCommands("");
        }

        // Load fresh metadata in background if needed
        this.loadMetadataProgressively();
    }

    async loadCachedMetadata() {
        try {
            const key = `${this.cookie.domain}!${this.cookie.value.substring(
                0,
                15
            )}`;
            const response = await chrome.runtime.sendMessage({
                action: ACTION_TYPES.GET_COMMANDS,
                data: { key },
            });
            return response;
        } catch (error) {
            console.error("Failed to load cached metadata:", error);
            return null;
        }
    }

    async loadMetadataProgressively() {
        if (this.isLoading) return;

        try {
            this.isLoading = true;
            this.loadingStage = "initial";
            this.setLoadingState("Loading essential data");

            // Load essential metadata first (setup menu and objects)
            const initialData = await this.fetchMetadata(["setup", "objects"]);
            if (initialData) {
                this.updateCommands(initialData);
                this.filterCommands(this.currentQuery);
            }

            // Load full metadata in background
            this.loadingStage = "full";
            this.setLoadingState("Loading additional data");
            const fullData = await this.fetchMetadata([
                "apex",
                "visualforce",
                "flows",
            ]);
            if (fullData) {
                this.updateCommands({ ...this.commands, ...fullData });
                this.filterCommands(this.currentQuery);
            }
        } catch (error) {
            console.error("Failed to load metadata:", error);
            this.handleLoadError(error);
        } finally {
            this.isLoading = false;
            this.loadingStage = null;
            this.setLoadingState(null);
        }
    }

    setLoadingState(message) {
        const loadingEl = this.container.querySelector(
            ".lightning-nav-loading"
        );
        if (message) {
            if (!loadingEl) {
                const el = document.createElement("div");
                el.className = "lightning-nav-loading";
                el.innerHTML = `
                    ${message}
                    <div class="lightning-nav-loading-dots">
                        <div class="lightning-nav-loading-dot"></div>
                        <div class="lightning-nav-loading-dot"></div>
                        <div class="lightning-nav-loading-dot"></div>
                    </div>
                `;
                this.container.insertBefore(el, this.resultsList);
            } else {
                const textNode = loadingEl.firstChild;
                if (textNode) {
                    textNode.textContent = message;
                }
            }
        } else if (loadingEl) {
            loadingEl.remove();
        }
    }

    handleLoadError(error) {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            setTimeout(() => {
                this.loadMetadataProgressively();
            }, 1000 * this.retryCount); // Exponential backoff
        } else {
            this.showError(
                `Failed to load metadata: ${error.message}. Please try again later.`
            );
        }
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
        const PAGE_SIZE = 50;

        // Always reset pagination and results when query changes
        this.currentPage = 0;
        this.allResults = [];

        // If query is empty, clear results and return
        if (!normalizedQuery) {
            this.renderResults([]);
            return;
        }

        // First handle metadata commands
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

        // Store all results
        this.allResults = results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.name.localeCompare(b.name);
        });

        // Get current page of results
        const paginatedResults = this.allResults.slice(
            0,
            (this.currentPage + 1) * PAGE_SIZE
        );

        this.hasMoreResults = this.allResults.length > paginatedResults.length;

        // Render initial results
        this.renderResults(paginatedResults);

        // Then handle record search if query is long enough
        if (normalizedQuery.length >= 2) {
            try {
                this.setLoading(true);
                const recordResults = await this.searchRecords(normalizedQuery);

                // Transform record results into the correct format
                const formattedRecordResults = recordResults.map((record) => ({
                    name: record.name, // Use the already formatted name
                    command: {
                        ...record.command,
                        recordType: record.command.type, // Ensure record type is passed
                    },
                    score: record.score,
                }));

                // Combine results
                const combinedResults = [...results, ...formattedRecordResults]
                    .sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        return a.name.localeCompare(b.name);
                    })
                    .slice(0, PAGE_SIZE);

                // Only update if the query hasn't changed
                if (this.currentQuery.toLowerCase() === normalizedQuery) {
                    this.renderResults(combinedResults);
                }
            } catch (error) {
                console.error("Error searching records:", error);
            } finally {
                this.setLoading(false);
            }
        }
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
        if (this.currentPage === 0) {
            // Clear existing results only on first page
            while (this.resultsList.firstChild) {
                this.resultsList.removeChild(this.resultsList.firstChild);
            }

            // Remove existing click listener if any
            this.resultsList.removeEventListener(
                "click",
                this.handleResultClick
            );

            // Add new click listener for all results
            this.resultsList.addEventListener(
                "click",
                (this.handleResultClick = (e) => {
                    const resultItem = e.target.closest(
                        ".lightning-nav-result"
                    );
                    if (resultItem) {
                        const index = parseInt(resultItem.dataset.index, 10);
                        this.executeCommand(results[index].command);
                    }
                })
            );
        }

        if (
            results.length === 0 &&
            this.currentPage === 0 &&
            this.currentQuery.length != 0
        ) {
            const noResults = document.createElement("div");
            noResults.className = "lightning-nav-no-results";
            noResults.textContent = "No matching items found";
            this.resultsList.appendChild(noResults);
            return;
        }

        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();

        // Only render new results
        const startIndex = this.currentPage * 50;
        const newResults = results.slice(startIndex);

        newResults.forEach(({ name, command }, index) => {
            const item = document.createElement("div");
            item.className = "lightning-nav-result";

            const nameSpan = document.createElement("span");
            nameSpan.className = "lightning-nav-result-name";

            // Add icon for record results
            if (command.type === "record") {
                const icon = document.createElement("span");
                icon.className = "lightning-nav-result-icon";
                // Use different icons for different record types
                const iconMap = {
                    User: "👤",
                    Account: "🏢",
                    Contact: "📇",
                    Opportunity: "💰",
                    // Add more record types as needed
                    default: "📄",
                };
                icon.textContent =
                    iconMap[command.recordType] || iconMap.default;
                nameSpan.appendChild(icon);
            }

            // Apply highlighting
            if (this.currentQuery) {
                const segments = this.getHighlights(
                    name,
                    this.currentQuery.toLowerCase()
                );
                segments.forEach((segment) => {
                    const segmentSpan = document.createElement("span");
                    segmentSpan.textContent = segment.text;
                    if (segment.highlight) {
                        segmentSpan.className = "lightning-nav-highlight";
                    }
                    nameSpan.appendChild(segmentSpan);
                });
            } else {
                nameSpan.textContent = name;
            }

            item.appendChild(nameSpan);
            item.dataset.index = index;
            fragment.appendChild(item);
        });

        this.resultsList.appendChild(fragment);

        // Only update selection if this is the first page
        if (this.currentPage === 0) {
            this.updateSelection(0);
        }
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

    setLoading(isLoading, message = "Searching records...") {
        const existingSpinner = this.container.querySelector(
            ".lightning-nav-spinner"
        );

        if (isLoading && this.currentQuery.length >= 2) {
            // Only show spinner if actually searching
            if (!existingSpinner) {
                const spinner = document.createElement("div");
                spinner.className = "lightning-nav-spinner";
                spinner.innerHTML = `
                    <div class="lightning-nav-spinner-icon"></div>
                    <span class="lightning-nav-spinner-text">${message}</span>
                `;
                // Insert spinner before the results list
                this.container.insertBefore(spinner, this.resultsList);
            } else {
                existingSpinner.querySelector(
                    ".lightning-nav-spinner-text"
                ).textContent = message;
            }
        } else {
            existingSpinner?.remove();
        }
    }

    // Add debounce utility
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    updateRefreshStatus(status) {
        switch (status) {
            case "starting":
                this.setLoading(true, "Fetching essential metadata...");
                break;
            case "fetching_additional":
                this.setLoading(true, "Fetching additional metadata...");
                break;
            case "storing":
                this.setLoading(true, "Storing metadata...");
                break;
            case "complete":
                this.setLoading(false);
                break;
            case "error":
                this.setLoading(false);
                this.showError("Metadata refresh failed");
                break;
        }
    }

    async fetchMetadata(types) {
        try {
            if (!this.cookie) {
                throw new Error("Cookie not available");
            }

            const key = `${this.cookie.domain}!${this.cookie.value.substring(
                0,
                15
            )}`;

            // Send message to background script to fetch metadata
            const response = await chrome.runtime.sendMessage({
                action: ACTION_TYPES.REFRESH_METADATA,
                data: {
                    cookie: this.cookie,
                    key: key,
                    types: types, // Pass specific types to fetch
                },
            });

            if (response?.commands) {
                return response.commands;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch metadata:", error);
            throw error;
        }
    }

    handleScroll(event) {
        if (this.isLoading || !this.hasMoreResults) return;

        const container = event.target;
        const scrollPosition = container.scrollTop + container.clientHeight;
        const scrollThreshold = container.scrollHeight - 100; // Load more when 100px from bottom

        if (scrollPosition >= scrollThreshold) {
            this.loadMoreResults();
        }
    }

    loadMoreResults() {
        this.currentPage++;
        this.filterCommands(this.currentQuery);
    }
}
