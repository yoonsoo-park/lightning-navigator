// In src/background/actions/searchRecords.js
export const handleSearchRecords = async (data) => {
    const { cookie, query, objects } = data;
    const { domain, value } = cookie;

    try {
        // Build SOSL query
        const soslQuery = `FIND {${query}*} IN ALL FIELDS RETURNING ${objects
            .map(
                (obj) => `${obj}(Id, Name WHERE Name LIKE '${query}%' LIMIT 5)`
            )
            .join(", ")}`;

        const url = `https://${domain}/services/data/v57.0/search/?q=${encodeURIComponent(
            soslQuery
        )}`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${value}`,
            },
        });

        if (!response.ok) {
            throw new Error("Failed to fetch records");
        }

        const data = await response.json();

        // Format results
        const records = [];
        data.searchRecords.forEach((record) => {
            const type = record.attributes.type;
            records.push({
                Id: record.Id,
                Name: record.Name,
                type,
            });
        });

        return { records };
    } catch (error) {
        console.error("Record search failed:", error);
        throw error;
    }
};
