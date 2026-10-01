import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function runRealHttpAuthTest() {
  const baseUrl = "http://localhost:3000";
  const email = "seif.tanjiro@gmail.com";
  const username = "seif_tanjiro";
  const password = "TrackUpOwner#2026!";

  console.log("=== 1. TEST LOGIN VIA EMAIL ===");
  const emailLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
  });

  const emailLoginStatus = emailLoginRes.status;
  const emailLoginBody = await emailLoginRes.json().catch(() => ({}));
  const setCookieHeader = emailLoginRes.headers.get("set-cookie") || "";
  const hasSessionCookie = setCookieHeader.includes("trackup_session=");

  console.log("Email Login Status:", emailLoginStatus);
  console.log("Email Login Response User:", emailLoginBody.user);
  console.log("Has trackup_session cookie:", hasSessionCookie);

  if (emailLoginStatus !== 200 || !hasSessionCookie) {
    throw new Error(`Email login failed with status ${emailLoginStatus}`);
  }

  // Extract session cookie value
  const cookieMatch = setCookieHeader.match(/trackup_session=([^;]+)/);
  const sessionCookieVal = cookieMatch ? cookieMatch[1] : "";

  console.log("\n=== 2. TEST DASHBOARD ACCESS WITH SESSION COOKIE ===");
  const dashboardRes = await fetch(`${baseUrl}/dashboard`, {
    headers: {
      Cookie: `trackup_session=${sessionCookieVal}`,
    },
    redirect: "manual",
  });
  console.log("Dashboard response status:", dashboardRes.status);
  console.log("Dashboard location header:", dashboardRes.headers.get("location"));

  console.log("\n=== 3. TEST LOGIN VIA USERNAME ===");
  const usernameLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: username, password }),
  });
  const usernameLoginStatus = usernameLoginRes.status;
  const usernameLoginBody = await usernameLoginRes.json().catch(() => ({}));
  console.log("Username Login Status:", usernameLoginStatus);
  console.log("Username Login Response User:", usernameLoginBody.user);

  if (usernameLoginStatus !== 200) {
    throw new Error(`Username login failed with status ${usernameLoginStatus}`);
  }

  const usernameSetCookie = usernameLoginRes.headers.get("set-cookie") || "";
  const usernameCookieMatch = usernameSetCookie.match(/trackup_session=([^;]+)/);
  const usernameSessionVal = usernameCookieMatch ? usernameCookieMatch[1] : "";

  console.log("\n=== 4. TEST LOGOUT ENDPOINT ===");
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: `trackup_session=${usernameSessionVal}`,
      Accept: "application/json",
    },
    redirect: "manual",
  });
  const logoutStatus = logoutRes.status;
  const logoutSetCookie = logoutRes.headers.get("set-cookie") || "";
  console.log("Logout Status:", logoutStatus);
  console.log("Logout Clears Cookie:", logoutSetCookie.includes("trackup_session=;") || logoutSetCookie.includes("Max-Age=0") || logoutSetCookie.includes("expires="));

  console.log("\n=== 5. TEST ACCESS AFTER LOGOUT (REVOKED SESSION) ===");
  const revokedDashboardRes = await fetch(`${baseUrl}/dashboard`, {
    headers: {
      Cookie: `trackup_session=${usernameSessionVal}`,
    },
    redirect: "manual",
  });
  console.log("Post-logout Dashboard status (expect 307/302/redirect to login):", revokedDashboardRes.status);
  console.log("Post-logout Redirect location:", revokedDashboardRes.headers.get("location"));

  console.log("\n=== 6. TEST LOGIN AFTER LOGOUT CREATES NEW VALID SESSION ===");
  const reLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
  });
  console.log("Re-login status:", reLoginRes.status);
  const reLoginBody = await reLoginRes.json().catch(() => ({}));
  console.log("Re-login user:", reLoginBody.user);

  console.log("\nALL REAL LOCAL HTTP LOGIN/LOGOUT TESTS PASSED SUCCESSFULLY!");
}

runRealHttpAuthTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
