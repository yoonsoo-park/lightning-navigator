import { EXCLUDED_DOMAINS, API_PATHS } from "../../common/constants.js";

/**
 * Creates or gets the offscreen document
 */
async function getOffscreenDocument() {
    // First check if we already have an offscreen document
    try {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
        });

        if (existingContexts.length > 0) {
            return; // Document already exists
        }

        // Create new offscreen document
        await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL("offscreen.html"),
            reasons: ["DOM_PARSER"],
            justification: "Parse URLs for Salesforce domain handling",
        });
    } catch (error) {
        console.error("Error creating offscreen document:", error);
        // Fallback to simple URL parsing
        return false;
    }
}

/**
 * Simple URL parser fallback
 */
function parseUrlFallback(url) {
    try {
        const urlObj = new URL(url);
        return {
            hostname: urlObj.hostname,
            protocol: urlObj.protocol,
            pathname: urlObj.pathname,
            search: urlObj.search,
            hash: urlObj.hash,
        };
    } catch (error) {
        console.error("URL parsing error:", error);
        // Extract domain using regex as last resort
        const domainMatch = url.match(/^https?:\/\/([^\/]+)/);
        return {
            hostname: domainMatch ? domainMatch[1] : "",
            protocol: "https:",
            pathname: "/",
            search: "",
            hash: "",
        };
    }
}

/**
 * Filters cookies based on domain and exclusions
 */
const getFilteredCookies = (cookies, filter) => {
    return cookies.filter(
        (cookie) =>
            cookie.domain.startsWith(filter) &&
            !EXCLUDED_DOMAINS.some((domain) => cookie.domain.endsWith(domain))
    );
};

/**
 * Validates a Salesforce session cookie by making a test API call
 */
const validateCookie = async (cookie) => {
    const { domain, value } = cookie;
    const testUrl = `https://${domain}/${API_PATHS.query}?q=SELECT Id FROM Account LIMIT 1`;

    try {
        const response = await fetch(testUrl, {
            headers: {
                Authorization: `Bearer ${value}`,
            },
        });
        return response.status === 200;
    } catch (error) {
        console.error("Cookie validation error:", error);
        return false;
    }
};

/**
 * Parse URL using offscreen document with fallback
 */
async function parseUrl(url) {
    try {
        const hasOffscreen = await getOffscreenDocument();

        if (!hasOffscreen) {
            return parseUrlFallback(url);
        }

        // Try to use offscreen document
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                {
                    action: "parseUrl",
                    url,
                },
                (response) => {
                    if (chrome.runtime.lastError || !response) {
                        resolve(parseUrlFallback(url));
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    } catch (error) {
        console.error("Error in parseUrl:", error);
        return parseUrlFallback(url);
    }
}

/**
 * Handles fetching and validating Salesforce session cookies
 */
export const handleFetchCookie = async (data, sender) => {
    try {
        console.log("Fetching cookie for tab:", sender.tab.url);

        // Parse URL with fallback
        const urlInfo = await parseUrl(sender.tab.url);
        console.log("Parsed URL info:", urlInfo);

        if (!urlInfo.hostname) {
            throw new Error("Failed to parse domain from URL");
        }

        const orgDomain = urlInfo.hostname;
        let orgName = orgDomain.split(".")[0];

        console.log("Org domain:", orgDomain, "Org name:", orgName);

        // Get all SID cookies
        const allCookies = await chrome.cookies.getAll({ name: "sid" });
        console.log("Found cookies:", allCookies.length);

        let possibleCookies = getFilteredCookies(allCookies, orgName);
        console.log("Filtered cookies:", possibleCookies.length);

        // Handle custom domains with -- prefix
        while (
            possibleCookies.length === 0 &&
            orgName.lastIndexOf("--") !== -1
        ) {
            orgName = orgName.substring(0, orgName.lastIndexOf("--"));
            possibleCookies = getFilteredCookies(allCookies, orgName);
            console.log(
                "Retrying with org name:",
                orgName,
                "Found:",
                possibleCookies.length
            );
        }

        if (possibleCookies.length === 0) {
            throw new Error("No valid Salesforce session found");
        }

        // Find first valid cookie
        for (const cookie of possibleCookies) {
            console.log("Validating cookie for domain:", cookie.domain);
            const isValid = await validateCookie(cookie);
            if (isValid) {
                console.log("Valid cookie found:", cookie.domain);
                return { cookie };
            }
        }

        throw new Error("No valid Salesforce session found");
    } catch (error) {
        console.error("Cookie fetch error:", error);
        throw error;
    }
};
