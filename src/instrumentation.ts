export async function register() {
  // Only run on the Node.js server (not edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Wait 8 seconds for the server to be fully ready, then pre-warm the scan cache
  setTimeout(async () => {
    try {
      const port = process.env.PORT || 3000;
      const url = `http://localhost:${port}/api/scan/stream?growth=33&profitability=33&valuation=34`;
      console.log("[instrumentation] Pre-warming scan cache...");

      const res = await fetch(url);
      // Drain the SSE stream so the cache gets saved
      const reader = res.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
      console.log("[instrumentation] Scan cache warmed ✓");
    } catch (e) {
      console.error("[instrumentation] Cache warm-up failed:", e);
    }
  }, 8000);
}
