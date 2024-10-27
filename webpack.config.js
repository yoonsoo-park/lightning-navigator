const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: {
        "scripts/service-worker": "./src/background/service-worker.js",
        "scripts/content": "./src/content/index.js",
        "scripts/offscreen": "./src/offscreen.js",
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "app"),
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                        plugins: ["@babel/plugin-transform-runtime"],
                    },
                },
            },
        ],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: "src/manifest.json",
                    to: "manifest.json",
                    transform(content) {
                        return Buffer.from(
                            JSON.stringify(
                                {
                                    ...JSON.parse(content.toString()),
                                    version: process.env.npm_package_version,
                                },
                                null,
                                2
                            )
                        );
                    },
                },
                { from: "src/public/images", to: "images" },
                { from: "src/public/_locales", to: "_locales" },
                { from: "src/content/styles", to: "styles" },
                { from: "src/offscreen.html", to: "offscreen.html" },
            ],
        }),
    ],
    resolve: {
        extensions: [".js"],
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    devtool:
        process.env.NODE_ENV === "production"
            ? "source-map"
            : "cheap-module-source-map",
};
