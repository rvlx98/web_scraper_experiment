export async function fetchRobotsTxt(origin) {
  try {
    const url = new URL("/robots.txt", origin).toString();
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) return null;
    const text = await r.text();
    return text;
  } catch {
    return null;
  }
}

