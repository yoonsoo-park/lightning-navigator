var commands = {};
var metadata = {};
var lastUpdated = {};
var labels = {};

const excludedDomains = [
  "visual.force.com",
  "content.force.com",
  "lightning.force.com",
];

const getFilteredCookies = (allCookies, filter) => {
  return allCookies.filter(
    (c) =>
      c.domain.startsWith(filter) &&
      !excludedDomains.some((d) => c.domain.endsWith(d))
  );
};

const getDomain = (url) => {
  const a = document.createElement("a");
  a.setAttribute("href", url);
  return a.hostname;
};

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  var orgKey = request.key != null ? request.key.split("!")[0] : null;

  if (request.action === "Loaded") {
    const orgDomain = getDomain(sender.tab.url);
    const parts = orgDomain.split(".");
    let orgName = parts[0];

    chrome.cookies.getAll({ name: "sid" }, (allCookies) => {
      let possibleCookies = getFilteredCookies(allCookies, orgName);

      while (possibleCookies.length === 0 && orgName.lastIndexOf("--") !== -1) {
        orgName = orgName.substring(0, orgName.lastIndexOf("--"));
        possibleCookies = getFilteredCookies(allCookies, orgName);
      }

      if (possibleCookies.length > 0) {
        const testQuery = "SELECT+Id+FROM+Account+LIMIT+1";
        const testPath = `services/data/v46.0/query/?q=${testQuery}`;
        let cookie = null;

        possibleCookies.forEach((c) => {
          const testUrl = `https://${c.domain}/${testPath}`;
          const headers = { Authorization: `Bearer ${c.value}` };

          fetch(testUrl, { headers })
            .then((response) => {
              if (response.status === 200 && !cookie) {
                cookie = c;
                chrome.tabs.sendMessage(sender.tab.id, { cookie });
              }
            })
            .catch((err) => console.error(err));
        });
      }
    });
  }

  // Handle other message types
  const messageHandlers = {
    "Store Commands": () => {
      Object.keys(commands).forEach((key) => {
        if (key != request.key && key.split("!")[0] == orgKey) {
          delete commands[key];
        }
      });
      commands[request.key] = commands[orgKey] = request.payload;
      lastUpdated[orgKey] = new Date();
      sendResponse({});
    },

    "Get Commands": () => {
      if (commands[request.key] != null) {
        sendResponse(commands[request.key]);
      } else if (
        commands[orgKey] != null &&
        lastUpdated[orgKey] != null &&
        new Date().getTime() - lastUpdated[orgKey].getTime() < 1000 * 60 * 60
      ) {
        sendResponse(commands[orgKey]);
      } else {
        sendResponse(null);
      }
    },

    "Get Metadata": () => {
      if (metadata[request.key] != null) {
        sendResponse(metadata[request.key]);
      } else if (metadata[orgKey] != null) {
        sendResponse(metadata[orgKey]);
      } else {
        sendResponse(null);
      }
    },

    "Store Metadata": () => {
      Object.keys(metadata).forEach((key) => {
        if (key != request.key && key.split("!")[0] == orgKey) {
          delete metadata[key];
        }
      });
      metadata[request.key] = metadata[orgKey] = request.payload;
      sendResponse({});
    },

    "Get Labels": () => {
      if (labels[request.key] != null) {
        sendResponse(labels[request.key]);
      } else if (labels[orgKey] != null) {
        sendResponse(labels[orgKey]);
      } else {
        sendResponse(null);
      }
    },

    "Store Labels": () => {
      Object.keys(labels).forEach((key) => {
        if (key != request.key && key.split("!")[0] == orgKey) {
          delete labels[key];
        }
      });
      labels[request.key] = labels[orgKey] = request.payload;
      sendResponse({});
    },
  };

  if (messageHandlers[request.action]) {
    messageHandlers[request.action]();
  }
});

chrome.commands.onCommand.addListener(function (command) {
  console.log("Command received:", command); // For debugging
  if (command === "show-command-bar") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "Show Command Bar",
        });
      }
    });
  }
});
