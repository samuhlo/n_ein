# Deepening

How to merge a cluster of shallow modules into a deep one safely, given its dependencies. Uses the vocabulary in [SKILL.md](SKILL.md).

## Classify the dependencies

The category decides how the deepened module is tested across its seam.

1. **In-process**: pure computation, in-memory state, no I/O. Always deepenable: merge and test through the new interface. No adapter.
2. **Local stand-in**: dependencies with a local substitute (PGLite for Postgres, an in-memory file system). Deepenable if the stand-in exists; tests run against it. The seam stays internal.
3. **Remote but owned**: your own services across the network. Define a **port** at the seam; the deep module owns the logic and the transport is an injected adapter: in-memory for tests, HTTP/gRPC/queue in production.
4. **Truly external**: third-party services you do not control. Inject them as a port; tests use a doubled adapter.

## Seam discipline

- Add a port only when at least two adapters are justified (usually production + test). A single-adapter seam is just indirection.
- Internal seams stay internal, even when tests use them.

## Replace, don't layer

- Once tests exist at the deepened interface, delete the old unit tests of the shallow modules.
- Test observable outcomes through the interface, not internal state.
- A test that must change when the implementation changes is testing past the interface.
