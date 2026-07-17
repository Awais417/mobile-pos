/**
 * POS + ERP — FULL Automated Test Script
 * ---------------------------------------
 * Ye script POORE system ke har backend feature ko test karta hai:
 * Auth, Categories, Products, Sales (with payment), Dashboard, Reports, Staff.
 *
 * SAFE: Jo bhi test data banata hai (category, product, sale), test ke aakhir
 * mein KHUD DELETE kar deta hai. Aapka asli data untouched rehta hai.
 *
 * KAISE CHALAYEIN:
 * 1. Neeche CONFIG section mein apna ADMIN email/password bhar dein
 * 2. Backend server chal raha ho (npm run dev, apps/api mein)
 * 3. Terminal mein: node full-test.js
 */

// ============ CONFIG — YAHAN APNI DETAILS BHAREIN ============
const CONFIG = {
  apiUrl: 'http://localhost:4000/api',
  email: 'alii@shop.com',       // <-- apna ADMIN email daalein
  password: 'password123',         // <-- apna password daalein
};
// ================================================================

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;

function logSection(title) {
  console.log(colors.cyan(colors.bold(`\n── ${title} ──`)));
}

function logPass(name, detail = '') {
  passed++;
  console.log(colors.green('✔ PASS  ') + name + (detail ? colors.yellow(`  (${detail})`) : ''));
}

function logFail(name, error) {
  failed++;
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
    // body na ho to ignore
  }

  return { status: res.status, data };
}

async function main() {
  console.log(colors.bold('\n🔥 POS + ERP — FULL Automated Test\n'));
  console.log(`API: ${CONFIG.apiUrl}\n`);

  let token = null;
  let testCategoryId = null;
  let testProductId = null;
  let testSaleId = null;

  // ===================== AUTH =====================
  logSection('1. Authentication');

  try {
    const { status } = await request('GET', '/health');
    status === 200
      ? logPass('Backend health check', `status ${status}`)
      : logFail('Backend health check', `status ${status}`);
  } catch (err) {
    logFail('Backend health check', `Connect nahi ho paya — kya server chal raha hai? (${err.message})`);
    return printSummary();
  }

  try {
    const { status, data } = await request('POST', '/auth/login', {
      email: CONFIG.email,
      password: CONFIG.password,
    });
    if (status === 200 && data?.accessToken) {
      token = data.accessToken;
      logPass('Login', CONFIG.email);
    } else {
      logFail('Login', `status ${status} — ${data?.message ?? 'unknown'}. CONFIG mein email/password check karein.`);
      return printSummary();
    }
  } catch (err) {
    logFail('Login', err.message);
    return printSummary();
  }

  let currentUserRole = null;
  try {
    const { status, data } = await request('GET', '/auth/me', null, token);
    if (status === 200 && data?.role) {
      currentUserRole = data.role;
      logPass('Get current user', `role: ${data.role}`);
    } else {
      logFail('Get current user', `status ${status}`);
    }
  } catch (err) {
    logFail('Get current user', err.message);
  }

  if (currentUserRole !== 'ADMIN') {
    console.log(colors.yellow('\n⚠️  Ye account ADMIN nahi hai. Kuch tests (Staff, Delete Sale) skip/fail ho sakte hain.\n'));
  }

  // ===================== CATEGORIES =====================
  logSection('2. Categories');

  try {
    const { status, data } = await request('GET', '/categories', null, token);
    status === 200 && Array.isArray(data)
      ? logPass('List categories', `${data.length} mile`)
      : logFail('List categories', `status ${status}`);
  } catch (err) {
    logFail('List categories', err.message);
  }

  try {
    const testName = `TEST_CATEGORY_${Date.now()}`;
    const { status, data } = await request('POST', '/categories', { name: testName }, token);
    if (status === 201 && data?.id) {
      testCategoryId = data.id;
      logPass('Create category', testName);
    } else {
      logFail('Create category', `status ${status} — ${data?.message ?? ''}`);
    }
  } catch (err) {
    logFail('Create category', err.message);
  }

  // ===================== PRODUCTS =====================
  logSection('3. Products');

  try {
    const { status, data } = await request('GET', '/products', null, token);
    status === 200 && Array.isArray(data)
      ? logPass('List products', `${data.length} mile`)
      : logFail('List products', `status ${status}`);
  } catch (err) {
    logFail('List products', err.message);
  }

  try {
    const testSku = `TESTSKU${Date.now()}`;
    const { status, data } = await request(
      'POST',
      '/products',
      {
        name: 'SMOKE_TEST_PRODUCT',
        sku: testSku,
        costPrice: 50,
        salePrice: 100,
        stockQty: 10,
        reorderLevel: 2,
        categoryId: testCategoryId || undefined,
      },
      token,
    );
    if (status === 201 && data?.id) {
      testProductId = data.id;
      logPass('Create product', `SKU: ${testSku}`);
    } else {
      logFail('Create product', `status ${status} — ${data?.message ?? ''}`);
    }
  } catch (err) {
    logFail('Create product', err.message);
  }

  if (testProductId) {
    try {
      const { status, data } = await request(
        'PATCH',
        `/products/${testProductId}`,
        { salePrice: 120 },
        token,
      );
      status === 200 && Number(data?.salePrice) === 120
        ? logPass('Update product', 'salePrice → 120')
        : logFail('Update product', `status ${status}`);
    } catch (err) {
      logFail('Update product', err.message);
    }
  } else {
    logFail('Update product', 'Skipped — product create fail hui thi');
  }

  // ===================== SALES (with payment) =====================
  logSection('4. Sales & Payment');

  if (testProductId) {
    try {
      const { status, data } = await request(
        'POST',
        '/sales',
        {
          items: [{ productId: testProductId, quantity: 1 }],
          paymentMethod: 'CASH',
          cashReceived: 120,
        },
        token,
      );
      if (status === 201 && data?.id) {
        testSaleId = data.id;
        logPass('Create sale (Cash payment)', `Bill #${data.dailyInvoiceNumber}, total Rs ${data.totalAmount}`);
      } else {
        logFail('Create sale (Cash payment)', `status ${status} — ${data?.message ?? ''}`);
      }
    } catch (err) {
      logFail('Create sale (Cash payment)', err.message);
    }
  } else {
    logFail('Create sale', 'Skipped — test product nahi bana');
  }

  try {
    const { status, data } = await request('GET', '/sales', null, token);
    if (status === 200 && Array.isArray(data)) {
      const found = testSaleId ? data.some((s) => s.id === testSaleId) : true;
      found
        ? logPass('Sales history list', `${data.length} sale(s), test sale mili`)
        : logFail('Sales history list', 'Test sale list mein nahi mili');
    } else {
      logFail('Sales history list', `status ${status}`);
    }
  } catch (err) {
    logFail('Sales history list', err.message);
  }

  try {
    const { status, data } = await request('GET', '/sales/summary', null, token);
    status === 200 && data?.totalRevenue !== undefined
      ? logPass('Sales summary (reports)', `Total revenue: Rs ${data.totalRevenue}, Profit: Rs ${data.totalProfit}`)
      : logFail('Sales summary (reports)', `status ${status}`);
  } catch (err) {
    logFail('Sales summary (reports)', err.message);
  }

  try {
    const { status, data } = await request('GET', '/sales/dashboard?days=1', null, token);
    status === 200 && data?.kpis
      ? logPass('Dashboard analytics', `Today: Rs ${data.kpis.periodRevenue}, Sales: ${data.kpis.periodSales}`)
      : logFail('Dashboard analytics', `status ${status}`);
  } catch (err) {
    logFail('Dashboard analytics', err.message);
  }

  // Stock check — should have decremented by 1
  if (testProductId) {
    try {
      const { status, data } = await request('GET', '/products', null, token);
      const product = data?.find((p) => p.id === testProductId);
      if (status === 200 && product && product.stockQty === 9) {
        logPass('Stock auto-decrement check', `10 → 9 after sale`);
      } else {
        logFail('Stock auto-decrement check', `Expected 9, got ${product?.stockQty}`);
      }
    } catch (err) {
      logFail('Stock auto-decrement check', err.message);
    }
  }

  // ===================== STAFF (read-only, no cleanup available) =====================
  logSection('5. Staff Management');

  try {
    const { status, data } = await request('GET', '/staff', null, token);
    if (status === 200 && Array.isArray(data)) {
      logPass('List staff', `${data.length} staff member(s)`);
    } else if (status === 403) {
      logPass('List staff', 'Access denied (theek hai agar aap Admin nahi hain)');
    } else {
      logFail('List staff', `status ${status}`);
    }
  } catch (err) {
    logFail('List staff', err.message);
  }
  console.log(colors.yellow('  ℹ️  Naya staff banane ka test yahan skip kiya gaya — koi delete-staff endpoint nahi hai, isliye test account permanent reh jata. Naya staff add UI se manually test karein.'));

  // ===================== CLEANUP =====================
  logSection('6. Cleanup (test data delete)');

  if (testSaleId) {
    try {
      const { status } = await request('DELETE', `/sales/${testSaleId}`, null, token);
      status === 200
        ? logPass('Delete test sale', 'cleaned up')
        : logFail('Delete test sale', `status ${status} (aap Admin nahi ho sakte)`);
    } catch (err) {
      logFail('Delete test sale', err.message);
    }
  }

  if (testProductId) {
    try {
      const { status } = await request('DELETE', `/products/${testProductId}`, null, token);
      status === 200
        ? logPass('Delete test product', 'cleaned up')
        : logFail('Delete test product', `status ${status}`);
    } catch (err) {
      logFail('Delete test product', err.message);
    }
  }

  if (testCategoryId) {
    try {
      const { status } = await request('DELETE', `/categories/${testCategoryId}`, null, token);
      status === 200
        ? logPass('Delete test category', 'cleaned up')
        : logFail('Delete test category', `status ${status}`);
    } catch (err) {
      logFail('Delete test category', err.message);
    }
  }

  printSummary();
}

function printSummary() {
  console.log(colors.bold('\n─────────────────────────────────────'));
  console.log(colors.bold('FULL TEST RESULT:'));
  console.log(colors.green(`  Pass: ${passed}`));
  console.log(colors.red(`  Fail: ${failed}`));
  console.log(colors.bold('─────────────────────────────────────\n'));

  if (failed === 0) {
    console.log(colors.green(colors.bold('🎉 Sab backend features theek kaam kar rahe hain!\n')));
  } else {
    console.log(colors.red(colors.bold('⚠️  Kuch features mein masla hai — upar FAIL wali lines dekhein.\n')));
  }

  console.log(colors.yellow('Note: Ye script sirf BACKEND (API) test karta hai.'));
  console.log(colors.yellow('Frontend UI, scanning, printing, design — MANUAL-TEST-CHECKLIST.md follow karein.\n'));
}

main();
