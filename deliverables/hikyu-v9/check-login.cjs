const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ROOT, APP_URL } = require("../v8/runtime.cjs");

const email = "requester.v7@example.invalid";
const accountFile = path.join(ROOT, "private/saltcorn-accounts.json");
const modes = new Set(["--check", "--reset-requester", "--show-password"]);

function demoDatabase() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "private/saltcorn-env.json"), "utf8"));
  return (
    cfg.PGHOST === "127.0.0.1" && cfg.PGDATABASE === "saltcorn_v8" && cfg.PGUSER === "v6_demo"
  );
}

async function run(mode) {
  let sdk;
  try {
    if (!demoDatabase()) {
      console.error("This tool only supports the generated local V9 demo database.");
      return 1;
    }
    sdk = require("../saltcorn/sdk.cjs");
    await sdk.init();
    const accounts = JSON.parse(fs.readFileSync(accountFile, "utf8"));
    const entry = accounts.find((account) => account.key === "requester");
    const user = await sdk.User.findOne({ email });

    console.log("V9 login:", APP_URL + "/auth/login");
    console.log("Demo email:", email);
    if (
      !entry ||
      !user ||
      entry.email !== email ||
      Number(entry.id) !== Number(user.id) ||
      Number(user.role_id) !== 80
    ) {
      console.error("The private requester entry does not match the expected local demo user.");
      return 1;
    }

    if (mode === "--reset-requester") {
      const password = "V9-" + crypto.randomBytes(18).toString("hex");
      const tmp = fs.mkdtempSync(path.join(path.dirname(accountFile), ".login-repair-"));
      try {
        entry.password = password;
        const next = path.join(tmp, "accounts.json");
        fs.writeFileSync(next, JSON.stringify(accounts, null, 2) + "\n", {
          mode: 0o600,
          flag: "wx",
        });
        await user.changePasswordTo(password, true);
        fs.renameSync(next, accountFile);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
      console.log(
        "Requester password regenerated. User ID and transaction ownership retained.",
      );
      console.log("Run this tool with --show-password to view the new password locally.");
      return 0;
    }

    if (typeof entry.password !== "string" || !user.checkPassword(entry.password)) {
      console.error("The saved requester password does not match this database.");
      console.error("Run this tool with --reset-requester to regenerate this demo login.");
      return 1;
    }

    console.log("The saved requester password matches this database.");
    if (mode === "--show-password") console.log("Local password:", entry.password);
    return 0;
  } catch (error) {
    if (error.code === "28P01") {
      console.error(
        "Database authentication failed. Run python3 backend/prepare_v9.py --repair-db-auth.",
      );
    } else if (error.code === "ENOENT") {
      console.error(
        "Local V9 setup files are missing. Run python3 backend/prepare_v9.py --rebuild.",
      );
    } else {
      console.error(
        "The local login check could not finish. Confirm V9 and its database are running.",
      );
    }
    return 1;
  } finally {
    if (sdk) await sdk.db.close();
  }
}

const mode = process.argv[2] || "--check";
if (!modes.has(mode) || process.argv.length > 3) {
  console.error(
    "Usage: node backend/v9/check-login.cjs [--check | --reset-requester | --show-password]",
  );
  process.exitCode = 2;
} else {
  run(mode).then((code) => {
    process.exitCode = code;
  });
}
