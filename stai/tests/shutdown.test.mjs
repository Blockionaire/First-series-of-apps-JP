/**
 * Shutdown regression test.
 *
 * Phase 1b adds no signal-handling code. This locks in the behaviour that was
 * proven at process level: Next's standalone server installs its own
 * SIGTERM/SIGINT handlers and converts the signal into a normal exit, which
 * fires the process "exit" hook that checkpoints and closes SQLite.
 *
 * If a future Next release stops converting the signal, this test fails and
 * tells us to add explicit handlers — rather than us adding speculative
 * lifecycle code today for a framework change that has not happened.
 *
 * Note: this is clean-shutdown hygiene, not data safety. SQLite's WAL is
 * crash-recoverable either way, which the integrity assertion below confirms.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.SHUTDOWN_TEST_PORT ?? 3198);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");

let dataDir, server, exitCode = null, exitSignal = null;

const hasBuild = fs.existsSync(STANDALONE);

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-shutdown-"));
  server = spawn("node", [STANDALONE], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      STAI_DATA_DIR: dataDir,
      APP_URL: BASE,
      STRIPE_SECRET_KEY: "",
      STAI_ADMIN_EMAIL: "",
      STAI_ADMIN_PASSWORD: "",
    },
    stdio: "ignore",
  });
  server.on("exit", (code, signal) => {
    exitCode = code;
    exitSignal = signal;
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
});

after(() => {
  if (server && exitCode === null) server.kill("SIGKILL");
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("SIGTERM produces a clean shutdown", { skip: hasBuild ? false : "no standalone build present" }, () => {
  test("a write puts the database into WAL mode with pending content", async () => {
    const res = await fetch(`${BASE}/api/newsletter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `shutdown-${Date.now()}@test.eu` }),
    });
    assert.equal(res.status, 200);
    const files = fs.readdirSync(dataDir);
    assert.ok(files.includes("stai.db-wal"), `expected a WAL file, saw: ${files.join(", ")}`);
  });

  test("SIGTERM is handled, not fatal — the process exits 0", async () => {
    server.kill("SIGTERM");
    const deadline = Date.now() + 20_000;
    while (exitCode === null && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(
      exitSignal,
      null,
      "the process must not be killed by the signal — Next should convert it to a normal exit"
    );
    assert.equal(exitCode, 0, "exit code 143 would mean the exit hook never ran");
  });

  test("the WAL was checkpointed away on shutdown", () => {
    const leftover = fs.readdirSync(dataDir);
    assert.deepEqual(
      leftover.filter((f) => f.startsWith("stai.db-")),
      [],
      `WAL/SHM should be gone after a clean close, saw: ${leftover.join(", ")}`
    );
  });

  test("the database is intact and the write survived", () => {
    const db = new Database(path.join(dataDir, "stai.db"), { readonly: true });
    const integrity = db.pragma("integrity_check", { simple: true });
    const n = db.prepare("SELECT COUNT(*) AS n FROM newsletter").get().n;
    db.close();
    assert.equal(integrity, "ok");
    assert.equal(n, 1, "the pre-signal write must be durable");
  });
});
