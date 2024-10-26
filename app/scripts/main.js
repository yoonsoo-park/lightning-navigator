/// Global variables
let searchBox;
let resultsList;
let metaData;
let cookie;
let cmds = {};
let lastResults = [];

// Constants for key codes
const KEY_UP = 38;
const KEY_DOWN = 40;
const ENTER = 13;
const TAB = 9;
const ESC = 27;

// Initialize on document ready
document.addEventListener("DOMContentLoaded", function () {
  console.log("Lightning Navigator initializing..."); // Debug log
  init();
});

// Initialize the extension
function init() {
  console.log("Creating search box..."); // Debug log
  createSearchBox();

  // Listen for messages including the show command
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    console.log("Message received in content script:", request); // Debug log

    if (request.cookie) {
      console.log("Cookie received:", request.cookie); // Debug log
      cookie = request.cookie;
      initializeMetadata();
    }

    if (request.action === "Show Command Bar") {
      console.log("Show command bar action received in content script"); // Debug log
      showSearchBox();
      return true;
    }
  });

  // Add both Mousetrap and direct event listeners for the shortcut
  try {
    Mousetrap.bind(["ctrl+shift+space", "command+shift+space"], function (e) {
      console.log("Shortcut triggered via Mousetrap"); // Debug log
      showSearchBox();
      return false;
    });
  } catch (e) {
    console.error("Error binding Mousetrap shortcut:", e); // Debug log
  }

  // Add direct keyboard event listener as backup
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "Space") {
      console.log("Shortcut triggered via keydown"); // Debug log
      showSearchBox();
      e.preventDefault();
    }
  });
}

// Create and inject the search box HTML
function createSearchBox() {
  // Check if search box already exists
  if (document.getElementById("litnav_search_box")) {
    console.log("Search box already exists"); // Debug log
    return;
  }

  console.log("Injecting search box HTML"); // Debug log

  const boxHTML = `
        <div id="litnav_search_box" class="litnav_hidden" style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999999; background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            <input type="text" id="litnav_quickSearch" class="litnav_input" style="width: 500px; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Type to search..."/>
            <div id="litnav_results" style="max-height: 400px; overflow-y: auto; margin-top: 8px;"></div>
            <div id="litnav_loading" class="litnav_loading litnav_hidden">
                <img src="${chrome.runtime.getURL(
                  "images/ajax-loader.gif"
                )}" alt="Loading..." />
            </div>
        </div>
    `;

  const container = document.createElement("div");
  container.innerHTML = boxHTML;
  document.body.appendChild(container.firstElementChild);

  console.log("Search box created"); // Debug log

  searchBox = document.getElementById("litnav_quickSearch");
  resultsList = document.getElementById("litnav_results");

  if (searchBox && resultsList) {
    console.log("Search box elements initialized successfully"); // Debug log
    // Add event listeners
    searchBox.addEventListener("keyup", handleKeyUp);
    searchBox.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClickOutside);
  } else {
    console.error("Failed to initialize search box elements"); // Debug log
  }
}

function showSearchBox() {
  console.log("Attempting to show search box..."); // Debug log

  const searchBoxElement = document.getElementById("litnav_search_box");
  const quickSearchInput = document.getElementById("litnav_quickSearch");

  if (!searchBoxElement) {
    console.log("Search box not found, creating it..."); // Debug log
    createSearchBox();
  }

  // Try getting elements again after potential creation
  const finalSearchBox = document.getElementById("litnav_search_box");
  const finalQuickSearch = document.getElementById("litnav_quickSearch");

  if (finalSearchBox && finalQuickSearch) {
    console.log("Showing and focusing search box"); // Debug log
    finalSearchBox.classList.remove("litnav_hidden");
    finalQuickSearch.value = "";
    finalQuickSearch.focus();
  } else {
    console.error("Failed to show search box - elements not found"); // Debug log
  }
}

// Create and inject the search box HTML
function createSearchBox() {
  const boxHTML = `
        <div id="litnav_search_box" class="litnav_hidden">
            <input type="text" id="litnav_quickSearch" class="litnav_input" placeholder="Type to search..."/>
            <div id="litnav_results"></div>
            <div id="litnav_loading" class="litnav_loading litnav_hidden">
                <img src="${chrome.runtime.getURL(
                  "images/ajax-loader.svg"
                )}" alt="Loading..." />
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", boxHTML);

  searchBox = document.getElementById("litnav_quickSearch");
  resultsList = document.getElementById("litnav_results");

  // Add event listeners
  searchBox.addEventListener("keyup", handleKeyUp);
  searchBox.addEventListener("keydown", handleKeyDown);
  document.addEventListener("click", handleClickOutside);
}

// Hide the search box
function hideSearchBox() {
  const searchBox = document.getElementById("litnav_search_box");
  if (searchBox) {
    searchBox.classList.add("litnav_hidden");
    document.getElementById("litnav_quickSearch").value = "";
    clearResults();
  }
}

// Initialize metadata
function initializeMetadata() {
  chrome.runtime.sendMessage(
    { action: "Get Commands", key: cookie.domain },
    (response) => {
      if (response) {
        cmds = response;
      } else {
        refreshMetadata();
      }
    }
  );
}

// Refresh metadata
function refreshMetadata() {
  showLoadingIndicator();
  chrome.runtime.sendMessage({
    action: "Refresh Metadata",
    cookie: cookie,
    key: cookie.domain,
  });
}

// Handle keyup events
function handleKeyUp(e) {
  // Ignore special keys
  if ([KEY_UP, KEY_DOWN, ENTER, TAB, ESC].includes(e.keyCode)) {
    return;
  }

  const searchTerm = searchBox.value.trim();

  if (searchTerm === "") {
    clearResults();
    return;
  }

  // Handle special commands
  if (searchTerm.toLowerCase() === "refresh metadata") {
    refreshMetadata();
    return;
  }

  // Search and display results
  const results = searchCommands(searchTerm);
  displayResults(results);
}

// Handle keydown events
function handleKeyDown(e) {
  switch (e.keyCode) {
    case KEY_UP:
      selectPrevResult();
      e.preventDefault();
      break;
    case KEY_DOWN:
      selectNextResult();
      e.preventDefault();
      break;
    case ENTER:
      executeSelected();
      e.preventDefault();
      break;
    case ESC:
      hideSearchBox();
      e.preventDefault();
      break;
  }
}

// Search commands based on search term
function searchCommands(searchTerm) {
  const terms = searchTerm.toLowerCase().split(" ");
  return Object.entries(cmds)
    .filter(([cmd]) => terms.every((term) => cmd.toLowerCase().includes(term)))
    .map(([cmd, data]) => ({ cmd, data }))
    .slice(0, 10);
}

// Display search results
function displayResults(results) {
  lastResults = results;

  const html = results
    .map(
      (result, index) => `
        <div class="litnav_result ${
          index === 0 ? "selected" : ""
        }" data-index="${index}">
            ${result.cmd}
        </div>
    `
    )
    .join("");

  resultsList.innerHTML = html;
}

// Clear results
function clearResults() {
  lastResults = [];
  resultsList.innerHTML = "";
}

// Select next result
function selectNextResult() {
  const selected = resultsList.querySelector(".selected");
  if (selected && selected.nextElementSibling) {
    selected.classList.remove("selected");
    selected.nextElementSibling.classList.add("selected");
  }
}

// Select previous result
function selectPrevResult() {
  const selected = resultsList.querySelector(".selected");
  if (selected && selected.previousElementSibling) {
    selected.classList.remove("selected");
    selected.previousElementSibling.classList.add("selected");
  }
}

// Execute selected command
function executeSelected() {
  const selected = resultsList.querySelector(".selected");
  if (selected) {
    const index = selected.dataset.index;
    const result = lastResults[index];
    if (result && result.data.url) {
      window.location.href = result.data.url;
    }
  }
  hideSearchBox();
}

// Handle clicks outside the search box
function handleClickOutside(e) {
  const searchBox = document.getElementById("litnav_search_box");
  if (searchBox && !searchBox.contains(e.target)) {
    hideSearchBox();
  }
}

// Show loading indicator
function showLoadingIndicator() {
  document.getElementById("litnav_loading").classList.remove("litnav_hidden");
}

// Hide loading indicator
function hideLoadingIndicator() {
  document.getElementById("litnav_loading").classList.add("litnav_hidden");
}
