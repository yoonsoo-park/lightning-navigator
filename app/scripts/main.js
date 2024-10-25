// Global variables
let searchBox;
let resultsList;
let metaData;
let cookie;
let cmds = {};
let lastResults = [];
let mouseClickLoginAsEnabled = false;

// Constants
const KEY_UP = 38;
const KEY_DOWN = 40;
const ENTER = 13;
const TAB = 9;
const ESC = 27;
const HASH = "#";

// Initialize on document ready
document.addEventListener("DOMContentLoaded", function () {
  console.log("Lightning Navigator initialized"); // Debug log
  init();
});

// Initialize the extension
function init() {
  createSearchBox();

  // Listen for messages including the show command
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    console.log("Message received:", request); // Debug log

    if (request.cookie) {
      cookie = request.cookie;
      initializeMetadata();
    }

    if (request.action === "Show Command Bar") {
      console.log("Show command bar action received"); // Debug log
      showSearchBox();
      return true;
    }
  });

  // Add both Mousetrap and direct event listeners for the shortcut
  Mousetrap.bind(["ctrl+shift+space", "command+shift+space"], function (e) {
    console.log("Shortcut triggered via Mousetrap"); // Debug log
    showSearchBox();
    return false;
  });

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

// Show the search box
function showSearchBox() {
  console.log("Showing search box"); // Debug log
  const searchBox = document.getElementById("litnav_search_box");
  if (searchBox) {
    searchBox.classList.remove("litnav_hidden");
    const quickSearch = document.getElementById("litnav_quickSearch");
    if (quickSearch) {
      quickSearch.focus();
      quickSearch.value = "";
      console.log("Search box focused"); // Debug log
    } else {
      console.log("Quick search input not found"); // Debug log
    }
  } else {
    console.log("Search box element not found"); // Debug log
  }
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
