class SalesforceToolingAPI {
  constructor() {
    this.sessionId = null;
    this.instanceUrl = null;
    this.apiVersion = "v57.0";
    this.searchCache = new Map();
    this.pendingSearch = null;
  }

  async initialize() {
    try {
      // Get session ID from Salesforce page
      const sidCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("sid="));
      if (sidCookie) {
        this.sessionId = sidCookie.split("=")[1];
      } else {
        // Fallback to VF page session ID
        const vfSidEl = document.querySelector('head meta[name="aura-token"]');
        if (vfSidEl) {
          this.sessionId = vfSidEl.content;
        }
      }

      if (!this.sessionId) {
        throw new Error("Could not find Salesforce session ID");
      }

      this.instanceUrl = window.location.origin;
      console.log("SalesforceToolingAPI initialized");
    } catch (error) {
      console.error("Failed to initialize SalesforceToolingAPI:", error);
      throw error;
    }
  }

  async searchRecords(searchTerm, callback) {
    // Cancel any pending search
    if (this.pendingSearch) {
      this.pendingSearch.abort();
      this.pendingSearch = null;
    }

    // Check cache
    const cacheKey = searchTerm.toLowerCase();
    if (this.searchCache.has(cacheKey)) {
      callback(this.searchCache.get(cacheKey));
      return;
    }

    this.pendingSearch = new AbortController();
    const signal = this.pendingSearch.signal;

    try {
      // Perform parallel searches
      const searches = [
        this.searchObject(searchTerm, "Account", signal),
        this.searchObject(searchTerm, "Contact", signal),
        this.searchObject(searchTerm, "Opportunity", signal),
        this.searchObject(searchTerm, "Case", signal),
        this.searchObject(searchTerm, "Lead", signal),
      ];

      // Process results as they come in
      for (const searchPromise of searches) {
        searchPromise
          .then((records) => {
            if (records && records.length > 0) {
              const formattedResults = this.formatResults(records);
              callback(formattedResults);

              // Cache results
              this.searchCache.set(cacheKey, formattedResults);
            }
          })
          .catch((error) => {
            if (error.name !== "AbortError") {
              console.error("Search error:", error);
            }
          });
      }
    } catch (error) {
      console.error("Search failed:", error);
    }
  }

  async searchObject(searchTerm, objectType, signal) {
    const soql = this.buildSearchQuery(searchTerm, objectType);

    try {
      const response = await fetch(
        `${this.instanceUrl}/services/data/${
          this.apiVersion
        }/query/?q=${encodeURIComponent(soql)}`,
        {
          headers: {
            Authorization: `Bearer ${this.sessionId}`,
            "Content-Type": "application/json",
          },
          signal,
        }
      );

      if (!response.ok) throw new Error(`${objectType} search failed`);
      const result = await response.json();
      return result.records || [];
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(`${objectType} search error:`, error);
      }
      return [];
    }
  }

  buildSearchQuery(searchTerm, objectType) {
    const searchFields = {
      Account: ["Name", "Industry", "Type"],
      Contact: ["Name", "Title", "Account.Name"],
      Opportunity: ["Name", "StageName", "Account.Name"],
      Case: ["CaseNumber", "Subject", "Account.Name"],
      Lead: ["Name", "Company", "Title"],
    };

    const fields = searchFields[objectType];
    const conditions = fields
      .map((field) => `${field} LIKE '%${searchTerm}%'`)
      .join(" OR ");

    return `
      SELECT Id, ${fields.join(", ")}
      FROM ${objectType}
      WHERE ${conditions}
      LIMIT 5
    `;
  }

  formatResults(records) {
    return records.map((record) => {
      const objectType = record.attributes.type;
      let title = "";
      let subtitle = "";
      let details = "";

      switch (objectType) {
        case "Account":
          title = record.Name;
          subtitle = record.Industry || "";
          details = `Account > ${record.Type || "Standard"} > ${record.Name}`;
          break;
        case "Contact":
          title = record.Name;
          subtitle = record.Title || "";
          details = `Contact > ${record.Account?.Name || "No Account"} > ${
            record.Name
          }`;
          break;
        case "Opportunity":
          title = record.Name;
          subtitle = record.StageName || "";
          details = `Opportunity > ${record.Account?.Name || "No Account"} > ${
            record.Name
          }`;
          break;
        case "Case":
          title = record.Subject || record.CaseNumber;
          subtitle = record.CaseNumber;
          details = `Case > ${record.Account?.Name || "No Account"} > ${
            record.CaseNumber
          }`;
          break;
        case "Lead":
          title = record.Name;
          subtitle = record.Company || "";
          details = `Lead > ${record.Company || "No Company"} > ${record.Name}`;
          break;
      }

      return {
        id: record.Id,
        type: objectType,
        title,
        subtitle,
        details,
        raw: record,
      };
    });
  }
}
