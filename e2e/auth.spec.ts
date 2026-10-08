import { alertBox, expect, login, logout, test } from "./support";

test.describe("authentication", () => {
  test("signed-out visitors are sent to login and returned after signing in", async ({ page, agent }) => {
    await page.goto("/listings");
    await expect(page).toHaveURL(/\/login\?next=%2Flistings/);
    await page.getByLabel("Email").fill(agent.email);
    await page.getByLabel("Password").fill(agent.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/listings$/);
  });

  test("public pages are reachable while signed out", async ({ page }) => {
    for (const path of ["/", "/login", "/register", "/forgot-password", "/pricing"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
    }
  });

  test("wrong password shows an error", async ({ page, agent }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(agent.email);
    await page.getByLabel("Password").fill("definitely-wrong-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(alertBox(page)).toHaveText("Incorrect email or password.");
  });

  test("login ignores off-site redirect targets", async ({ page, agent }) => {
    await page.goto("/login?next=//evil.example.com");
    await page.getByLabel("Email").fill(agent.email);
    await page.getByLabel("Password").fill(agent.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/dashboard/);
  });

  test("signed-in users are redirected away from login and can sign out", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/);
    await logout(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("registration validates input before contacting the server", async ({ page }) => {
    // Successful sign-up sends a confirmation email (rate limited), so only validation is exercised here.
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Juan Cruz");
    await page.getByLabel("Email").fill("e2e.reg@example.com");
    await page.getByLabel("Password").evaluate((el: HTMLInputElement) => el.removeAttribute("minlength"));
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(alertBox(page)).toHaveText("Password must be at least 8 characters.");
  });

  test("password reset always gives the same answer", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(`e2e.nobody.${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists for that email")).toBeVisible();
  });

  test("set-password without a valid link shows an error", async ({ page }) => {
    await page.goto("/auth/set-password");
    await expect(page.getByText("This link is invalid or has expired.")).toBeVisible();
  });

  test("signed-in user can change their password", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/auth/set-password");
    const newPassword = `${agent.password}-new`;
    await page.getByLabel("New password").fill(newPassword);
    await page.getByLabel("Confirm password").fill("mismatch-123");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(alertBox(page)).toHaveText("Passwords do not match.");
    await page.getByLabel("Confirm password").fill(newPassword);
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await logout(page);
    await login(page, { ...agent, password: newPassword });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
