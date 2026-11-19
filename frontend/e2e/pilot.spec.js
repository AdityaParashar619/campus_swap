import { expect, test } from '@playwright/test';

const password = 'Pilot-Test-Password!27';
const students = [
  { name: 'Pilot Student Alpha', email: 'alpha27cs001@satiengg.in', enrollment: '0108cs271001' },
  { name: 'Pilot Student Beta', email: 'beta27cs002@satiengg.in', enrollment: '0108cs271002' }
];

const register = async (page, student) => {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill(student.name);
  await page.getByLabel('College email').fill(student.email);
  await page.getByLabel('Enrollment number').fill(student.enrollment);
  await page.getByLabel('Department').fill('CSE');
  await page.getByLabel('Branch').fill('cs');
  await page.getByLabel('Current semester/year').fill('7');
  await page.getByLabel('Phone number').fill('9876543210');
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole('button', { name: 'Continue to email verification' }).click();
  await expect(page).toHaveURL(/verify-email/);
  const code = await page.getByText(/Local mail capture code:/).locator('strong').textContent();
  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page).toHaveURL(/dashboard/);
};

test('two isolated students register, retain academic identity, connect, and remain account-isolated', async ({ browser }) => {
  test.setTimeout(120_000);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await register(pageA, students[0]);
  await register(pageB, students[1]);

  await pageA.goto('/profile');
  await expect(pageA.getByText(students[0].enrollment, { exact: true })).toBeVisible();
  await expect(pageA.getByText(students[0].email, { exact: true })).toBeVisible();
  await expect(pageA.getByRole('heading', { name: 'Academic information' })).toBeVisible();
  await expect(pageA.getByLabel('Enrollment number')).toHaveCount(0);

  await pageA.goto('/network');
  const betaCard = pageA.locator('div').filter({ hasText: students[1].name }).filter({ has: pageA.getByRole('button', { name: 'Connect' }) }).last();
  await betaCard.getByRole('button', { name: 'Connect' }).click();
  await expect(pageA.getByText('Connection request sent')).toBeVisible();

  await pageB.goto('/network');
  await expect(pageB.getByText(students[0].name, { exact: true }).first()).toBeVisible();
  await pageB.getByRole('button', { name: 'Accept' }).first().click();
  await expect(pageB.getByText('Connection accepted')).toBeVisible();

  await pageA.goto('/chat');
  await pageA.getByText(students[1].name, { exact: true }).click();
  await pageA.getByLabel(`Message to ${students[1].name}`).fill('Hello from isolated Student A');
  await pageA.getByRole('button', { name: 'Send' }).click();
  await expect(pageB.getByLabel(/Notifications/)).toBeVisible();

  await pageA.getByRole('button', { name: /Account menu for/i }).click();
  await pageA.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(pageA).toHaveURL(/\/$/);
  await expect(pageB).not.toHaveURL(/login/);
  await contextA.close(); await contextB.close();
});

for (const width of [320, 390, 768, 1280, 1920]) {
  test(`login is responsive at ${width}px in light and dark themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.goto('/login');
      await page.evaluate((value) => { localStorage.setItem('theme', value); document.documentElement.classList.toggle('dark', value === 'dark'); }, theme);
      await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    }
  });
}
