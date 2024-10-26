console.log("Background script loaded");

chrome.commands.onCommand.addListener((command) => {
  console.log("Command received:", command);
  if (command === "toggle-search") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log("Sending message to tab:", tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, { action: "toggle-search" });
    });
  }
});
