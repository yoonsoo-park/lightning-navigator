// tooling-api.js
class SalesforceToolingAPI {
  constructor() {
    this.sessionId = null;
    this.instanceUrl = null;
    this.apiVersion = "v57.0";
  }

  async initialize() {
    // Get session ID from Salesforce page
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("sid="));
    if (cookie) {
      this.sessionId = cookie.split("=")[1];
    }

    // Get instance URL
    this.instanceUrl = window.location.origin;
  }

  async query(soqlQuery) {
    try {
      const response = await fetch(
        `${this.instanceUrl}/services/data/${
          this.apiVersion
        }/tooling/query/?q=${encodeURIComponent(soqlQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${this.sessionId}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Query failed");
      return await response.json();
    } catch (error) {
      console.error("Tooling API error:", error);
      throw error;
    }
  }

  async searchRecords(searchTerm) {
    // Combine SOSL search across multiple objects
    const sosl = `FIND {${searchTerm}} IN ALL FIELDS RETURNING 
      Account(Id, Name, Type WHERE IsDeleted=false LIMIT 5),
      Contact(Id, Name, Title WHERE IsDeleted=false LIMIT 5),
      Opportunity(Id, Name, StageName WHERE IsDeleted=false LIMIT 5),
      Case(Id, CaseNumber, Subject WHERE IsDeleted=false LIMIT 5),
      Lead(Id, Name, Company WHERE IsDeleted=false LIMIT 5)`;

    try {
      const response = await fetch(
        `${this.instanceUrl}/services/data/${
          this.apiVersion
        }/search/?q=${encodeURIComponent(sosl)}`,
        {
          headers: {
            Authorization: `Bearer ${this.sessionId}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      return this.formatSearchResults(data);
    } catch (error) {
      console.error("Search API error:", error);
      throw error;
    }
  }

  formatSearchResults(data) {
    const results = [];

    // Format results from each object type
    for (const key in data) {
      if (Array.isArray(data[key])) {
        data[key].forEach((record) => {
          results.push({
            id: record.Id,
            title: record.Name || record.Subject || record.CaseNumber,
            type: key,
            subtitle:
              record.Type ||
              record.Title ||
              record.StageName ||
              record.Company ||
              "",
          });
        });
      }
    }

    return results;
  }
}

// content.js
class SalesforceSearch {
  constructor() {
    this.api = new SalesforceToolingAPI();
    this.overlay = null;
    this.searchInput = null;
    this.resultsContainer = null;
    this.results = [];
    this.selectedIndex = -1;
    this.isVisible = false;
    this.setupOverlay();
    this.initializeEventListeners();
  }

  async initialize() {
    await this.api.initialize();
  }

  setupOverlay() {
    // Create overlay HTML
    const overlay = document.createElement("div");
    overlay.className = "sf-search-overlay";
    overlay.innerHTML = `
      <div class="sf-search-container">
        <input type="text" class="sf-search-input" placeholder="Search Salesforce (Accounts, Contacts, Opportunities, Cases, Leads)...">
        <div class="sf-search-results"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.searchInput = overlay.querySelector(".sf-search-input");
    this.resultsContainer = overlay.querySelector(".sf-search-results");
  }

  async handleSearch(query) {
    if (query.length < 2) return;

    try {
      const results = await this.api.searchRecords(query);
      this.renderResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      this.renderError(
        "Search failed. Please make sure you are logged into Salesforce."
      );
    }
  }

  renderResults(results) {
    this.results = results;
    this.resultsContainer.innerHTML = results
      .map(
        (result, index) => `
      <div class="sf-result-item ${
        index === this.selectedIndex ? "selected" : ""
      }" data-index="${index}">
        <div class="flex items-center justify-between">
          <div class="font-medium">${result.title}</div>
          <div class="text-sm text-gray-500">${result.type}</div>
        </div>
        ${
          result.subtitle
            ? `<div class="text-sm text-gray-600">${result.subtitle}</div>`
            : ""
        }
      </div>
    `
      )
      .join("");
  }

  renderError(message) {
    this.resultsContainer.innerHTML = `
      <div class="sf-error-message">
        ${message}
      </div>
    `;
  }

  show() {
    this.isVisible = true;
    this.overlay.style.display = "block";
    this.searchInput.focus();
  }

  hide() {
    this.isVisible = false;
    this.overlay.style.display = "none";
    this.searchInput.value = "";
    this.resultsContainer.innerHTML = "";
    this.selectedIndex = -1;
  }

  navigateResults(direction) {
    const maxIndex = this.results.length - 1;
    if (maxIndex < 0) return;

    if (direction === "up") {
      this.selectedIndex =
        this.selectedIndex <= 0 ? maxIndex : this.selectedIndex - 1;
    } else {
      this.selectedIndex =
        this.selectedIndex >= maxIndex ? 0 : this.selectedIndex + 1;
    }

    const items = this.resultsContainer.querySelectorAll(".sf-result-item");
    items.forEach((item) => item.classList.remove("selected"));
    items[this.selectedIndex]?.classList.add("selected");

    items[this.selectedIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  selectCurrentItem() {
    if (this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
      const record = this.results[this.selectedIndex];
      const recordUrl = `${this.api.instanceUrl}/${record.id}`;
      window.location.href = recordUrl;
    }
  }

  initializeEventListeners() {
    // Listen for keyboard shortcuts from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "toggle-search") {
        if (this.isVisible) {
          this.hide();
        } else {
          this.show();
        }
      }
    });

    // Search input handler with debouncing
    let debounceTimeout;
    this.searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        this.handleSearch(e.target.value);
      }, 300);
    });

    // Keyboard navigation
    this.searchInput.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          this.navigateResults("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          this.navigateResults("down");
          break;
        case "Enter":
          e.preventDefault();
          this.selectCurrentItem();
          break;
        case "Escape":
          e.preventDefault();
          this.hide();
          break;
      }
    });

    // Click handler for results
    this.resultsContainer.addEventListener("click", (e) => {
      const resultItem = e.target.closest(".sf-result-item");
      if (resultItem) {
        this.selectedIndex = parseInt(resultItem.dataset.index);
        this.selectCurrentItem();
      }
    });
  }
}

// Initialize the search when content script loads
const sfSearch = new SalesforceSearch();
sfSearch.initialize();
