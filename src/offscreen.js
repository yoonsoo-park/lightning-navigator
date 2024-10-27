chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "parseUrl") {
        try {
            const url = message.url;
            const parser = document.createElement("a");
            parser.href = url;

            sendResponse({
                hostname: parser.hostname,
                protocol: parser.protocol,
                pathname: parser.pathname,
                search: parser.search,
                hash: parser.hash,
            });
        } catch (error) {
            console.error("Error parsing URL:", error);
            sendResponse(null);
        }
    }

    if (message.action === "parseSetupHtml") {
        try {
            const html = message.html;
            const doc = new DOMParser().parseFromString(html, "text/html");
            const setupItems = {};

            const menuItems = doc.querySelectorAll(
                '.setupLeaf > a[id*="_font"]'
            );
            menuItems.forEach((item) => {
                const parentFolders = [];
                let current = item.closest(".parent");

                while (current) {
                    const folderName =
                        current.querySelector(".setupFolder")?.innerText;
                    if (folderName) {
                        parentFolders.unshift(folderName);
                    }
                    current = current.parentElement?.closest(".parent");
                }

                const path = ["Setup", ...parentFolders, item.innerText].join(
                    " > "
                );
                setupItems[path] = {
                    url: item.getAttribute("href"),
                    key: item.innerText,
                };
            });

            sendResponse({ setupItems });
        } catch (error) {
            console.error("Error parsing HTML:", error);
            sendResponse(null);
        }
    }

    return true; // Keep the message channel open
});
