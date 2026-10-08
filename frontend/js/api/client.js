/** Resource IDs are opaque UUID strings; account types remain business codes.
 * Same-origin REST transport. Spring Boot serves the UI and API on port 8080. */
export const apiConfig = Object.freeze({
  baseURL: "/api/v1",
  timeout: 45000,
  demo: true,
});

export async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), apiConfig.timeout);

  try {
    const response = await fetch(apiConfig.baseURL + path, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Hikyu-Request": "web",
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(
        payload.message || `Request failed (${response.status})`,
      );
      error.status = response.status;
      error.code = payload.code;
      if (response.status === 401 && !path.startsWith("/auth/")) {
        globalThis.dispatchEvent?.(new Event("hikyu:session-expired"));
      }
      throw error;
    }

    return response.status === 204 ? null : await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function sendJSON(path, method, payload) {
  return request(path, {
    method,
    body: JSON.stringify(payload),
  });
}
