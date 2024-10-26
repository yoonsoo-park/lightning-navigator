class SalesforceSearch {
  constructor() {
    this.overlay = null;
    this.searchInput = null;
    this.resultsContainer = null;
    this.results = [];
    this.selectedIndex = -1;
    this.isVisible = false;
    this.setupOverlay();
    this.initializeEventListeners();
  }

  setupOverlay() {
    // Create overlay HTML
    const overlay = document.createElement("div");
    overlay.className = "sf-search-overlay";
    overlay.innerHTML = `
      <div class="sf-search-container">
        <input type="text" class="sf-search-input" placeholder="Search Salesforce...">
        <div class="sf-search-results"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.searchInput = overlay.querySelector(".sf-search-input");
    this.resultsContainer = overlay.querySelector(".sf-search-results");
  }

  async searchSalesforce(query) {
    try {
      // Get the session ID from the page
      const sessionId = await this.getSessionId();

      // Salesforce REST API endpoint for search
      const baseUrl = window.location.origin;
      const searchUrl = `${baseUrl}/services/data/v57.0/search/?q=FIND {${query}}`;

      const response = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${sessionId}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();
      return data.searchRecords || [];
    } catch (error) {
      console.error("Salesforce search error:", error);
      return [];
    }
  }

  async getSessionId() {
    // Get VF Sidebar element which contains the session ID
    const sidbarEl = document.querySelector(".sidebar");
    if (!sidbarEl) return null;

    // Extract session ID from the page
    // Note: This is a simplified example. You'll need to implement
    // proper session ID extraction based on your Salesforce org's setup
    return document.cookie.match(/sid=(.+?);/)?.[1];
  }

  renderResults(results) {
    this.results = results;
    this.resultsContainer.innerHTML = results
      .map(
        (result, index) => `
      <div class="sf-result-item ${
        index === this.selectedIndex ? "selected" : ""
      }" data-index="${index}">
        <div>${result.Name || result.Subject || "Unnamed"}</div>
        <small>${result.Type || result.Status || ""}</small>
      </div>
    `
      )
      .join("");
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

    // Update selection visual
    const items = this.resultsContainer.querySelectorAll(".sf-result-item");
    items.forEach((item) => item.classList.remove("selected"));
    items[this.selectedIndex]?.classList.add("selected");

    // Scroll into view if necessary
    items[this.selectedIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  selectCurrentItem() {
    if (this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
      const record = this.results[this.selectedIndex];
      const baseUrl = window.location.origin;
      const recordUrl = `${baseUrl}/${record.Id}`;
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

    // Search input handler
    let debounceTimeout;
    this.searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        const query = e.target.value;
        if (query.length >= 2) {
          const results = await this.searchSalesforce(query);
          this.renderResults(results);
        }
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
