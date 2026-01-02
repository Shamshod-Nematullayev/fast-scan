module.exports = {
  apps: [
    {
      name: "fast-scan",
      script: "dist/index.js",
      watch: true,
      ignore_watch: [
        "node_modules",
        "session.json",
        "*.png",
        "*.pdf",
        "*.PDF",
        "*.xls",
        "*.html",
        "*.htm",
        "*.xlsx",
        "uploads",
        "/uploads",
        "./uploads",
        "./.git",
        "lib",
        "error.log",
        "outputs.log",
      ],
      error_file: "errors.log",
      out_file: "outputs.log",
    },
  ],
};
