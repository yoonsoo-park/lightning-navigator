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

const SALESFORCE_DOMAIN_PATTERNS = {
    SCRATCH: {
        SETUP: ".scratch.my.salesforce-setup.com",
        LIGHTNING: ".scratch.lightning.force.com",
        CLASSIC: ".scratch.my.salesforce.com",
        FILE: ".scratch.file.force.com",
    },
    PRODUCTION: {
        LIGHTNING: ".lightning.force.com",
        CLASSIC: ".my.salesforce.com",
        FILE: ".file.force.com",
    },
};

// Helper function to map domains
const mapDomainToMainInstance = (hostname) => {
    const domainParts = hostname.split(".");
    const orgName = domainParts[0];

    // If we're in a setup domain, map to the main instance
    if (hostname.includes("salesforce-setup.com")) {
        return `${orgName}.scratch.my.salesforce.com`;
    }

    return hostname;
};

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

        // Handle scratch org domains
        const hostname = urlInfo.hostname;
        const domainParts = hostname.split(".");

        // Try to find the actual Salesforce domain
        let orgDomain = hostname;
        let orgName = domainParts[0];

        // Check if we're in a scratch org
        if (hostname.includes("scratch")) {
            const mappedDomain = mapDomainToMainInstance(hostname);
            const allCookies = await chrome.cookies.getAll({ name: "sid" });

            // Try each possible domain pattern
            for (const pattern of Object.values(
                SALESFORCE_DOMAIN_PATTERNS.SCRATCH
            )) {
                const domainToTry = `${orgName}${pattern}`;
                const cookies = getFilteredCookies(allCookies, orgName);

                for (const cookie of cookies) {
                    if (cookie.domain.endsWith(pattern)) {
                        console.log(
                            "Validating cookie for domain:",
                            cookie.domain
                        );
                        const isValid = await validateCookie(cookie);
                        if (isValid) {
                            console.log("Valid cookie found:", cookie.domain);
                            return { cookie };
                        }
                    }
                }
            }
        } else {
            // Original logic for non-scratch orgs
            const allCookies = await chrome.cookies.getAll({ name: "sid" });
            const possibleCookies = getFilteredCookies(allCookies, orgName);

            for (const cookie of possibleCookies) {
                const isValid = await validateCookie(cookie);
                if (isValid) {
                    return { cookie };
                }
            }
        }

        throw new Error("No valid Salesforce session found");
    } catch (error) {
        console.error("Cookie fetch error:", error);
        throw error;
    }
};
