// State management using chrome.storage instead of global variables
const storage = {
  async getCommands(key) {
    const data = await chrome.storage.local.get(["commands", "lastUpdated"]);
    const { commands = {}, lastUpdated = {} } = data;

    if (commands[key]) {
      return commands[key];
    } else {
      const orgKey = key.split("!")[0];
      if (
        commands[orgKey] &&
        lastUpdated[orgKey] &&
        Date.now() - lastUpdated[orgKey] < 1000 * 60 * 60
      ) {
        return commands[orgKey];
      }
    }
    return null;
  },

  async setCommands(key, payload) {
    const data = await chrome.storage.local.get(["commands", "lastUpdated"]);
    const { commands = {}, lastUpdated = {} } = data;
    const orgKey = key.split("!")[0];

    // Clean up old commands
    Object.keys(commands).forEach((k) => {
      if (k !== key && k.split("!")[0] === orgKey) {
        delete commands[k];
      }
    });

    commands[key] = commands[orgKey] = payload;
    lastUpdated[orgKey] = Date.now();

    await chrome.storage.local.set({ commands, lastUpdated });
  },

  async getMetadata(key) {
    const { metadata = {} } = await chrome.storage.local.get("metadata");
    const orgKey = key.split("!")[0];
    return metadata[key] || metadata[orgKey] || null;
  },

  async setMetadata(key, payload) {
    const { metadata = {} } = await chrome.storage.local.get("metadata");
    const orgKey = key.split("!")[0];

    Object.keys(metadata).forEach((k) => {
      if (k !== key && k.split("!")[0] === orgKey) {
        delete metadata[k];
      }
    });

    metadata[key] = metadata[orgKey] = payload;
    await chrome.storage.local.set({ metadata });
  },
};

// Constants
const excludedDomains = [
  "visual.force.com",
  "content.force.com",
  "lightning.force.com",
];

// Helper functions
function getFilteredCookies(allCookies, filter) {
  return allCookies.filter(
    (c) =>
      c.domain.startsWith(filter) &&
      !excludedDomains.some((d) => c.domain.endsWith(d))
  );
}

function getDomain(url) {
  const a = document.createElement("a");
  a.setAttribute("href", url);
  return a.hostname;
}

// Register listeners at the top level
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  // Return true to indicate we'll respond asynchronously
  return true;
});

console.log("Service Worker Initialized");

// Register command listener at the top level
chrome.commands.onCommand.addListener((command) => {
  console.log("Command received:", command);
  if (command === "show-command-bar") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        console.log("Sending show command to tab:", tabs[0].id);
        chrome.tabs
          .sendMessage(tabs[0].id, {
            action: "Show Command Bar",
            source: "command",
          })
          .catch((err) => {
            console.error("Error sending message:", err);
          });
      }
    });
  }
});

// Message handler
async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case "Loaded":
        await handleLoaded(sender);
        break;

      case "Get Commands":
        const commands = await storage.getCommands(request.key);
        sendResponse(commands);
        break;

      case "Store Commands":
        await storage.setCommands(request.key, request.payload);
        sendResponse({});
        break;

      case "Get Metadata":
        const metadata = await storage.getMetadata(request.key);
        sendResponse(metadata);
        break;

      case "Store Metadata":
        await storage.setMetadata(request.key, request.payload);
        sendResponse({});
        break;
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({ error: error.message });
  }
}

async function handleLoaded(sender) {
  const orgDomain = getDomain(sender.tab.url);
  const parts = orgDomain.split(".");
  let orgName = parts[0];

  const allCookies = await chrome.cookies.getAll({ name: "sid" });
  let possibleCookies = getFilteredCookies(allCookies, orgName);

  while (possibleCookies.length === 0 && orgName.lastIndexOf("--") !== -1) {
    orgName = orgName.substring(0, orgName.lastIndexOf("--"));
    possibleCookies = getFilteredCookies(allCookies, orgName);
  }

  if (possibleCookies.length > 0) {
    const testQuery = "SELECT+Id+FROM+Account+LIMIT+1";
    const testPath = `services/data/v46.0/query/?q=${testQuery}`;

    for (const cookie of possibleCookies) {
      try {
        const testUrl = `https://${cookie.domain}/${testPath}`;
        const response = await fetch(testUrl, {
          headers: { Authorization: `Bearer ${cookie.value}` },
        });

        if (response.status === 200) {
          chrome.tabs.sendMessage(sender.tab.id, { cookie });
          break;
        }
      } catch (error) {
        console.error("Error testing cookie:", error);
      }
    }
  }
}
