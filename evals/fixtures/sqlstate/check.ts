import { strict as assert } from "node:assert";
import { findSqlState } from "./sqlstate";

assert.equal(findSqlState({ sqlState: "23505" }), "23505");
assert.equal(findSqlState({ sqlState: "42P01" }), "42P01");
assert.equal(findSqlState(new Error("sin código")), undefined);
assert.equal(findSqlState(null), undefined);
