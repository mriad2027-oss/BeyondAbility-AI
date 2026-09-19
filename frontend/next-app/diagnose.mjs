import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost:3000';

async function diagnose() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });

  // 1. Diagnose Home
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  const homeOverflowElements = await page.evaluate(() => {
    const docWidth = 390;
    const overflowing = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 2) {
        overflowing.push({
          tag: el.tagName,
          id: el.id,
          className: el.className?.toString?.().slice(0, 80),
          width: Math.round(rect.width),
          right: Math.round(rect.right)
        });
      }
    });
    return overflowing.slice(0, 10);
  });
  console.log('Home 390px overflowing elements:', homeOverflowElements);

  // 2. Diagnose Upload
  await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle0' });
  const uploadOverflowElements = await page.evaluate(() => {
    const docWidth = 390;
    const overflowing = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 2) {
        overflowing.push({
          tag: el.tagName,
          id: el.id,
          className: el.className?.toString?.().slice(0, 80),
          width: Math.round(rect.width),
          right: Math.round(rect.right)
        });
      }
    });
    return overflowing.slice(0, 10);
  });
  console.log('Upload 390px overflowing elements:', uploadOverflowElements);

  // 3. Test Ask the Video via backend API
  const askSupported = await page.evaluate(async () => {
    const res = await fetch('http://127.0.0.1:8000/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: 'DEMO_python_loops',
        question: 'What is range(5)?'
      })
    });
    return await res.json();
  });
  console.log('\n--- ASK SUPPORTED ("What is range(5)?") ---');
  console.log('Trust:', askSupported.trust);
  console.log('Answer:', askSupported.answer);
  console.log('Timestamps:', askSupported.timestamps);
  console.log('Evidence Count:', askSupported.evidence?.length);
  console.log('Trust Reason:', askSupported.trust_reason);

  const askUnsupported = await page.evaluate(async () => {
    const res = await fetch('http://127.0.0.1:8000/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: 'DEMO_python_loops',
        question: 'What is the capital of France?'
      })
    });
    return await res.json();
  });
  console.log('\n--- ASK UNSUPPORTED ("What is the capital of France?") ---');
  console.log('Trust:', askUnsupported.trust);
  console.log('Answer:', askUnsupported.answer);
  console.log('Timestamps:', askUnsupported.timestamps);
  console.log('Evidence Count:', askUnsupported.evidence?.length);
  console.log('Trust Reason:', askUnsupported.trust_reason);

  await browser.close();
}

diagnose().catch(console.error);
