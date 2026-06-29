import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Dealer key injected at build time via VITE_DEFAULT_DEALER env var.
// The orchestrator sets this per dealer during onboarding.
const DEALER_KEY = import.meta.env.VITE_DEFAULT_DEALER ?? "findndrive";

const WIDGET_JS = `
(function () {
  if (window.__EfficientWidgetLoaded) return;
  window.__EfficientWidgetLoaded = true;

  var config = window.EfficientWidget || {};
  var dealer = config.dealer || "${DEALER_KEY}";

  // Derive base URL from the script's own src so no URL needs to be hardcoded.
  var scriptEl = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();
  var baseUrl = scriptEl && scriptEl.src
    ? scriptEl.src.replace(/\\/widget\\.js.*$/, "")
    : window.location.origin;

  var label        = config.label        || "Check affordability";
  var tagline      = config.tagline      || "Find out what you qualify for in 60 seconds.";
  var primaryColor = config.primaryColor || "#6C3FC5";

  // ── Styles ────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    "#__efficient-widget-btn {",
    "  position: fixed; bottom: 24px; right: 24px; z-index: 99999;",
    "  display: flex; align-items: center; gap: 10px;",
    "  background: " + primaryColor + ";",
    "  color: #fff; font-family: system-ui, sans-serif;",
    "  font-size: 14px; font-weight: 700;",
    "  padding: 13px 20px; border-radius: 50px; border: none;",
    "  cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.2);",
    "  transition: transform .15s, box-shadow .15s;",
    "}",
    "#__efficient-widget-btn:hover {",
    "  transform: translateY(-2px);",
    "  box-shadow: 0 8px 28px rgba(0,0,0,0.25);",
    "}",
    "#__efficient-widget-overlay {",
    "  display: none; position: fixed; inset: 0; z-index: 99998;",
    "  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);",
    "}",
    "#__efficient-widget-overlay.open { display: block; }",
    "#__efficient-widget-frame {",
    "  display: none; position: fixed;",
    "  bottom: 80px; right: 24px; z-index: 99999;",
    "  width: 420px; max-width: calc(100vw - 32px);",
    "  height: 80vh; max-height: 700px;",
    "  border: none; border-radius: 16px;",
    "  box-shadow: 0 20px 60px rgba(0,0,0,0.3);",
    "  background: #fff;",
    "}",
    "#__efficient-widget-frame.open { display: block; }",
    "@media(max-width: 480px) {",
    "  #__efficient-widget-frame {",
    "    bottom: 0; right: 0; left: 0;",
    "    width: 100%; max-width: 100%;",
    "    height: 90vh; border-radius: 16px 16px 0 0;",
    "  }",
    "  #__efficient-widget-btn { right: 16px; bottom: 16px; }",
    "}",
  ].join("\\n");
  document.head.appendChild(style);

  // ── Button ─────────────────────────────────────────────────────
  var btn = document.createElement("button");
  btn.id = "__efficient-widget-btn";
  btn.setAttribute("aria-label", label);
  btn.innerHTML = [
    "<svg width=\\"18\\" height=\\"18\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2.5\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\">",
    "<path d=\\"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z\\"/>",
    "<path d=\\"M12 6v6l4 2\\"/>",
    "</svg>",
    "<span>" + label + "</span>",
  ].join("");
  document.body.appendChild(btn);

  // ── Overlay ────────────────────────────────────────────────────
  var overlay = document.createElement("div");
  overlay.id = "__efficient-widget-overlay";
  document.body.appendChild(overlay);

  // ── iframe ─────────────────────────────────────────────────────
  var frame = document.createElement("iframe");
  frame.id = "__efficient-widget-frame";
  frame.title = label;
  frame.allow = "same-origin";
  document.body.appendChild(frame);

  // ── Toggle ─────────────────────────────────────────────────────
  var isOpen = false;

  function open() {
    if (!frame.src) {
      frame.src = baseUrl + "/?dealer=" + dealer + "&widget=1";
    }
    frame.classList.add("open");
    overlay.classList.add("open");
    isOpen = true;
  }

  function close() {
    frame.classList.remove("open");
    overlay.classList.remove("open");
    isOpen = false;
  }

  btn.addEventListener("click", function () { isOpen ? close() : open(); });
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) close();
  });
})();
`;

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // Serve widget.js dynamically
    if (url.pathname === "/widget.js") {
      return new Response(WIDGET_JS, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=300",
          "access-control-allow-origin": "*",
        },
      });
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
