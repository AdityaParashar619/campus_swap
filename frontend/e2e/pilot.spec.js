import { expect, test } from '@playwright/test';

const password = 'Pilot-Test-Password!27';
const adminEmail = 'e2e-admin@satiengg.in';
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

  for (const width of [320, 375, 390, 768, 1024]) {
    await pageA.setViewportSize({ width, height: 900 });
    await pageA.getByRole('button', { name: 'Open navigation menu' }).click();
    const navigation = pageA.locator('#mobile-navigation');
    await expect(navigation.getByRole('heading', { name: 'College Services' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'My Department' })).toBeVisible();
    for (const label of ['Notice Board', 'Campus Map', 'Campus Issues']) {
      await expect(navigation.locator('[aria-disabled="true"]').filter({ hasText: label })).toBeVisible();
    }
    await expect(navigation.getByRole('link', { name: 'Notes' })).toBeVisible();
    expect(await pageA.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await navigation.getByRole('link', { name: 'Marketplace' }).click();
    await expect(navigation).toBeHidden();
    await expect(pageA).toHaveURL(/\/listings$/);
    if (width === 390) {
      await pageA.getByRole('button', { name: 'Switch to dark theme' }).click();
      await expect(pageA.locator('html')).toHaveClass(/dark/);
      await pageA.getByRole('button', { name: 'Open navigation menu' }).click();
      await expect(pageA.locator('#mobile-navigation').getByRole('heading', { name: 'College Services' })).toBeVisible();
      await pageA.getByRole('button', { name: 'Close navigation menu' }).click();
      await pageA.getByRole('button', { name: 'Switch to light theme' }).click();
      await expect(pageA.locator('html')).not.toHaveClass(/dark/);
    }
  }
  for (const width of [1180, 1280, 1366, 1440, 1920]) {
    await pageA.setViewportSize({ width, height: 1000 });
    await expect(pageA.getByRole('button', { name: 'College Services' })).toBeVisible();
    const boxes = await pageA.locator('nav a:visible, nav button:visible').evaluateAll((elements) => elements.map((element) => { const r=element.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom }; }));
    for (let i=0;i<boxes.length;i+=1) for (let j=i+1;j<boxes.length;j+=1) { const a=boxes[i],b=boxes[j]; const overlap=Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1; expect(overlap).toBe(false); }
    expect(await pageA.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  }
  await pageA.getByRole('link', { name: 'CampusSwap dashboard' }).click();
  await expect(pageA).toHaveURL(/dashboard/);
  await pageA.getByRole('button', { name: 'College Services' }).click();
  await pageA.getByRole('link', { name: 'My Department' }).click();
  await expect(pageA.getByRole('heading', { name: 'My Department' })).toBeVisible();
  await pageA.goto('/notes');
  await expect(pageA.getByRole('heading', { name: 'Notes Exchange' })).toBeVisible();
  await expect(pageA.getByRole('button', { name: 'Upload Note' })).toBeVisible();
  await expect(pageA.getByText('No notes match these filters.')).toBeVisible();

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
  await pageA.getByRole('button', { name: 'Log out' }).click();
  await expect(pageA).toHaveURL(/\/login$/);
  await expect(pageB).not.toHaveURL(/login/);
  await contextA.close(); await contextB.close();
});

test('administrator publishes and retires a development fixture while student isolation holds', async ({ page, request }) => {
  test.setTimeout(90_000);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole('button', { name: /Account menu for/i }).click();
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Admin' }).click();
  await page.getByRole('link', { name: 'Academic resources' }).click();
  await expect(page.getByRole('heading', { name: 'Academic Resources' })).toBeVisible();
  await page.getByLabel('Title').fill('Synthetic E2E CSE Semester 7 Reference');
  await page.getByLabel('Official HTTPS URL').fill('https://fixtures.invalid/cse-semester-7-reference.pdf');
  await page.getByLabel('Source page HTTPS URL').fill('https://fixtures.invalid/catalogue');
  await page.getByLabel('Type', { exact: true }).selectOption('syllabus');
  await page.getByLabel('Program').selectOption('CSE');
  await page.getByLabel('Semester').selectOption('7');
  await expect(page.getByLabel('Academic session (YYYY-YY)')).toBeHidden();
  await expect(page.getByLabel('Admission batch (YYYY)')).toBeHidden();
  await page.getByText('Advanced details', { exact: true }).click();
  await page.getByLabel('Academic session (YYYY-YY)').fill('2025-26');
  await page.getByLabel('Admission batch (YYYY)').fill('2023');
  await page.getByLabel('Applicability evidence').fill('Synthetic fixture controlled by the isolated E2E test.');
  await page.getByLabel('Uncertainty / review notes').fill('Student applicability is intentionally unconfirmed.');
  await page.getByLabel('Source checked at').fill('2026-11-20');
  await page.getByRole('button', { name: 'Save & Publish' }).click();
  await expect(page.getByText('Academic resource saved and published.')).toBeVisible();
  const resourceCard = page.locator('article').filter({ hasText: 'Synthetic E2E CSE Semester 7 Reference' });
  await expect(resourceCard.getByText(/unverified/)).toBeVisible();
  await expect(resourceCard.getByText(/ · published · unverified · Active$/)).toBeVisible();
  await page.getByText('Advanced details', { exact: true }).click();
  await resourceCard.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByLabel('Academic session (YYYY-YY)')).toBeHidden();
  await page.getByText('Advanced details', { exact: true }).click();
  await expect(page.getByLabel('Academic session (YYYY-YY)')).toHaveValue('2025-26');
  await expect(page.getByLabel('Admission batch (YYYY)')).toHaveValue('2023');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: /Account menu for/i }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.locator('input[type="email"]').fill(students[0].email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/my-department');
  await expect(page.getByText('Synthetic E2E CSE Semester 7 Reference')).toBeVisible();
  await expect(page.getByText('Published resource', { exact: true })).toBeVisible();
  await expect(page.getByText(/This published document matches your program and semester/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Syllabus PDF' })).toBeVisible();
  const syllabusSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Syllabus' }) });
  await expect(syllabusSection.getByText('CSE', { exact: true })).toBeVisible();
  await expect(syllabusSection.getByText('7', { exact: true })).toBeVisible();
  await expect(syllabusSection.getByText('Not yet available', { exact: true })).toHaveCount(0);

  const studentLogin = await request.post('http://127.0.0.1:5100/api/auth/login', { data: { email: students[0].email, password } });
  const studentToken = (await studentLogin.json()).token;
  const forbidden = await request.post('http://127.0.0.1:5100/api/admin/academic-resources', { headers: { Authorization: `Bearer ${studentToken}` }, data: { title: 'Forbidden' } });
  expect(forbidden.status()).toBe(403);

  await page.getByRole('button', { name: /Account menu for/i }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/admin/academic-resources');
  await page.locator('article').filter({ hasText: 'Synthetic E2E CSE Semester 7 Reference' }).getByRole('button', { name: 'Retire' }).click();
  await expect(page.locator('article').filter({ hasText: 'Synthetic E2E CSE Semester 7 Reference' }).getByText(/Retired/)).toBeVisible();

  await page.getByRole('button', { name: /Account menu for/i }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.locator('input[type="email"]').fill(students[0].email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/my-department');
  await expect(page.getByText('Synthetic E2E CSE Semester 7 Reference')).toHaveCount(0);
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
