import { expect, test } from '@playwright/test';

const password = 'Pilot-Test-Password!27';
const adminEmail = 'e2e-admin@satiengg.in';
const backendUrl = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:5100';
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
    await expect(navigation.getByRole('link', { name: 'Notice Board' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Campus Map' })).toHaveAttribute('href', '/campus-map');
    await expect(navigation.locator('[aria-disabled="true"]').filter({ hasText: 'Campus Issues' })).toBeVisible();
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
  await pageA.goto('/notices');
  await expect(pageA.getByRole('heading', { name: 'Campus Notice Board' })).toBeVisible();
  await expect(pageA.getByText('No notices available')).toBeVisible();
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
  test.setTimeout(120_000);
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
  const adminLogin = await request.post(`${backendUrl}/api/auth/login`, { data: { email: adminEmail, password } });
  const adminToken = (await adminLogin.json()).token;
  await page.goto('/admin/notices');
  await expect(page.getByRole('heading', { name: 'Notice Management' })).toBeVisible();
  await page.getByLabel('Title').fill('Draft Synthetic CSE Semester 7 Notice');
  await page.getByLabel('Content').fill('Complete the form before Friday. <script>alert(1)</script>');
  await page.getByLabel('Category', { exact: true }).selectOption('examination');
  await page.getByLabel('Priority').selectOption('urgent');
  await page.getByLabel('Target scope').selectOption('semester');
  await page.getByLabel('Computer Science and Engineering', { exact: true }).check();
  await page.getByLabel('Semester').selectOption('7');
  await page.getByText('Optional links and expiration', { exact: true }).click();
  await page.getByLabel('Attachment HTTPS URL').fill('https://fixtures.invalid/exam-form.pdf');
  await page.getByLabel('Attachment label').fill('Open exam form');
  await page.getByLabel('Expiration date and time').fill('2027-01-15T10:30');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByText('Notice saved as a draft.')).toBeVisible();
  let noticeCard = page.locator('article').filter({ hasText: 'Draft Synthetic CSE Semester 7 Notice' });
  await expect(noticeCard.getByText('draft', { exact: true })).toBeVisible();
  await noticeCard.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Title').fill('Synthetic CSE Semester 7 Notice');
  await expect(page.getByLabel('Expiration date and time')).toHaveValue('2027-01-15T10:30');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Notice changes saved.')).toBeVisible();
  noticeCard = page.locator('article').filter({ hasText: 'Synthetic CSE Semester 7 Notice' });
  await noticeCard.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Notice published.')).toBeVisible();
  await expect(noticeCard.getByText('published', { exact: true })).toBeVisible();
  await page.goto('/admin/academic-resources');
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
  await page.goto('/admin/notices');
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/notices');
  await expect(page.getByRole('heading', { name: 'Campus Notice Board' })).toBeVisible();
  await expect(page.getByText('Synthetic CSE Semester 7 Notice')).toBeVisible();
  await expect(page.getByText('Published on CampusSwap')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.getByRole('link', { name: 'View Details' }).click();
  await expect(page).toHaveURL(/\/notices\/[a-f0-9]{24}$/);
  const noticeId = new URL(page.url()).pathname.split('/').pop();
  await expect(page.getByRole('heading', { name: 'Synthetic CSE Semester 7 Notice' })).toBeVisible();
  await expect(page.getByText('<script>alert(1)</script>', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open exam form' })).toHaveAttribute('href', 'https://fixtures.invalid/exam-form.pdf');
  await expect(page.getByRole('button', { name: /Publish|Archive|Edit/ })).toHaveCount(0);
  await page.goto('/my-department');
  await expect(page.getByText('Synthetic E2E CSE Semester 7 Reference')).toBeVisible();
  await expect(page.getByText('Published resource', { exact: true })).toBeVisible();
  await expect(page.getByText(/This published document matches your program and semester/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Syllabus PDF' })).toBeVisible();
  const syllabusSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Syllabus' }) });
  await expect(syllabusSection.getByText('CSE', { exact: true })).toBeVisible();
  await expect(syllabusSection.getByText('7', { exact: true })).toBeVisible();
  await expect(syllabusSection.getByText('Not yet available', { exact: true })).toHaveCount(0);

  const studentLogin = await request.post(`${backendUrl}/api/auth/login`, { data: { email: students[0].email, password } });
  const studentToken = (await studentLogin.json()).token;
  const forbidden = await request.post(`${backendUrl}/api/admin/academic-resources`, { headers: { Authorization: `Bearer ${studentToken}` }, data: { title: 'Forbidden' } });
  expect(forbidden.status()).toBe(403);
  const forbiddenNotice = await request.post(`${backendUrl}/api/admin/notices`, { headers: { Authorization: `Bearer ${studentToken}` }, data: { title: 'Forbidden', content: 'Forbidden' } });
  expect(forbiddenNotice.status()).toBe(403);

  await page.getByRole('button', { name: /Account menu for/i }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/admin/academic-resources');
  await page.locator('article').filter({ hasText: 'Synthetic E2E CSE Semester 7 Reference' }).getByRole('button', { name: 'Retire' }).click();
  await expect(page.locator('article').filter({ hasText: 'Synthetic E2E CSE Semester 7 Reference' }).getByText(/Retired/)).toBeVisible();
  await page.goto('/admin/notices');
  await page.locator('article').filter({ hasText: 'Synthetic CSE Semester 7 Notice' }).getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Notice archived.')).toBeVisible();

  await page.getByRole('button', { name: /Account menu for/i }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.locator('input[type="email"]').fill(students[0].email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/my-department');
  await expect(page.getByRole('heading', { name: 'My Department' })).toBeVisible();
  await expect(page.getByText('Loading academic resources', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Synthetic E2E CSE Semester 7 Reference')).toHaveCount(0);
  await page.goto('/notices');
  await expect(page.getByRole('heading', { name: 'Campus Notice Board' })).toBeVisible();
  await expect(page.getByText('Loading notices', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Synthetic CSE Semester 7 Notice')).toHaveCount(0);
  await page.getByRole('button', { name: /Account menu for/i }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/admin/notices');
  await page.locator('article').filter({ hasText: 'Synthetic CSE Semester 7 Notice' }).getByRole('button', { name: 'Republish' }).click();
  await expect(page.getByText('Notice republished.')).toBeVisible();
  await page.getByRole('button', { name: /Account menu for/i }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.locator('input[type="email"]').fill(students[0].email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/notices');
  await expect(page.getByText('Synthetic CSE Semester 7 Notice')).toBeVisible();
  const noticeArchived = await request.post(`${backendUrl}/api/admin/notices/${noticeId}/archive`, { headers: { Authorization: `Bearer ${adminToken}` }, data: {} });
  expect(noticeArchived.status()).toBe(200);

  await test.step('student campus map uses published locations and stays usable at each breakpoint', async () => {
    const adminLocations = `${backendUrl}/api/admin/campus-locations`;
    const headers = { Authorization: `Bearer ${adminToken}` };
    async function fixture(name, category, status, latitude) {
      const coordinates = { latitude, longitude: 78 };
      const response = await request.post(adminLocations, {
        headers, data: { name, category, ...coordinates, description: 'Fictional location for browser testing.' }
      });
      expect(response.status()).toBe(201);
      const id = (await response.json()).data._id;
      if (status !== 'draft') {
        const verified = await request.post(`${adminLocations}/${id}/verify-coordinates`, {
          headers, data: { ...coordinates, coordinateSource: 'Synthetic browser test' }
        });
        expect(verified.ok()).toBeTruthy();
        expect((await request.post(`${adminLocations}/${id}/publish`, { headers })).ok()).toBeTruthy();
      }
      if (status === 'archived') expect((await request.post(`${adminLocations}/${id}/archive`, { headers })).ok()).toBeTruthy();
      return id;
    }
    await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=', 'base64')
    }));
    await page.goto('/campus-map');
    await expect(page.getByText(/No campus locations are available yet/)).toBeVisible();
    await fixture('Fictional Atlas Library', 'library', 'published', 23.5);
    await fixture('Fictional Atlas Courtyard', 'facility', 'published', 23.51);
    const draft = await fixture('Fictional Hidden Draft', 'library', 'draft', 23.52);
    const archived = await fixture('Fictional Hidden Archive', 'library', 'archived', 23.53);
    for (const id of [draft, archived]) {
      const response = await request.get(`${backendUrl}/api/campus-locations/${id}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      expect(response.status()).toBe(404);
    }

    await page.reload();
    const map = page.getByRole('region', { name: 'Interactive campus map' });
    const results = page.getByRole('list', { name: 'Location results' });
    const library = map.locator('img[alt="Fictional Atlas Library (library)"]');
    await expect(library).toBeVisible();
    await expect(results.getByRole('listitem')).toHaveCount(2);
    await expect(map.getByRole('link', { name: 'OpenStreetMap', exact: true })).toBeVisible();
    await library.click();
    const details = page.getByRole('region', { name: 'Location details' });
    await expect(details.getByRole('heading', { name: 'Fictional Atlas Library' })).toBeVisible();
    const directions = details.getByRole('link', { name: 'Get Directions' });
    await expect(directions).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=23.5%2C78');
    await expect(directions).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(details.getByText('Opening hours')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Publish|Archive|Edit location/ })).toHaveCount(0);
    for (const width of [320, 390, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByLabel('Search locations')).toBeVisible();
      await expect(page.getByLabel('Category', { exact: true })).toBeVisible();
      await expect(map.getByRole('button', { name: 'Zoom in' })).toBeVisible();
      await expect(directions).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    }
    await page.getByLabel('Category', { exact: true }).selectOption('library');
    await expect(results.getByRole('listitem')).toHaveCount(1);
    await expect(results.getByText('Fictional Atlas Courtyard')).toHaveCount(0);
    await page.getByLabel('Category', { exact: true }).selectOption('');
    await page.getByLabel('Search locations').fill('Courtyard');
    await expect(results.getByRole('listitem')).toHaveCount(1);
    await results.getByRole('button', { name: /Fictional Atlas Courtyard/ }).click();
    await expect(details.getByRole('heading', { name: 'Fictional Atlas Courtyard' })).toBeVisible();
    await page.route('**/api/campus-locations?*search=unavailable*', (route) => route.fulfill({
      status: 503, json: { message: 'Synthetic temporary outage' }
    }), { times: 1 });
    await page.getByLabel('Search locations').fill('unavailable');
    await expect(page.getByRole('alert')).toContainText('Synthetic temporary outage');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('No locations match your search or category.')).toBeVisible();
    await page.goto('/notices');
    await expect(page.getByRole('heading', { name: 'Campus Notice Board' })).toBeVisible();
  });
});

test('administrator manages campus coordinates through the student-visible lifecycle', async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(12_000);
  page.on('dialog', (dialog) => dialog.accept());
  const mockTiles = (view) => view.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=', 'base64')
  }));
  const login = async (view, email) => {
    await view.goto('/login');
    await view.locator('input[type="email"]').fill(email);
    await view.locator('input[type="password"]').fill(password);
    await view.getByRole('button', { name: 'Login' }).click();
    await expect(view.getByRole('button', { name: /Account menu for/i })).toBeVisible();
  };
  await mockTiles(page);
  await login(page, adminEmail);
  await page.goto('/admin');
  await page.getByRole('link', { name: 'Campus Locations' }).click();
  await expect(page.getByRole('heading', { name: 'Campus Locations', exact: true })).toBeVisible();

  const studentContext = await browser.newContext();
  try {
    const student = await studentContext.newPage();
    student.setDefaultTimeout(12_000);
    await mockTiles(student);
    await login(student, students[0].email);
    await student.goto('/admin/campus-locations');
    await expect(student).toHaveURL(/dashboard/);

    const suffix = Date.now().toString(36);
    const name = `Fictional Meridian Workshop ${suffix}`;
    const code = `E2E-${suffix.toUpperCase()}`;
    const alias = `Fictional Precision Lab ${suffix}`;
    const studentVisibility = async (visible, coordinates) => {
      await student.goto('/campus-map');
      await expect(student.getByRole('heading', { name: 'Campus Map' })).toBeVisible();
      await student.getByLabel('Search locations').fill(code);
      if (!visible) {
        await expect(student.getByText('No locations match your search or category.')).toBeVisible();
        return;
      }
      await student.getByRole('list', { name: 'Location results' }).getByRole('button', { name: new RegExp(name) }).click();
      const details = student.getByRole('region', { name: 'Location details' });
      await expect(details.getByRole('heading', { name })).toBeVisible();
      await expect(details.getByRole('link', { name: 'Get Directions' })).toHaveAttribute('href',
        `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: coordinates.join(',') })}`);
    };

    await page.getByRole('button', { name: 'Add Location' }).click();
    const editor = page.getByRole('region', { name: 'Location editor' });
    await editor.getByRole('button', { name: 'Save Draft' }).click();
    await expect(editor.getByRole('alert')).toContainText('Enter a location name');
    await editor.getByLabel('Location name').fill(name);
    await editor.getByLabel('Category', { exact: true }).selectOption('facility');
    await editor.getByLabel('Building code').fill(code);
    await editor.getByLabel('Aliases (one per line)').fill(alias);
    await editor.getByText('Advanced Details', { exact: true }).click();
    await editor.getByLabel('Opening hours').fill('Synthetic hours');
    await editor.getByRole('button', { name: 'Select on Map' }).click();
    const map = editor.getByRole('region', { name: 'Coordinate picker' });
    const canvas = map.locator('.leaflet-container');
    const marker = map.getByAltText('Selected coordinates');
    const latitude = editor.getByLabel('Latitude', { exact: true });
    const longitude = editor.getByLabel('Longitude', { exact: true });

    for (const width of [320, 390, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(latitude).toBeVisible();
      await expect(canvas).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await canvas.click({ position: { x: 100, y: 140 } });
    await expect(marker).toBeVisible();
    const clicked = await latitude.inputValue();
    expect(Number.isFinite(Number(clicked)) && clicked.length > 0).toBeTruthy();
    await marker.scrollIntoViewIfNeeded();
    const box = await marker.boundingBox();
    await page.mouse.move(box.x + 12, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(box.x + 35, box.y + 46, { steps: 5 });
    await page.mouse.up();
    await expect(latitude).not.toHaveValue(clicked);
    await latitude.fill('91');
    await expect(marker).toHaveCount(0);
    await editor.getByRole('button', { name: 'Save Draft' }).click();
    await expect(editor.getByRole('alert')).toContainText('numeric latitude');
    const initial = [23.50123456789, 78.00123456789];
    await latitude.fill(String(initial[0]));
    await longitude.fill(String(initial[1]));
    await expect(marker).toBeAttached();
    const saveDraft = editor.getByRole('button', { name: 'Save Draft' });
    await saveDraft.evaluate((button) => { button.click(); button.click(); });
    await expect(editor.getByRole('status')).toHaveText('Draft saved.');
    await expect(editor.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    await studentVisibility(false);

    async function verify() {
      await editor.getByRole('button', { name: 'Verify Coordinates' }).click();
      await expect(editor.getByRole('button', { name: 'Confirm Verification' })).toBeDisabled();
      await editor.getByLabel('Coordinate source').fill('Fictional browser test coordinates');
      await editor.getByRole('button', { name: 'Confirm Verification' }).click();
      await expect(editor.getByRole('status')).toHaveText('Coordinates verified.');
    }

    await verify();
    await studentVisibility(false);
    await editor.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Location published.');
    await studentVisibility(true, initial);

    await editor.getByRole('button', { name: 'Close editor' }).click();
    await page.getByLabel('Search locations').fill(alias);
    await page.getByLabel('Category filter').selectOption('facility');
    await page.getByLabel('Status filter').selectOption('draft');
    await expect(page.getByText('No campus locations match these filters.')).toBeVisible();
    await page.getByLabel('Status filter').selectOption('published');
    const rows = page.getByRole('list', { name: 'Managed campus locations' });
    await expect(rows.getByRole('listitem')).toHaveCount(1);
    await rows.getByRole('button', { name: 'Edit Location' }).click();
    await expect(latitude).toHaveValue(String(initial[0]));
    await editor.getByRole('button', { name: 'Select on Map' }).click();
    await expect(marker).toBeVisible();
    const updated = [23.51234567891, initial[1]];
    await latitude.fill(String(updated[0]));
    await expect(editor.getByRole('note')).toContainText('disappear from the student map');
    await editor.getByRole('button', { name: 'Save Changes' }).click();
    await expect(editor.getByRole('status')).toContainText('moved to draft');
    await studentVisibility(false);
    await verify();
    await editor.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Location published.');
    await studentVisibility(true, updated);
    await editor.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Location archived.');
    await studentVisibility(false);
    await editor.getByRole('button', { name: 'Republish', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Location published.');
    await studentVisibility(true, updated);

    const response = await request.post(`${backendUrl}/api/auth/login`, { data: { email: adminEmail, password } });
    expect(response.ok()).toBeTruthy();
    const headers = { Authorization: `Bearer ${(await response.json()).token}` };
    const endpoint = `${backendUrl}/api/admin/campus-locations`;
    const catalogue = await request.get(endpoint, { headers, params: { search: code } });
    expect(catalogue.ok()).toBeTruthy();
    const savedLocations = (await catalogue.json()).data;
    expect(savedLocations).toHaveLength(1);
    const [saved] = savedLocations;
    expect(saved.openingHoursText).toBe('Synthetic hours');
    const externalEdit = await request.patch(`${endpoint}/${saved._id}`, {
      headers: { ...headers, 'If-Match': `"${saved.__v}"` }, data: { description: 'Concurrent administrator edit' }
    });
    expect(externalEdit.ok()).toBeTruthy();
    await editor.getByLabel('Description', { exact: true }).fill('Unsaved local edit');
    await editor.getByRole('button', { name: 'Save Changes' }).click();
    await expect(editor.getByRole('alert')).toContainText('Location changed');
    await expect(editor.getByLabel('Description', { exact: true })).toHaveValue('Unsaved local edit');
    await expect(editor.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    await editor.getByRole('button', { name: 'Reload saved location' }).click();
    await expect(editor.getByLabel('Description', { exact: true })).toHaveValue('Concurrent administrator edit');
  } finally {
    await studentContext.close();
  }
});

test('admin campus location list retries an error and requests bounded pages', async ({ page }) => {
  const requests = [];
  await page.route('**/api/admin/campus-locations?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const pageNumber = Number(params.get('page'));
    requests.push({ page: pageNumber, limit: Number(params.get('limit')) });
    if (requests.length === 1) return route.fulfill({ status: 503, json: { message: 'Fictional catalogue outage' } });
    return route.fulfill({ json: {
      success: true,
      data: [{ _id: `fictional-${pageNumber}`, name: `Fictional page ${pageNumber} workshop`, status: 'draft', category: 'facility' }],
      pagination: { page: pageNumber, limit: 12, total: 13, totalPages: 2 }
    } });
  });
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('button', { name: /Account menu for/i })).toBeVisible();
  await page.goto('/admin/campus-locations');
  await expect(page.getByRole('alert')).toContainText('Fictional catalogue outage');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fictional page 1 workshop' })).toBeVisible();
  const pagination = page.getByRole('navigation', { name: 'Campus location pagination' });
  await pagination.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Fictional page 2 workshop' })).toBeVisible();
  await expect(pagination.getByRole('button', { name: 'Next' })).toBeDisabled();
  await pagination.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByRole('heading', { name: 'Fictional page 1 workshop' })).toBeVisible();
  expect(requests).toEqual([1, 1, 2, 1].map((number) => ({ page: number, limit: 12 })));
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
