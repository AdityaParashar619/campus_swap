import { expect, test } from '@playwright/test';

const backend = 'http://127.0.0.1:5194';
const password = 'Pilot-Test-Password!27';
const owner = 'e4-owner@satiengg.in';
const helper = 'e4-other@satiengg.in';
const admin = 'e4-admin@satiengg.in';
const widths = [320, 390, 768, 1024, 1280, 1920];

async function login(page, email) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

async function token(request, email) {
  const result = await request.post(backend + '/api/auth/login', { data: { email, password } });
  expect(result.status()).toBe(200);
  return { Authorization: `Bearer ${(await result.json()).token}` };
}

test.beforeEach(() => {
  test.skip(process.env.CAMPUS_ISSUE_E4_BROWSER !== '1', 'Requires the guarded disposable fixture API');
});

test('Marketplace ownership and favorites, private request offers, and keyboard Notes preview', async ({ page, request }) => {
  const [ownerHeaders, helperHeaders] = await Promise.all([token(request, owner), token(request, helper)]);
  const listing = await request.post(backend + '/api/listings', {
    headers: ownerHeaders, data: { title: 'Phase 4.9 synthetic calculator', description: 'Disposable listing', price: 25, category: 'Electronics' }
  });
  expect(listing.status()).toBe(201);
  const listingId = (await listing.json()).listing._id;
  expect((await request.patch(backend + '/api/listings/' + listingId, {
    headers: helperHeaders, data: { title: 'Other account update' }
  })).status()).toBe(404);
  expect((await request.put(backend + '/api/listings/' + listingId + '/favorite', { headers: helperHeaders })).ok()).toBeTruthy();
  const saved = await request.get(backend + '/api/listings/saved', { headers: helperHeaders });
  expect(await saved.text()).toContain('Phase 4.9 synthetic calculator');

  const created = await request.post(backend + '/api/requests', {
    headers: ownerHeaders, data: { title: 'Phase 4.9 synthetic help request', category: 'Help' }
  });
  expect(created.status()).toBe(201);
  const requestId = (await created.json()).data._id;
  const offer = 'Synthetic private scheduling details';
  const reply = await request.post(backend + '/api/requests/' + requestId + '/responses', {
    headers: helperHeaders, data: { message: offer }
  });
  expect(reply.status()).toBe(201);
  const publicFeed = await request.get(backend + '/api/requests');
  expect(publicFeed.headers()['cache-control']).toContain('no-store');
  expect(await publicFeed.text()).not.toContain(offer);
  for (const headers of [ownerHeaders, helperHeaders]) {
    const authorizedFeed = await request.get(backend + '/api/requests', { headers });
    expect(await authorizedFeed.text()).toContain(offer);
  }
  const outsider = await request.get(backend + '/api/requests', { headers: await token(request, admin) });
  expect(await outsider.text()).not.toContain(offer);
  expect((await request.patch(backend + '/api/requests/' + requestId + '/status', {
    headers: helperHeaders, data: { status: 'closed' }
  })).status()).toBe(403);

  await login(page, owner);
  await page.goto('/bounties');
  await expect(page.getByText(offer, { exact: true })).toBeVisible();
  const pdf = 'https://fixture.invalid/phase49.pdf';
  await page.route(pdf, (route) => route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' }));
  await page.route('**/api/notes', (route) => route.fulfill({ json: { data: [{
    _id: requestId, title: 'Synthetic PDF note', subject: 'Fixture', branch: 'cs', semester: '7', fileType: 'pdf', fileUrl: pdf
  }] } }));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/notes');
  const preview = page.getByRole('button', { name: 'Preview', exact: true });
  await preview.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Preview: Synthetic PDF note' });
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(dialog.locator('iframe')).toHaveAttribute('sandbox', '');
  await expect(dialog.locator('iframe')).toHaveAttribute('src', pdf);
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((element) => {
    const active = document.activeElement;
    return active === document.body || element.contains(active);
  })).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(preview).toBeFocused();
});

test('representative public, student and admin screens fit six viewport widths', async ({ page, request, browser }) => {
  test.setTimeout(180_000);
  const screen = async (view, route, width) => {
    await view.goto(route);
    await expect(view).toHaveURL(new RegExp(route.replaceAll('/', '\\/') + '$'));
    await expect(view.getByRole('heading').first()).toBeVisible();
    const overflow = await view.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect.soft(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(1);
  };
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/login', '/signup']) await screen(page, route, width);
  }

  const headers = await token(request, helper);
  const created = await request.post(backend + '/api/listings', {
    headers, data: { title: 'Responsive listing fixture', description: 'Sample listing body.', price: 5 }
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).listing._id;
  await login(page, helper);
  const adminContext = await browser.newContext();
  try {
    const management = await adminContext.newPage();
    await login(management, admin);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        '/dashboard', '/listings', '/listings/' + id, '/chat', '/network', '/bounties',
        '/notes', '/my-department', '/notices', '/campus-map', '/campus-issues'
      ]) await screen(page, route, width);
      await management.setViewportSize({ width, height: 900 });
      for (const route of ['/admin', '/admin/campus-locations', '/admin/campus-issues']) await screen(management, route, width);
    }
  } finally {
    await adminContext.close();
  }
});
