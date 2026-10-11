
import { guestRequest } from "./guestSandbox.js";

const API_BASE_URL = "/api";

function getToken() {
  return localStorage.getItem("medipilot_token");
}

async function request(endpoint, options = {}) {
  const demoDataEnabled = localStorage.getItem("medipilot_demo_data") === "true";
  const user = getSavedUser();

  if (user?.isDemo && !demoDataEnabled) {
    return guestRequest(endpoint, options, user);
  }

  if (demoDataEnabled && !endpoint.startsWith("/shares/public/")) {
    throw new Error(
      "Demo data preview is read-only. Turn demo data off to use account features."
    );
  }

  const token = getToken();

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object"
        ? data.message || data.error || "Request failed"
        : data || "Request failed";

    throw new Error(message);
  }

  return data;
}

export const api = {
  get(endpoint) {
    return request(endpoint, { method: "GET" });
  },

  post(endpoint, body = {}) {
    return request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  put(endpoint, body = {}) {
    return request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  patch(endpoint, body = {}) {
    return request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return request(endpoint, { method: "DELETE" });
  },

  upload(endpoint, formData) {
    return request(endpoint, {
      method: "POST",
      body: formData,
    });
  },
};

export function saveSession(token, user) {
  localStorage.setItem("medipilot_token", token);
  localStorage.setItem("medipilot_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("medipilot_token");
  localStorage.removeItem("medipilot_user");
}

export function getSavedUser() {
  try {
    const user = localStorage.getItem("medipilot_user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}
