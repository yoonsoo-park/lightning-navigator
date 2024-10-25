let searchBox;
let resultsList;
let isInitialized = false;
let cookie;
let cmds = {};

// Initialize on document ready
document.addEventListener("DOMContentLoaded", function () {
  console.log("Document ready, initializing Lightning Navigator");
  init();
});

// Initialize the extension
function init() {
  if (!isInitialized) {
    createSearchBox();
    initializeMessageListener();
    initializeKeyboardShortcut();
    chrome.runtime.sendMessage({ action: "Loaded" });
    isInitialized = true;
    console.log("Lightning Navigator initialized");
  }
}

function initializeMessageListener() {
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    console.log("Message received:", request);

    if (request.action === "Show Command Bar") {
      console.log("Show command received, displaying search box");
      showSearchBox();
      return true;
    }

    if (request.cookie) {
      cookie = request.cookie;
      initializeMetadata();
    }

    if (request.action === "Refresh Metadata Success") {
      cmds = request.commands;
      hideLoadingIndicator();
    }
  });
}

function initializeMetadata() {
  chrome.runtime.sendMessage(
    { action: "Get Commands", key: cookie.domain },
    (response) => {
      if (response) {
        cmds = response;
        console.log("Commands loaded:", cmds);
      } else {
        refreshMetadata();
      }
    }
  );
}

function refreshMetadata() {
  showLoadingIndicator();
  chrome.runtime.sendMessage({
    action: "Refresh Metadata",
    cookie: cookie,
    key: cookie.domain,
  });
}

function initializeKeyboardShortcut() {
  Mousetrap.bind(["ctrl+shift+space", "command+shift+space"], function (e) {
    console.log("Keyboard shortcut triggered");
    showSearchBox();
    return false;
  });
}

function createSearchBox() {
  if (!document.getElementById("litnav_search_box")) {
    const boxHTML = `
            <div id="litnav_search_box" class="litnav_hidden">
                <input type="text" id="litnav_quickSearch" 
                       class="litnav_input" 
                       placeholder="Type to search..." />
                <div id="litnav_results"></div>
                <div id="litnav_loading" class="litnav_loading litnav_hidden">Loading...</div>
            </div>
        `;

    document.body.insertAdjacentHTML("beforeend", boxHTML);

    searchBox = document.getElementById("litnav_quickSearch");
    resultsList = document.getElementById("litnav_results");

    searchBox.addEventListener("keyup", handleKeyUp);
    searchBox.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClickOutside);
  }
}

function showSearchBox() {
  const searchBox = document.getElementById("litnav_search_box");
  const quickSearch = document.getElementById("litnav_quickSearch");

  if (searchBox && quickSearch) {
    searchBox.classList.remove("litnav_hidden");
    quickSearch.value = "";
    quickSearch.focus();
  } else {
    init();
  }
}

function hideSearchBox() {
  const searchBox = document.getElementById("litnav_search_box");
  if (searchBox) {
    searchBox.classList.add("litnav_hidden");
    const quickSearch = document.getElementById("litnav_quickSearch");
    if (quickSearch) {
      quickSearch.value = "";
    }
    clearResults();
  }
}

function handleKeyUp(e) {
  const KEY_UP = 38;
  const KEY_DOWN = 40;
  const ENTER = 13;
  const TAB = 9;
  const ESC = 27;

  // Ignore special keys
  if ([KEY_UP, KEY_DOWN, ENTER, TAB, ESC].includes(e.keyCode)) {
    return;
  }

  const searchTerm = searchBox.value.trim();
  console.log("Search term:", searchTerm);

  if (searchTerm === "") {
    clearResults();
    return;
  }

  // Special command handling
  if (searchTerm.toLowerCase() === "refresh metadata") {
    refreshMetadata();
    return;
  }

  // Search and display results
  const results = searchCommands(searchTerm);
  console.log("Search results:", results);
  displayResults(results);
}

function searchCommands(searchTerm) {
  const terms = searchTerm.toLowerCase().split(" ");
  const results = [];

  // Search through commands
  for (let key in cmds) {
    if (terms.every((term) => key.toLowerCase().includes(term))) {
      results.push({
        key: key,
        command: cmds[key],
      });
    }
  }

  // Sort results by relevance and limit to 10
  return results.sort((a, b) => a.key.length - b.key.length).slice(0, 10);
}

function displayResults(results) {
  console.log("Displaying results:", results);
  if (!resultsList) return;

  if (results.length === 0) {
    resultsList.innerHTML =
      '<div class="litnav_no_results">No results found</div>';
    return;
  }

  const html = results
    .map(
      (result, index) => `
        <div class="litnav_result ${index === 0 ? "selected" : ""}" 
             data-index="${index}" 
             data-url="${result.command.url || ""}"
             data-key="${result.key}">
            ${result.key}
        </div>
    `
    )
    .join("");

  resultsList.innerHTML = html;

  // Add click handlers to results
  const resultElements = resultsList.getElementsByClassName("litnav_result");
  Array.from(resultElements).forEach((element) => {
    element.addEventListener("click", handleResultClick);
    element.addEventListener("mouseover", handleResultHover);
  });
}

function handleResultClick(e) {
  const element = e.currentTarget;
  const url = element.getAttribute("data-url");
  if (url) {
    window.location.href = url;
  }
  hideSearchBox();
}

function handleResultHover(e) {
  const selected = resultsList.querySelector(".selected");
  if (selected) {
    selected.classList.remove("selected");
  }
  e.currentTarget.classList.add("selected");
}

function clearResults() {
  if (resultsList) {
    resultsList.innerHTML = "";
  }
}

function handleKeyDown(e) {
  const KEY_UP = 38;
  const KEY_DOWN = 40;
  const ENTER = 13;
  const ESC = 27;

  switch (e.keyCode) {
    case KEY_UP:
      e.preventDefault();
      navigateResults("up");
      break;
    case KEY_DOWN:
      e.preventDefault();
      navigateResults("down");
      break;
    case ENTER:
      e.preventDefault();
      executeSelected();
      break;
    case ESC:
      e.preventDefault();
      hideSearchBox();
      break;
  }
}

function navigateResults(direction) {
  const results = resultsList.getElementsByClassName("litnav_result");
  const selected = resultsList.querySelector(".selected");
  let nextIndex = 0;

  if (selected) {
    const currentIndex = parseInt(selected.getAttribute("data-index"));
    selected.classList.remove("selected");

    if (direction === "up") {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
    } else {
      nextIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
    }
  }

  results[nextIndex].classList.add("selected");
  results[nextIndex].scrollIntoView({ block: "nearest" });
}

function executeSelected() {
  const selected = resultsList.querySelector(".selected");
  if (selected) {
    const url = selected.getAttribute("data-url");
    if (url) {
      window.location.href = url;
    }
  }
  hideSearchBox();
}

function handleClickOutside(e) {
  const searchBox = document.getElementById("litnav_search_box");
  if (searchBox && !searchBox.contains(e.target)) {
    hideSearchBox();
  }
}

function showLoadingIndicator() {
  const loading = document.getElementById("litnav_loading");
  if (loading) {
    loading.classList.remove("litnav_hidden");
  }
}

function hideLoadingIndicator() {
  const loading = document.getElementById("litnav_loading");
  if (loading) {
    loading.classList.add("litnav_hidden");
  }
}

// Add event listeners for page load
document.addEventListener("load", init);
window.addEventListener("load", init);

// Export functions for testing
window.litNav = {
  showSearchBox,
  hideSearchBox,
  init,
};
