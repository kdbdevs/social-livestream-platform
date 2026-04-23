module.exports = {
  apps: [
    {
      name: "livestream-api",
      cwd: __dirname,
      script: "services/api/dist/main.js",
      interpreter: "node",
    },
    {
      name: "livestream-hooks",
      cwd: __dirname,
      script: "services/media-hooks/dist/main.js",
      interpreter: "node",
    },
    {
      name: "livestream-worker",
      cwd: __dirname,
      script: "services/worker/dist/main.js",
      interpreter: "node",
    },
  ],
};
