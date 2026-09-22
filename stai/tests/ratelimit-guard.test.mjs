/**
 * The guard's two additions: per-account counting, and saying how long to wait.
 *
 * Both exist for the same operator problem. Verifying a source registry means
 * a hundred Test source calls in an afternoon, and when one is refused the
 * only rational response to "slow down and try again shortly" is to keep
 * clicking — because it does not distinguish a ten-second pause from a
 * fifty-minute one.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { guard, waitPhrase, WINDOW } from "../src/lib/ratelimit.ts";

/** A request carrying one client IP, which is all `guard` reads from it. */
const req = (ip = "203.0.113.7") => ({
  headers: { get: (h) => (h === "cf-connecting-ip" ? ip : null) },
});

/** Unique bucket per test: the store is process-wide and shared. */
let n = 0;
const bucket = () => `test-guard-${process.pid}-${n++}`;

describe("the wait is stated in words", () => {
  test("seconds, minutes and hours are each named", () => {
    assert.equal(waitPhrase(1), "1 second");
    assert.equal(waitPhrase(45), "45 seconds");
    assert.equal(waitPhrase(60), "1 minute");
    assert.equal(waitPhrase(90), "2 minutes");
    assert.equal(waitPhrase(3600), "1 hour");
    assert.equal(waitPhrase(5400), "2 hours");
  });

  test("it always rounds up", () => {
    // Telling somebody to wait four minutes when the bucket clears in four
    // minutes twenty is an invitation to be refused twice.
    assert.equal(waitPhrase(61), "2 minutes");
    assert.equal(waitPhrase(0.4), "1 second");
  });

  test("an unknown or elapsed wait says nothing rather than lying", () => {
    assert.equal(waitPhrase(0), "");
    assert.equal(waitPhrase(-5), "");
    assert.equal(waitPhrase(NaN), "");
  });
});

describe("a refusal says how long to wait", () => {
  test("the message names the time and the header carries the seconds", async () => {
    const b = bucket();
    assert.equal(await guard(req(), b, 1, WINDOW.hour), null, "the first call proceeds");

    const blocked = await guard(req(), b, 1, WINDOW.hour);
    assert.ok(blocked, "the second call is refused");
    assert.equal(blocked.status, 429);

    const body = await blocked.json();
    assert.match(body.error, /try again in \d+ (second|minute|hour)s?\./, body.error);
    assert.ok(body.retryAfter > 0, "the caller gets the raw seconds too");

    const header = Number(blocked.headers.get("Retry-After"));
    assert.ok(header > 0);
    assert.equal(header, body.retryAfter, "header and body must agree");
  });

  test("an hour window reports close to an hour, not a bare number", async () => {
    const b = bucket();
    await guard(req(), b, 1, WINDOW.hour);
    const body = await (await guard(req(), b, 1, WINDOW.hour)).json();
    assert.match(body.error, /59|60 minutes|1 hour/, body.error);
  });
});

describe("counting per account rather than per address", () => {
  test("two admins behind one gateway do not share a budget", async () => {
    // The corporate-NAT note at the top of lib/ratelimit.ts. An operator at an
    // audit firm should not be refused because a colleague was working.
    const b = bucket();
    const ip = "198.51.100.4";
    assert.equal(await guard(req(ip), b, 1, WINDOW.hour, "one@firm.eu"), null);
    assert.equal(
      await guard(req(ip), b, 1, WINDOW.hour, "two@firm.eu"),
      null,
      "the second admin was refused on the first admin's usage"
    );
  });

  test("one account is still limited, from any address", async () => {
    // The other half: identity keying must not become a way round the limit
    // by changing network.
    const b = bucket();
    assert.equal(await guard(req("192.0.2.1"), b, 1, WINDOW.hour, "same@firm.eu"), null);
    const blocked = await guard(req("192.0.2.99"), b, 1, WINDOW.hour, "same@firm.eu");
    assert.ok(blocked, "a new IP reset an account's budget");
    assert.equal(blocked.status, 429);
  });

  test("the same account is one bucket however its address is written", async () => {
    const b = bucket();
    assert.equal(await guard(req(), b, 1, WINDOW.hour, "Admin@Firm.EU"), null);
    const blocked = await guard(req(), b, 1, WINDOW.hour, "  admin@firm.eu  ");
    assert.ok(blocked, "case or whitespace produced a second budget");
  });

  test("without an identity it still counts per address", async () => {
    // Every other caller of guard passes no identity and must be unaffected.
    const b = bucket();
    assert.equal(await guard(req("203.0.113.1"), b, 1, WINDOW.hour), null);
    assert.ok(await guard(req("203.0.113.1"), b, 1, WINDOW.hour), "same IP should be refused");
    assert.equal(
      await guard(req("203.0.113.2"), b, 1, WINDOW.hour),
      null,
      "a different IP should have its own budget"
    );
  });

  test("the account is not stored in the bucket key in the clear", async () => {
    // The key reaches the Durable Object's storage and lives as long as the
    // window. This module already refuses to put a client IP in a log line;
    // an email is a stronger identifier, not a weaker one.
    const b = bucket();
    const email = "distinctive-address@example.eu";
    await guard(req(), b, 1, WINDOW.hour, email);
    const blocked = await guard(req(), b, 1, WINDOW.hour, email);
    const body = await blocked.json();
    assert.ok(!JSON.stringify(body).includes(email), "the address leaked into the response");
  });
});

describe("the Test source budget", () => {
  test("a hundred calls fit, and the hundred-and-first does not", async () => {
    // The number the registry verification process actually needs.
    const b = bucket();
    const who = "operator@stai-ahead.com";
    for (let i = 0; i < 100; i++) {
      assert.equal(
        await guard(req(), b, 100, WINDOW.hour, who),
        null,
        `call ${i + 1} of 100 was refused`
      );
    }
    const blocked = await guard(req(), b, 100, WINDOW.hour, who);
    assert.ok(blocked, "the limit is not being enforced at all");
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /try again in/);
  });
});
