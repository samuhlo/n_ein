import { strict as assert } from "node:assert";
import { probeExecutionFailure } from "../previewer/src/probe-result.ts";

assert.ok(probeExecutionFailure(1, "Error: Cannot find module '/copy/.previewer-probes/render_queue.mjs'"));
assert.ok(probeExecutionFailure(1, "ModuleNotFoundError: No module named 'pytest'"));
assert.ok(probeExecutionFailure(2, "E   ImportError: cannot import name 'pytest'"));
assert.ok(probeExecutionFailure(2, "python: can't open file '/copy/.previewer-probes/check.py': [Errno 2] No such file or directory"));
assert.ok(probeExecutionFailure(4, "ERROR: file or directory not found: .previewer-probes/check.py"));
assert.ok(probeExecutionFailure(5, "no tests ran in 0.02s"));
assert.ok(probeExecutionFailure(127, "command not found"));
assert.ok(probeExecutionFailure(1, "E   subprocess.CalledProcessError: Command '['node', '.previewer-probes/render_queue.mjs']' returned non-zero exit status 1."));
assert.equal(probeExecutionFailure(1, "AssertionError: Reader B is disabled by reader A's pending removal"), null);
assert.equal(probeExecutionFailure(0, "0 failures"), null);
assert.equal(probeExecutionFailure(null, "timed out"), null);
console.log("previewer probe execution failures: OK");
