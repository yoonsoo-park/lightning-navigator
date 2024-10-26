class SalesforceSearch {
  constructor() {
    this.api = new SalesforceToolingAPI();
    this.overlay = null;
    this.searchInput = null;
    this.resultsContainer = null;
    this.results = [];
    this.selectedIndex = -1;
    this.isVisible = false;
  }

  async initialize() {
    try {
      await this.api.initialize();
      this.setupOverlay();
      this.initializeEventListeners();
      console.log("SalesforceSearch initialized successfully");
    } catch (error) {
      console.error("Failed to initialize SalesforceSearch:", error);
    }
  }

  setupOverlay() {
    const styles = document.createElement("style");
    styles.textContent = `
      .sf-search-overlay {
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        width: 600px;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-radius: 8px;
        z-index: 999999;
        display: none;
      }

      .sf-search-container {
        padding: 16px;
      }

      .sf-search-input {
        width: 100%;
        padding: 12px;
        font-size: 16px;
        border: 2px solid #ddd;
        border-radius: 4px;
        margin-bottom: 8px;
        outline: none;
      }

      .sf-search-input:focus {
        border-color: #1a73e8;
      }

      .sf-search-results {
        max-height: 400px;
        overflow-y: auto;
      }

      .sf-result-item {
        padding: 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        transition: background-color 0.2s;
      }

      .sf-result-item.selected {
        background-color: #f0f9ff;
      }

      .sf-result-item:hover {
        background-color: #f5f5f5;
      }

      .sf-result-title {
        font-weight: 600;
        color: #2d3748;
      }

      .sf-result-subtitle {
        color: #4a5568;
        font-size: 0.9em;
        margin-top: 2px;
      }

      .sf-result-details {
        color: #718096;
        font-size: 0.85em;
        margin-top: 4px;
      }
    `;
    document.head.appendChild(styles);

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "sf-search-overlay";
    overlay.innerHTML = `
      <div class="sf-search-container">
        <input type="text" class="sf-search-input" placeholder="Search Salesforce (type to search)...">
        <div class="sf-search-results"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.searchInput = overlay.querySelector(".sf-search-input");
    this.resultsContainer = overlay.querySelector(".sf-search-results");

    console.log("Search overlay setup complete");
  }

  initializeEventListeners() {
    // Listen for keyboard shortcuts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Received message:", request);
      if (request.action === "toggle-search") {
        if (this.isVisible) {
          this.hide();
        } else {
          this.show();
        }
        sendResponse({ success: true });
        return true;
      }
    });

    // Search input handler
    let debounceTimeout;
    this.searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        const query = e.target.value;
        if (query.length < 2) {
          this.results = [];
          this.renderResults([]);
          return;
        }
        this.api.searchRecords(query, (results) => {
          this.renderResults(results);
        });
      }, 200);
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

    console.log("Event listeners initialized");
  }

  show() {
    console.log("Showing search overlay");
    this.isVisible = true;
    this.overlay.style.display = "block";
    this.searchInput.focus();
    this.selectedIndex = -1;
  }

  hide() {
    console.log("Hiding search overlay");
    this.isVisible = false;
    this.overlay.style.display = "none";
    this.searchInput.value = "";
    this.results = [];
    this.renderResults([]);
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

  renderResults(results) {
    // Merge new results with existing ones, removing duplicates
    this.results = Array.from(
      new Map([...this.results, ...results].map((r) => [r.id, r])).values()
    );

    this.resultsContainer.innerHTML = this.results.length
      ? this.results
          .map(
            (result, index) => `
        <div class="sf-result-item ${
          index === this.selectedIndex ? "selected" : ""
        }" data-index="${index}">
          <div class="sf-result-title">
            <span class="sf-result-type-icon">${this.getIconForType(
              result.type
            )}</span>
            ${result.title}
          </div>
          ${
            result.subtitle
              ? `<div class="sf-result-subtitle">${result.subtitle}</div>`
              : ""
          }
          <div class="sf-result-details">${result.details}</div>
        </div>
      `
          )
          .join("")
      : '<div class="sf-no-results">No results found</div>';
  }

  getIconForType(type) {
    const icons = {
      Account: "🏢",
      Contact: "👤",
      Opportunity: "💰",
      Case: "📋",
      Lead: "🎯",
    };
    return icons[type] || "📄";
  }
}

// Initialize the search when the page is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSearch);
} else {
  initializeSearch();
}

async function initializeSearch() {
  try {
    console.log("Initializing Salesforce Search...");
    const sfSearch = new SalesforceSearch();
    await sfSearch.initialize();

    // Additional check to ensure keyboard shortcut is working
    window.sfSearch = sfSearch; // Make it globally accessible for debugging
  } catch (error) {
    console.error("Failed to initialize search:", error);
  }
}
