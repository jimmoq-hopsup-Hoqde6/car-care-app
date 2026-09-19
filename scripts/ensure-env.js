const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (!fs.existsSync(envPath)) {
  if (!fs.existsSync(examplePath)) {
    console.error("Missing .env.example — cannot create .env");
    process.exit(1);
  }
  fs.copyFileSync(examplePath, envPath);
  console.log("Created .env from .env.example (demo mode, no secrets).");
}
