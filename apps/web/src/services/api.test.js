import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const user = { id: 7, name: "Usta", email: "usta@example.com" };

async function loadApi(mode) {
  vi.resetModules();
  vi.stubEnv("VITE_AUTH_MODE", mode);
  vi.stubEnv("VITE_API_URL", "");
  return import("./api.js");
}

describe("auth modes", () => {
  let fetchMock;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("cookie mode never stores or sends the token", async () => {
    const api = await loadApi("cookie");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { user } }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    await api.login({ email: user.email, password: "secret123" });
    await api.getCustomers();

    const [loginUrl, loginOptions] = fetchMock.mock.calls[0];
    expect(loginUrl).toBe("/api/auth/login");
    expect(loginOptions.headers["X-Auth-Mode"]).toBe("cookie");
    expect(loginOptions.credentials).toBe("include");
    const [, customersOptions] = fetchMock.mock.calls[1];
    expect(customersOptions.headers.Authorization).toBeUndefined();
    expect(customersOptions.credentials).toBe("include");
    expect(localStorage.getItem("islik_cloud_token")).toBeNull();
    expect(api.hasSession()).toBe(true);
  });

  it("cookie mode asks the server to clear the httpOnly cookie on logout", async () => {
    const api = await loadApi("cookie");
    api.setStoredUser(user);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await api.logout();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
    expect(api.hasSession()).toBe(false);
  });

  it("bearer mode keeps the previous token behaviour", async () => {
    const api = await loadApi("bearer");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { user, token: "jwt-token" } }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    await api.login({ email: user.email, password: "secret123" });
    await api.getCustomers();

    const [, loginOptions] = fetchMock.mock.calls[0];
    expect(loginOptions.headers["X-Auth-Mode"]).toBeUndefined();
    const [, customersOptions] = fetchMock.mock.calls[1];
    expect(customersOptions.headers.Authorization).toBe("Bearer jwt-token");
    expect(customersOptions.credentials).toBeUndefined();
    expect(api.hasSession()).toBe(true);
  });
});
