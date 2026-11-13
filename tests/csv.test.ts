import assert from "node:assert/strict";
import test from "node:test";
import { toCsv } from "../src/lib/csv";

test("csv escapes formulas and keeps Chinese headers", () => {
  const csv = toCsv(
    ["公司", "邮箱"],
    [
      ["=cmd()", "ada@northwind.example"],
      ['Harbor, "Ltd"', "sales@harbor.example"],
    ],
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /公司,邮箱/);
  assert.match(csv, /'=cmd\(\)/);
  assert.match(csv, /"Harbor, ""Ltd"""/);
});
