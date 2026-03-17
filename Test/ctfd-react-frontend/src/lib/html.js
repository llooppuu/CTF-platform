function escapeHtml(input = "") {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function fallbackHtmlFromText(text) {
  if (!text) {
    return "";
  }

  return escapeHtml(text).replaceAll("\n", "<br />");
}

export function filenameFromUrl(url = "") {
  try {
    const parsed = new URL(url, window.location.origin);
    return decodeURIComponent(parsed.pathname.split("/").pop() || "download");
  } catch {
    return "download";
  }
}

export function extractChallengePresentation(detail) {
  const fallback = {
    descriptionHtml: fallbackHtmlFromText(detail?.description || ""),
    connectionHtml: detail?.connection_info ? escapeHtml(detail.connection_info) : "",
    hints: []
  };

  if (!detail?.view) {
    return fallback;
  }

  const doc = new DOMParser().parseFromString(detail.view, "text/html");
  const descriptionHtml =
    doc.querySelector(".challenge-desc")?.innerHTML?.trim() || fallback.descriptionHtml;
  const connectionHtml =
    doc.querySelector(".challenge-connection-info")?.innerHTML?.trim() || fallback.connectionHtml;

  const hints = [...doc.querySelectorAll(".challenge-hints details")].map((node) => ({
    summary: node.querySelector("summary")?.textContent?.trim() || "Hint",
    contentHtml: node.querySelector("div")?.innerHTML?.trim() || ""
  }));

  return { descriptionHtml, connectionHtml, hints };
}
