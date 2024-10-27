import { API_PATHS } from "../../common/constants.js";

/**
 * Utility class for making Salesforce API calls
 */
export class SalesforceAPI {
    /**
     * Initialize with authentication cookie
     */
    constructor(cookie) {
        this.cookie = cookie;
        this.baseUrl = `https://${cookie.domain}`;
        this.headers = {
            Authorization: `Bearer ${cookie.value}`,
            "Content-Type": "application/json",
        };
    }

    /**
     * Make a GET request to Salesforce API
     */
    async get(path, params = {}) {
        const url = new URL(`${this.baseUrl}/${path}`);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: this.headers,
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Execute a SOQL query
     */
    async query(soql, tooling = false) {
        const path = tooling ? API_PATHS.tooling : API_PATHS.data;
        const encodedQuery = encodeURIComponent(soql);
        const result = await this.get(`${path}/query/?q=${encodedQuery}`);

        let records = result.records || [];

        // Handle pagination
        let nextRecordsUrl = result.nextRecordsUrl;
        while (nextRecordsUrl) {
            const nextResult = await this.get(nextRecordsUrl);
            records = [...records, ...(nextResult.records || [])];
            nextRecordsUrl = nextResult.nextRecordsUrl;
        }

        return records;
    }

    /**
     * Get object metadata
     */
    async getObjectMetadata(objectName) {
        return this.get(`${API_PATHS.data}/sobjects/${objectName}/describe`);
    }

    /**
     * Get setup tree HTML
     */
    async getSetupTree() {
        const response = await fetch(`${this.baseUrl}/ui/setup/Setup`, {
            headers: this.headers,
        });

        if (!response.ok) {
            throw new Error("Failed to fetch setup tree");
        }

        return response.text();
    }

    /**
     * Batch multiple queries for better performance
     */
    async batchQueries(queries) {
        const compositeRequest = {
            compositeRequest: queries.map((query, index) => ({
                method: "GET",
                url: `/services/data/${
                    API_PATHS.version
                }/query/?q=${encodeURIComponent(query)}`,
                referenceId: `query${index}`,
            })),
        };

        const response = await fetch(
            `${this.baseUrl}/services/data/${API_PATHS.version}/composite`,
            {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify(compositeRequest),
            }
        );

        if (!response.ok) {
            throw new Error("Batch query failed");
        }

        const result = await response.json();
        return result.compositeResponse.map((r) => r.body.records);
    }

    /**
     * Search across multiple objects
     */
    async search(searchTerm) {
        const sosl = encodeURIComponent(
            `FIND {${searchTerm}} IN ALL FIELDS RETURNING ` +
                `CustomObject(Id,DeveloperName,NamespacePrefix), ` +
                `ApexClass(Id,Name,NamespacePrefix), ` +
                `ApexPage(Id,Name,NamespacePrefix), ` +
                `Flow(Id,DeveloperName)`
        );

        return this.get(`${API_PATHS.data}/search/?q=${sosl}`);
    }

    /**
     * Validate session is still active
     */
    async validateSession() {
        try {
            await this.get(`${API_PATHS.data}/limits`);
            return true;
        } catch (error) {
            return false;
        }
    }
}
