import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost:3000';
const JUDGE_DIR = path.resolve('../../scratch/judge_audit_evidence');

async function runRefinedJudgeAudit() {
  console.log('=== RUNNING REFINED HYDRATED JUDGE AUDIT ===');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Home
  console.log('[1/5] Auditing Home (/)...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.screenshot({ path: path.join(JUDGE_DIR, '01_home_hydrated.png'), fullPage: true });
  const homeData = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.innerText,
    hasCompilerPipeline: !!document.querySelector('.relative.overflow-hidden'),
    hasDemoCard: document.body.innerText.includes('Python Loops') || document.body.innerText.includes('DEMO_python_loops')
  }));
  console.log('Home Hydrated:', homeData);

  // 2. Upload / Compiler
  console.log('[2/5] Auditing Compiler (/upload)...');
  await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.screenshot({ path: path.join(JUDGE_DIR, '02_compiler_hydrated.png'), fullPage: true });
  const uploadData = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText,
    hasDropzone: !!document.querySelector('input[type="file"], [role="presentation"]') || document.body.innerText.includes('Drop'),
    sampleButtons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t.includes('Python') || t.includes('Demo') || t.includes('WhatsApp'))
  }));
  console.log('Compiler Hydrated:', uploadData);

  // 3. Studio Flagship
  console.log('[3/5] Auditing Studio (/lectures/DEMO_python_loops)...');
  await page.goto(`${BASE_URL}/lectures/DEMO_python_loops`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('video', { timeout: 15000 });
  await page.screenshot({ path: path.join(JUDGE_DIR, '03_studio_hydrated.png'), fullPage: false });

  // Interact with video
  const videoStatus = await page.evaluate(async () => {
    const v = document.querySelector('video');
    if (!v) return { error: 'No video' };
    v.muted = true;
    v.currentTime = 8.0;
    await v.play();
    await new Promise(r => setTimeout(r, 1000));
    v.pause();
    return {
      src: v.src || v.querySelector('source')?.src,
      currentTime: v.currentTime,
      duration: v.duration,
      paused: v.paused
    };
  });
  console.log('Studio Video Playback:', videoStatus);

  // Click "Missing" Tab
  const missingClick = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('missing'));
    if (btn) { btn.click(); return { clicked: true, text: btn.innerText }; }
    return { clicked: false };
  });
  console.log('Clicked Missing Tab:', missingClick);
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(JUDGE_DIR, '04_studio_missing_panel.png'), fullPage: false });

  // Click "Timeline" Tab
  const timelineClick = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('timeline'));
    if (btn) { btn.click(); return { clicked: true, text: btn.innerText }; }
    return { clicked: false };
  });
  console.log('Clicked Timeline Tab:', timelineClick);
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(JUDGE_DIR, '05_studio_timeline_panel.png'), fullPage: false });

  // 4. Learning
  console.log('[4/5] Auditing Learning (/learning)...');
  await page.goto(`${BASE_URL}/learning`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.screenshot({ path: path.join(JUDGE_DIR, '06_learning_hydrated.png'), fullPage: true });
  const learningData = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText,
    hasKnowledgeGraph: document.body.innerText.includes('Knowledge Graph') || document.body.innerText.includes('Concepts'),
    hasAdaptiveQuiz: document.body.innerText.includes('Adaptive Quiz') || document.body.innerText.includes('Quiz'),
    hasStudentProgress: document.body.innerText.includes('Student Progress') || document.body.innerText.includes('Progress'),
    hasNextAction: document.body.innerText.includes('Next Best Action') || document.body.innerText.includes('Recommendation')
  }));
  console.log('Learning Hydrated:', learningData);

  // 5. Settings
  console.log('[5/5] Auditing Settings (/settings)...');
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.screenshot({ path: path.join(JUDGE_DIR, '07_settings_hydrated.png'), fullPage: true });
  const settingsData = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
    const text = document.body.innerText;
    return {
      h1: document.querySelector('h1')?.innerText,
      hasBlind: text.includes('Blind'),
      hasLowVision: text.includes('Low Vision'),
      hasDeaf: text.includes('Deaf / Hard of Hearing'),
      hasCognitive: text.includes('Cognitive Support'),
      hasStandard: text.includes('Standard'),
      hasDisclaimer: text.includes('Egyptian Sign Language is NOT IMPLEMENTED')
    };
  });
  console.log('Settings Hydrated:', settingsData);

  await browser.close();
  console.log('=== REFINED JUDGE AUDIT FINISHED ===');
}

runRefinedJudgeAudit().catch(console.error);
