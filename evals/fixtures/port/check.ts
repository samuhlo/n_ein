import { strict as assert } from "node:assert";
import { parsePort } from "./parse-port";

assert.equal(parsePort("3000"), 3000);
assert.equal(parsePort("65535"), 65535);
assert.equal(parsePort("0"), undefined);
assert.equal(parsePort("65536"), undefined);
assert.equal(parsePort("abc"), undefined);
