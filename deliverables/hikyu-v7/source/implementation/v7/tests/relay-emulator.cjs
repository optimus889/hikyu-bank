// Local contract emulator: executes delivered Apps Script source with explicitly emulated Google services.
// This is NOT a Zapier run, Google deployment, or external Sheets test.
const fs = require("fs"),
  vm = require("vm"),
  crypto = require("crypto"),
  http = require("http"),
  path = require("path");
function createRelay({ file, appSecret, zapierSecret, port = 8199 }) {
  let state = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file))
    : {
        properties: {
          SPREADSHEET_ID: "local-emulator-only",
          APP_SECRET: appSecret,
          ZAPIER_SECRET: zapierSecret,
        },
        sheets: {},
      };
  const save = () =>
    fs.writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
  const headings = {
    IntakeQueue: ["id", "payload", "status", "updated_at"],
    OutcomeQueue: ["id", "payload", "status", "updated_at"],
    Receipts: ["id", "payload", "status", "updated_at"],
    Nonces: ["id", "expires_at"],
    Audit: ["time", "correlation", "operation", "result"],
    ExternalCases: [
      "case_id",
      "final_state",
      "state_version",
      "case_processed_at",
      "synced_at",
    ],
  };
  for (const [k, h] of Object.entries(headings)) state.sheets[k] ||= [h];
  function sheet(n) {
    if (!state.sheets[n]) throw Error("Missing emulated sheet");
    const s = () => state.sheets[n];
    return {
      getLastRow: () => s().length,
      getLastColumn: () => s()[0].length,
      appendRow: (r) => {
        s().push(r);
        save();
      },
      deleteRow: (n) => {
        s().splice(n - 1, 1);
        save();
      },
      getRange: (r, c, n, m) => ({
        getValues: () =>
          Array.from({ length: n }, (_, i) =>
            Array.from(
              { length: m },
              (_, j) => s()[r - 1 + i]?.[c - 1 + j] ?? "",
            ),
          ),
        setValues: (v) => {
          v.forEach((line, i) =>
            line.forEach((x, j) => {
              s()[r - 1 + i] ||= [];
              s()[r - 1 + i][c - 1 + j] = x;
            }),
          );
          save();
        },
      }),
    };
  }
  const properties = {
    getProperty: (k) => state.properties[k] ?? null,
    setProperty: (k, v) => {
      state.properties[k] = v;
      save();
      return properties;
    },
    deleteProperty: (k) => {
      delete state.properties[k];
      save();
    },
    setProperties: (v) => {
      Object.assign(state.properties, v);
      save();
    },
  };
  const context = {
    console,
    Date,
    JSON,
    Number,
    Object,
    String,
    Array,
    Math,
    Error,
    isFinite,
    PropertiesService: { getScriptProperties: () => properties },
    SpreadsheetApp: { openById: () => ({ getSheetByName: sheet }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      computeDigest: (alg, v) =>
        Array.from(crypto.createHash("sha256").update(v).digest()),
      computeHmacSha256Signature: (v, k) =>
        Array.from(crypto.createHmac("sha256", k).update(v).digest()),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock() {},
        releaseLock() {},
        hasLock: () => true,
      }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (t) => ({ setMimeType: () => t }),
    },
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../relay/Code.gs"), "utf8"),
    context,
  );
  save();
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 100000) req.destroy();
    });
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      try {
        res.end(context.doPost({ postData: { contents: body } }));
      } catch {
        res.statusCode = 500;
        res.end('{"ok":false}');
      }
    });
  });
  return {
    start: () =>
      new Promise((resolve) => server.listen(port, "127.0.0.1", resolve)),
    stop: () => new Promise((resolve) => server.close(resolve)),
    snapshot: () => JSON.parse(JSON.stringify(state)),
    failOnce: () => context.injectOneSyntheticWriteFailure(),
    url: "http://127.0.0.1:" + port,
  };
}
module.exports = { createRelay };
