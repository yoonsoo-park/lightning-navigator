// background.js
chrome.commands.onCommand.addListener(async (command) => {
  console.log("Command received:", command);
  if (command === "toggle-search") {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
        url: ["https://*.salesforce.com/*", "https://*.force.com/*"],
      });

      if (tab) {
        console.log("Sending toggle message to tab:", tab.id);
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "toggle-search",
        });
        console.log("Response received:", response);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }
});

// Keep service worker alive
chrome.runtime.onConnect.addListener(function (port) {
  console.log("Background script connected");
});
