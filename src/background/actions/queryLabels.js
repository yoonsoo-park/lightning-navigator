import { API_PATHS, QUERIES } from "../../common/constants.js";

export const handleQueryLabels = async (data, sender) => {
    const { cookie } = data;
    const { domain, value } = cookie;

    try {
        const url = `https://${domain}/${
            API_PATHS.tooling
        }/query/?q=${encodeURIComponent(QUERIES.CUSTOM_LABELS)}`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${value}`,
            },
        });

        if (!response.ok) {
            throw new Error("Failed to fetch custom labels");
        }

        const result = await response.json();
        const labels = result.records || [];

        // Store in chrome storage
        await chrome.storage.local.set({
            labels,
            lastUpdated: Date.now(),
        });

        return { labels };
    } catch (error) {
        console.error("Error querying labels:", error);
        throw error;
    }
};
