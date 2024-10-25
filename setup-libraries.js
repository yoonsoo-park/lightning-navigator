const fs = require("fs");
const https = require("https");
const path = require("path");

// Create scripts directory if it doesn't exist
const scriptsDir = path.join(__dirname, "app", "scripts");
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
}

// Function to download file
function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(scriptsDir, filename);
    const file = fs.createWriteStream(filePath);

    https
      .get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log(`Downloaded ${filename} successfully`);
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(filePath, () => {});
        console.error(`Error downloading ${filename}:`, err.message);
        reject(err);
      });
  });
}

// Libraries to download
const libraries = [
  {
    name: "jquery.js",
    url: "https://code.jquery.com/jquery-3.6.0.min.js",
  },
  {
    name: "mousetrap.min.js",
    url: "https://cdnjs.cloudflare.com/ajax/libs/mousetrap/1.6.5/mousetrap.min.js",
  },
];

// Download all libraries
async function downloadLibraries() {
  try {
    for (const lib of libraries) {
      await downloadFile(lib.url, lib.name);
    }
    console.log("All libraries downloaded successfully!");
  } catch (error) {
    console.error("Error downloading libraries:", error);
  }
}

// Run the download
downloadLibraries();
