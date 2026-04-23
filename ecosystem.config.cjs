module.exports = {
  apps: [
    {
      name: "livestream-api",
      cwd: __dirname,
      script: "npm",
      args: "run start:api",
    },
    {
      name: "livestream-hooks",
      cwd: __dirname,
      script: "npm",
      args: "run start:media-hooks",
    },
    {
      name: "livestream-worker",
      cwd: __dirname,
      script: "npm",
      args: "run start:worker",
    },
  ],
};
