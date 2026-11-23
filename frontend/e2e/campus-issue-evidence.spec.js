import { expect, test } from '@playwright/test';

const password = 'Pilot-Test-Password!27';
const backend = 'http://127.0.0.1:5194';
const owner = 'e4-owner@satiengg.in';
const other = 'e4-other@satiengg.in';
const admin = 'e4-admin@satiengg.in';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQYlWMw6G8iiBhGFQEAffN4YchJkesAAAAASUVORK5CYII=', 'base64');
const photo = (name) => ({ name, mimeType: 'image/png', buffer: png });

test('private evidence, report History and selected test cleanup work across mobile and desktop', async ({ browser, page, request }) => {
  test.skip(process.env.CAMPUS_ISSUE_E4_BROWSER !== '1', 'Requires the guarded E4 browser test server');
  test.setTimeout(120_000);
  const login = async (view, email) => {
    await view.goto('/login');
    await view.locator('input[type="email"]').fill(email);
    await view.locator('input[type="password"]').fill(password);
    await view.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(view).toHaveURL(/dashboard/);
  };
  const headersFor = async (email) => {
    const loginResponse = await request.post(`${backend}/api/auth/login`, { data: { email, password } });
    expect(loginResponse.ok()).toBeTruthy();
    return { Authorization: `Bearer ${(await loginResponse.json()).token}` };
  };
  const overflow = (view) => view.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const evidenceButton = (view) => view.getByRole('button', { name: 'View evidence photo 1' });
  const studentContext = await browser.newContext();
  const otherContext = await browser.newContext();
  try {
    const student = await studentContext.newPage();
    await login(student, owner);
    await student.goto('/campus-issues/new');
    const title = 'E4 selected enrollment-free photo fixture';
    await student.getByLabel('Title', { exact: true }).fill(title);
    await student.getByLabel('Category', { exact: true }).selectOption('water');
    await student.getByLabel('Description', { exact: true }).fill('A synthetic photo demonstrating the private report workflow.');
    const picker = student.getByLabel('Photo evidence (optional)');
    await picker.setInputFiles({ name: 'invalid.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expect(student.getByRole('alert')).toHaveText(/Only JPEG/);
    await picker.setInputFiles({ ...photo('too-big.png'), buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    await expect(student.getByRole('alert')).toHaveText(/5 MB/);
    await picker.setInputFiles(['1.png', '2.png', '3.png', '4.png'].map(photo));
    await expect(student.getByRole('alert')).toHaveText(/at most 3/);
    await picker.setInputFiles([photo('keep.png'), photo('remove.png')]);
    const previews = student.getByRole('list', { name: 'Selected photos' });
    await expect(previews.getByRole('img')).toHaveCount(2);
    for (const width of [320, 390, 768, 1280, 1920]) {
      await student.setViewportSize({ width, height: 900 });
      await expect(previews.getByRole('img', { name: 'Preview of keep.png' })).toBeVisible();
      expect(await overflow(student)).toBe(false);
    }
    await student.getByRole('button', { name: 'Remove remove.png' }).click();
    await expect(previews.getByRole('img')).toHaveCount(1);
    let submissions = 0;
    await student.route('**/api/campus-issues', (route) => {
      submissions++;
      return submissions === 1
        ? route.fulfill({ status: 503, json: { message: 'Fixture upload failed. Please retry.' } })
        : route.continue();
    });
    const submit = student.getByRole('button', { name: 'Submit Report' });
    await submit.click();
    await expect(student.getByRole('alert')).toContainText('Fixture upload failed');
    await expect(student.getByLabel('Title', { exact: true })).toHaveValue(title);
    await expect(previews.getByRole('img')).toHaveCount(1);
    await submit.evaluate((button) => { button.click(); button.click(); });
    await expect(student.getByRole('heading', { name: title })).toBeVisible();
    expect(submissions).toBe(2);
    const evidence = student.getByRole('region', { name: 'Evidence' });
    await expect(evidence.getByRole('button')).toHaveCount(1);
    const issuePath = new URL(student.url()).pathname;
    await evidenceButton(student).click();
    const photoDialog = student.getByRole('dialog', { name: 'Evidence photo 1' });
    await expect(photoDialog.getByRole('img')).toBeVisible();
    await photoDialog.getByRole('button', { name: 'Close photo' }).click();
    await expect(photoDialog).toBeHidden();
    let reads = 0;
    await student.route('**/api/campus-issues/*/evidence/*', (route) => {
      reads++;
      return reads === 1 ? route.fulfill({ status: 503, body: 'Fixture media unavailable' }) : route.continue();
    });
    await student.reload();
    await expect(evidence.getByText('Photo 1 could not be loaded.')).toBeVisible();
    await evidence.getByRole('button', { name: 'Retry photo 1' }).click();
    await expect(evidenceButton(student)).toBeVisible();

    const studentHeaders = await headersFor(owner);
    const otherHeaders = await headersFor(other);
    const issue = (await (await request.get(`${backend}/api${issuePath}`, { headers: studentHeaders })).json()).data;
    const photoPath = `${backend}/api${issuePath}/evidence/${issue.evidence[0].id}`;
    expect((await request.get(photoPath, { headers: otherHeaders })).status()).toBe(404);
    expect((await request.get(photoPath)).status()).toBe(401);
    const secondStudent = await otherContext.newPage();
    await login(secondStudent, other);
    await secondStudent.goto(issuePath);
    await expect(secondStudent.getByText('This report is unavailable.')).toBeVisible();
    await secondStudent.goto('/admin/campus-issues');
    await expect(secondStudent).toHaveURL(/dashboard/);

    await login(page, admin);
    await page.goto('/admin/campus-issues');
    const search = page.getByLabel('Search reports');
    const queue = page.getByRole('list', { name: 'Campus issue queue' });
    const editor = page.getByRole('region', { name: 'Report review' });
    async function review(reportTitle) {
      await search.fill(reportTitle);
      await queue.getByRole('listitem').filter({ has: page.getByRole('heading', { name: reportTitle, exact: true }) })
        .getByRole('button', { name: 'View / Review' }).click();
      await expect(editor.getByRole('heading', { name: reportTitle })).toBeVisible();
    }
    await review(title);
    await expect(evidenceButton(page)).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Delete Test Report' })).toHaveCount(0);
    await editor.getByRole('button', { name: 'Start review' }).click();
    await editor.getByLabel('Admin response', { exact: true }).fill('The evidence has been reviewed.');
    await editor.getByRole('button', { name: 'Save response' }).click();
    await expect(editor.getByRole('paragraph').filter({ hasText: /^The evidence has been reviewed\.$/ })).toBeVisible();
    await editor.getByLabel('Review action').selectOption('resolved');
    await editor.getByLabel('Resolution note').fill('The synthetic fixture has been resolved.');
    await editor.getByRole('button', { name: 'Resolve report' }).click();
    await expect(editor.getByText('The synthetic fixture has been resolved.', { exact: true })).toBeVisible();
    await student.reload();
    await expect(student.getByRole('heading', { name: 'Resolution note' })).toBeVisible();
    await expect(evidenceButton(student)).toBeVisible();

    const historicalTitle = 'E4 historical resolved fixture';
    await student.goto('/campus-issues');
    const view = student.getByLabel('Report view');
    await expect(view).toHaveValue('recent');
    await expect(student.getByRole('heading', { name: title })).toBeVisible();
    await expect(student.getByRole('heading', { name: 'E4 recent closed fixture' })).toBeVisible();
    await expect(student.getByRole('heading', { name: historicalTitle })).toHaveCount(0);
    await view.selectOption('history');
    await expect(student.getByRole('heading', { name: historicalTitle })).toBeVisible();
    await expect(student.getByRole('heading', { name: 'E4 historical closed fixture' })).toBeVisible();
    await expect(student.getByRole('heading', { name: title })).toHaveCount(0);
    await student.getByRole('link', { name: `View report: ${historicalTitle}` }).click();
    await expect(evidenceButton(student)).toBeVisible();
    await student.reload();
    await expect(evidenceButton(student)).toBeVisible();
    await editor.getByRole('button', { name: 'Back to queue' }).click();
    await review(historicalTitle);
    await expect(evidenceButton(page)).toBeVisible();

    const markedTitle = 'E4 marked cleanup fixture';
    await editor.getByRole('button', { name: 'Back to queue' }).click();
    await review(markedTitle);
    const adminHeaders = await headersFor(admin);
    const marked = (await (await request.get(`${backend}/api/admin/campus-issues?search=E4%20marked`, { headers: adminHeaders })).json()).data[0];
    const markedEndpoint = `${backend}/api/admin/campus-issues/${marked.id}`;
    const markedDetail = (await (await request.get(markedEndpoint, { headers: adminHeaders })).json()).data;
    const fakeStale = await request.patch(`${markedEndpoint}/status`, {
      headers: { ...adminHeaders, 'If-Match': `"${markedDetail.version}"` }, data: { status: 'under_review' }
    });
    expect(fakeStale.ok()).toBeTruthy();
    const startDelete = editor.getByRole('button', { name: 'Delete Test Report', exact: true });
    await startDelete.click();
    const confirmation = editor.getByRole('form', { name: 'Confirm test report deletion' });
    await expect(confirmation).toContainText(marked.id);
    const typed = confirmation.getByLabel('Type DELETE to confirm');
    const permanentlyDelete = confirmation.getByRole('button', { name: 'Permanently delete' });
    await expect(permanentlyDelete).toBeDisabled();
    for (const width of [320, 390, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(typed).toBeVisible();
      expect(await overflow(page)).toBe(false);
    }
    await typed.fill('DELETE');
    await permanentlyDelete.click();
    await expect(editor.getByRole('alert')).toContainText('Reload Latest');
    const reload = editor.getByRole('button', { name: 'Reload Latest' });
    await reload.click();
    await expect(startDelete).toBeEnabled();
    await page.route('**/api/admin/campus-issues/*/test-report', (route) => route.fulfill({
      status: 503, json: { message: 'Fixture evidence cleanup is incomplete.' }
    }), { times: 1 });
    await startDelete.click();
    await typed.fill('DELETE');
    await permanentlyDelete.click();
    await expect(editor.getByRole('alert')).toContainText('Fixture evidence cleanup is incomplete.');
    await reload.click();
    await startDelete.click();
    await typed.fill('DELETE');
    await permanentlyDelete.click();
    await expect(page.getByText('No campus issues match these filters.')).toBeVisible();
    expect((await request.get(markedEndpoint, { headers: adminHeaders })).status()).toBe(404);
    expect((await request.get(`${markedEndpoint}/evidence/${markedDetail.evidence[0].id}`, { headers: adminHeaders })).status()).toBe(404);
    expect((await request.get(photoPath, { headers: studentHeaders })).status()).toBe(200);
    await student.goto('/campus-issues');
    for (const width of [320, 390, 768, 1280, 1920]) {
      await student.setViewportSize({ width, height: 900 });
      await expect(view).toBeVisible();
      expect(await overflow(student)).toBe(false);
    }
  } finally {
    await Promise.all([studentContext.close(), otherContext.close()]);
  }
});
