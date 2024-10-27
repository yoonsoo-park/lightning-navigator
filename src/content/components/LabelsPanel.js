import { ACTION_TYPES } from "../../common/constants.js";

export class LabelsPanel {
    constructor(cookie) {
        this.cookie = cookie;
        this.labels = null;
        this.visible = false;
        this.currentFilter = "";
        this.currentCategory = "all";

        // Create DOM elements
        this.createElements();

        // Bind methods
        this.handleFilterInput = this.handleFilterInput.bind(this);
        this.handleCategoryChange = this.handleCategoryChange.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);

        // Initialize
        this.initialize();
    }

    createElements() {
        // Main container
        this.container = document.createElement("div");
        this.container.className = "lightning-nav-labels-panel";

        // Header
        this.header = document.createElement("div");
        this.header.className = "lightning-nav-labels-header";

        // Filter input
        this.filterInput = document.createElement("input");
        this.filterInput.type = "text";
        this.filterInput.className = "lightning-nav-labels-filter";
        this.filterInput.placeholder = "Filter labels...";

        // Category selector
        this.categorySelect = document.createElement("select");
        this.categorySelect.className = "lightning-nav-labels-category";
        this.categorySelect.innerHTML = `
      <option value="all">All Categories</option>
    `;

        // Export button
        this.exportButton = document.createElement("button");
        this.exportButton.className = "lightning-nav-labels-export";
        this.exportButton.textContent = "Export to CSV";

        // Labels table
        this.table = document.createElement("table");
        this.table.className = "lightning-nav-labels-table";
        this.table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th>Value</th>
          <th>Namespace</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

        // Assemble
        this.header.appendChild(this.filterInput);
        this.header.appendChild(this.categorySelect);
        this.header.appendChild(this.exportButton);
        this.container.appendChild(this.header);
        this.container.appendChild(this.table);
        document.body.appendChild(this.container);
    }

    async initialize() {
        // Fetch labels
        await this.fetchLabels();

        // Set up event listeners
        this.filterInput.addEventListener("input", this.handleFilterInput);
        this.categorySelect.addEventListener(
            "change",
            this.handleCategoryChange
        );
        this.exportButton.addEventListener("click", this.handleExport);
        document.addEventListener("click", this.handleClickOutside);
    }

    async fetchLabels() {
        try {
            const key = `${this.cookie.domain}!${this.cookie.value}`;
            const response = await chrome.runtime.sendMessage({
                action: ACTION_TYPES.GET_LABELS,
                data: { key },
            });

            if (response?.labels) {
                this.labels = response.labels;
                this.updateCategories();
                this.renderLabels();
            } else {
                // If no cached labels, query them
                await chrome.runtime.sendMessage({
                    action: ACTION_TYPES.QUERY_LABELS,
                    data: {
                        key,
                        cookie: this.cookie,
                    },
                });
            }
        } catch (error) {
            console.error("Failed to fetch labels:", error);
        }
    }

    updateCategories() {
        if (!this.labels) return;

        const categories = new Set();
        this.labels.forEach((label) => {
            if (label.Category) {
                categories.add(label.Category);
            }
        });

        const options = ['<option value="all">All Categories</option>'];
        Array.from(categories)
            .sort()
            .forEach((category) => {
                options.push(
                    `<option value="${category}">${category}</option>`
                );
            });

        this.categorySelect.innerHTML = options.join("");
    }

    filterLabels() {
        if (!this.labels) return [];

        return this.labels.filter((label) => {
            const matchesFilter =
                this.currentFilter === "" ||
                Object.values(label).some((value) =>
                    String(value)
                        .toLowerCase()
                        .includes(this.currentFilter.toLowerCase())
                );

            const matchesCategory =
                this.currentCategory === "all" ||
                label.Category === this.currentCategory;

            return matchesFilter && matchesCategory;
        });
    }

    renderLabels() {
        const filteredLabels = this.filterLabels();
        const tbody = this.table.querySelector("tbody");
        tbody.innerHTML = "";

        filteredLabels.forEach((label) => {
            const row = document.createElement("tr");
            row.innerHTML = `
        <td>${label.Name}</td>
        <td>${label.Category || ""}</td>
        <td>${label.Value || ""}</td>
        <td>${label.NamespacePrefix || ""}</td>
      `;
            tbody.appendChild(row);
        });
    }

    handleFilterInput(event) {
        this.currentFilter = event.target.value;
        this.renderLabels();
    }

    handleCategoryChange(event) {
        this.currentCategory = event.target.value;
        this.renderLabels();
    }

    handleExport() {
        const filteredLabels = this.filterLabels();
        const csv = this.convertToCSV(filteredLabels);
        this.downloadCSV(csv);
    }

    convertToCSV(labels) {
        const headers = ["Name", "Category", "Value", "Namespace"];
        const rows = labels.map((label) =>
            [
                label.Name,
                label.Category || "",
                label.Value || "",
                label.NamespacePrefix || "",
            ].map((cell) => `"${cell.replace(/"/g, '""')}"`)
        );

        return [headers.join(","), ...rows.map((row) => row.join(","))].join(
            "\n"
        );
    }

    downloadCSV(csv) {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "salesforce_labels.csv");
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    show() {
        this.visible = true;
        this.container.style.display = "block";
        this.filterInput.focus();
    }

    hide() {
        this.visible = false;
        this.container.style.display = "none";
        this.filterInput.value = "";
        this.currentFilter = "";
        this.renderLabels();
    }

    handleClickOutside(event) {
        if (this.visible && !this.container.contains(event.target)) {
            this.hide();
        }
    }
}
