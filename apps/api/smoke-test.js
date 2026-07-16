/**
 * POS + ERP — Smoke Test Script
 * ------------------------------
 * Ye script backend ke zaroori endpoints check karta hai:
 * health, login, products, categories, sales, dashboard.
 * Koi data create/delete/change NAHI karta — bilkul safe hai.
 *
 * KAISE CHALAYEIN:
 * 1. Neeche CONFIG section mein apna email/password bhar dein
 * 2. Backend server chal raha ho (npm run dev, apps/api mein)
 * 3. Terminal mein: node smoke-test.js
 */

// ============ CONFIG — YAHAN APNI DETAILS BHAREIN ============
const CONFIG = {
  apiUrl: 'http://localhost:4000/api',
  email: 'alii@shop.com',       // <-- apna admin/test email daalein
  password: 'password123',         // <-- apna password daalein
};
// ================================================================

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;
const results = [];

function logPass(name, detail = '') {
  passed++;
  results.push({ name, ok: true });
  console.log(colors.green('✔ PASS  ') + name + (detail ? colors.yellow(`  (${detail})`) : ''));
}

function logFail(name, error) {
  failed++;
  results.push({ name, ok: false, error });
  console.log(colors.red('✘ FAIL  ') + name);
  console.log(colors.red(`        → ${error}`));
}

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${CONFIG.apiUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // response body na ho to ignore
  }

  return { status: res.status, data };
}

async function runSmokeTest() {
  console.log(colors.bold('\n🔥 POS + ERP — Smoke Test shuru ho raha hai...\n'));
  console.log(`API: ${CONFIG.apiUrl}\n`);

  let accessToken = null;

  // 1. Health check
  try {
    const { status, data } = await request('GET', '/health');
    if (status === 200) {
      logPass('Backend health check', `status ${status}`);
    } else {
      logFail('Backend health check', `Unexpected status ${status}`);
    }
  } catch (err) {
    logFail('Backend health check', `Server se connect nahi ho paya — kya "npm run dev" chal raha hai? (${err.message})`);
    printSummaryAndExit();
    return;
  }

  // 2. Login
  try {
    const { status, data } = await request('POST', '/auth/login', {
      email: CONFIG.email,
      password: CONFIG.password,
    });
    if (status === 200 && data?.accessToken) {
      accessToken = data.accessToken;
      logPass('Login', `email: ${CONFIG.email}`);
    } else {
      logFail('Login', `status ${status} — ${data?.message ?? 'Unknown error'}. Email/password CONFIG mein check karein.`);
    }
  } catch (err) {
    logFail('Login', err.message);
  }

  if (!accessToken) {
    console.log(colors.yellow('\nLogin fail hone ki wajah se baaki tests skip ho rahe hain.\n'));
    printSummaryAndExit();
    return;
  }

  // 3. Get current user (/auth/me)
  try {
    const { status, data } = await request('GET', '/auth/me', null, accessToken);
    if (status === 200 && data?.role) {
      logPass('Current user info', `role: ${data.role}`);
    } else {
      logFail('Current user info', `status ${status}`);
    }
  } catch (err) {
    logFail('Current user info', err.message);
  }

  // 4. Get products
  try {
    const { status, data } = await request('GET', '/products', null, accessToken);
    if (status === 200 && Array.isArray(data)) {
      logPass('Products list', `${data.length} product(s) mile`);
    } else {
      logFail('Products list', `status ${status}`);
    }
  } catch (err) {
    logFail('Products list', err.message);
  }

  // 5. Get categories
  try {
    const { status, data } = await request('GET', '/categories', null, accessToken);
    if (status === 200 && Array.isArray(data)) {
      logPass('Categories list', `${data.length} category(ies) mile`);
    } else {
      logFail('Categories list', `status ${status}`);
    }
  } catch (err) {
    logFail('Categories list', err.message);
  }

  // 6. Get sales history
  try {
    const { status, data } = await request('GET', '/sales', null, accessToken);
    if (status === 200 && Array.isArray(data)) {
      logPass('Sales history', `${data.length} sale(s) mile`);
    } else {
      logFail('Sales history', `status ${status}`);
    }
  } catch (err) {
    logFail('Sales history', err.message);
  }

  // 7. Get sales summary
  try {
    const { status, data } = await request('GET', '/sales/summary', null, accessToken);
    if (status === 200 && data?.totalRevenue !== undefined) {
      logPass('Sales summary', `total revenue: Rs ${data.totalRevenue}`);
    } else {
      logFail('Sales summary', `status ${status}`);
    }
  } catch (err) {
    logFail('Sales summary', err.message);
  }

  // 8. Get dashboard data
  try {
    const { status, data } = await request('GET', '/sales/dashboard?days=1', null, accessToken);
    if (status === 200 && data?.kpis) {
      logPass('Dashboard analytics', `today sales: Rs ${data.kpis.periodRevenue}`);
    } else {
      logFail('Dashboard analytics', `status ${status}`);
    }
  } catch (err) {
    logFail('Dashboard analytics', err.message);
  }

  // 9. Get staff list (agar Admin ho)
  try {
    const { status, data } = await request('GET', '/staff', null, accessToken);
    if (status === 200 && Array.isArray(data)) {
      logPass('Staff list', `${data.length} staff member(s) mile`);
    } else if (status === 403) {
      logPass('Staff list', 'access denied (ye theek hai agar aap Admin nahi hain)');
    } else {
      logFail('Staff list', `status ${status}`);
    }
  } catch (err) {
    logFail('Staff list', err.message);
  }

  printSummaryAndExit();
}

function printSummaryAndExit() {
  console.log(colors.bold('\n─────────────────────────────'));
  console.log(colors.bold('Smoke Test Result:'));
  console.log(colors.green(`  Pass: ${passed}`));
  console.log(colors.red(`  Fail: ${failed}`));
  console.log(colors.bold('─────────────────────────────\n'));

  if (failed === 0) {
    console.log(colors.green(colors.bold('🎉 Sab theek hai! System zinda hai.\n')));
  } else {
    console.log(colors.red(colors.bold('⚠️  Kuch masla hai — upar FAIL wali lines dekhein.\n')));
  }
}

runSmokeTest();
