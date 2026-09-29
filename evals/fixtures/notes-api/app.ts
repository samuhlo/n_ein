export function createApp() {
  return {
    fetch(request: Request): Response {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") {
        return Response.json({ ok: true });
      }
      return new Response("Not found", { status: 404 });
    },
  };
}
