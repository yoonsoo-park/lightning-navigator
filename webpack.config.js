const path = require("path");

module.exports = {
  entry: {
    // Background script bundle
    litnav_background_bundle: "./app/scripts/litnav_background.js",

    // Content script bundle
    content: [
      "./app/scripts/jquery.js",
      "./app/scripts/mousetrap.min.js",
      "./app/scripts/forceTooling.js",
      "./app/scripts/main.js",
      "./app/scripts/sorttable.js",
    ],
  },
  output: {
    filename: "scripts/[name].js",
    path: path.resolve(__dirname, "dist"),
  },
  mode: "development", // Makes debugging easier
  devtool: "source-map", // Helps with debugging
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
};
