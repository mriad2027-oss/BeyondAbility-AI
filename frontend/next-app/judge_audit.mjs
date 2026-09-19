import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost:3000';
const JUDGE_DIR = path.resolve('../../scratch/judge_audit_evidence');

if (!fs.existsSync(JUDGE_DIR)) {
  fs.mkdirSync(JUDGE_DIR, { recursive: true });
}

async function runJudgeAudit() {
  console.log('=== STARTING EDUACCESS AI JUDGE-LEVEL AUDIT ===');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const auditLog = {
    steps: [],
    judgeMetrics: {},
    a11yEvaluations: {},
    designEvaluations: {},
    redIssues: [],
    yellowIssues: []
  };

  // -------------------------------------------------------------
  // STEP 1: HOME PAGE FIRST IMPRESSIONS & COMPILER CORE
  // -------------------------------------------------------------
  console.log('\n[Step 1] Opening Home Page (/) at 1440x900...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(JUDGE_DIR, '01_home_hero_1440.png'), fullPage: false });

  const homeMetrics = await page.evaluate(() => {
    const title = document.title;
    const heroH1 = document.querySelector('h1')?.innerText || '';
    const hasCompilerVisual = !!document.querySelector('.relative.overflow-hidden.rounded-3xl');
    const stageItems = Array.from(document.querySelectorAll('button, a')).map(b => b.innerText.trim()).filter(Boolean);
    const bg = window.getComputedStyle(document.body).backgroundColor;
    return { title, heroH1, hasCompilerVisual, stageCount: stageItems.length, bg };
  });
  console.log('Home First Impression Metrics:', homeMetrics);
  auditLog.steps.push({ step: 1, name: 'Home First Impression', data: homeMetrics });

  // -------------------------------------------------------------
  // STEP 2 & 3: COMPILER & LECTURE LAUNCH
  // -------------------------------------------------------------
  console.log('\n[Step 2 & 3] Navigating to Compiler (/upload) and Demo Lecture (/lectures/DEMO_python_loops)...');
  await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(JUDGE_DIR, '02_compiler_workspace.png'), fullPage: false });

  const uploadMetrics = await page.evaluate(() => {
    const heading = document.querySelector('h1')?.innerText || '';
    const hasDropzone = document.body.innerText.includes('drag') || document.body.innerText.includes('Upload');
    const presets = Array.from(document.querySelectorAll('button')).map(b => b.innerText).filter(t => t.includes('Python') || t.includes('Demo') || t.includes('Arabic'));
    return { heading, hasDropzone, presets };
  });
  console.log('Compiler Metrics:', uploadMetrics);
  auditLog.steps.push({ step: 2, name: 'Compiler Audit', data: uploadMetrics });

  // -------------------------------------------------------------
  // STEP 4, 5, 6, 7, 8: ACCESSIBILITY STUDIO FLAGSHIP EXPERIENCE
  // -------------------------------------------------------------
  console.log('\n[Step 4-8] Navigating to Studio (/lectures/DEMO_python_loops)...');
  await page.goto(`${BASE_URL}/lectures/DEMO_python_loops`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(JUDGE_DIR, '03_studio_overview.png'), fullPage: false });

  // Play video for 8 seconds to activate OCR and Gap reasoning at ~7.7s - 8.44s
  const videoState = await page.evaluate(async () => {
    const video = document.querySelector('video');
    if (!video) return { error: 'No video element' };
    video.muted = true;
    video.currentTime = 7.5; // Seek directly to the keyframe with OCR code and loop explanation
    await video.play();
    await new Promise(r => setTimeout(r, 1500));
    video.pause();
    return {
      currentTime: video.currentTime,
      duration: video.duration,
      paused: video.paused
    };
  });
  console.log('Video seek & playback state at keyframe:', videoState);
  await page.screenshot({ path: path.join(JUDGE_DIR, '04_studio_keyframe_ocr.png'), fullPage: false });

  // Test What Am I Missing Tab
  const tabMissing = await page.evaluate(() => {
    const missingTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Missing'));
    if (missingTab) {
      missingTab.click();
      return { clicked: true, label: missingTab.innerText };
    }
    return { clicked: false };
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(JUDGE_DIR, '05_studio_missing_chain.png'), fullPage: false });
  console.log('Missing Tab Clicked:', tabMissing);

  // Test Timeline Tab
  const tabTimeline = await page.evaluate(() => {
    const timelineTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Timeline'));
    if (timelineTab) {
      timelineTab.click();
      return { clicked: true, label: timelineTab.innerText };
    }
    return { clicked: false };
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(JUDGE_DIR, '06_studio_timeline_matrix.png'), fullPage: false });
  console.log('Timeline Tab Clicked:', tabTimeline);

  // -------------------------------------------------------------
  // STEP 9 & 10: GROUNDED ASK THE VIDEO AUDIT
  // -------------------------------------------------------------
  console.log('\n[Step 9-10] Executing Grounded Ask Verification...');
  const supportedQuery = await page.evaluate(async () => {
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
  console.log('Supported Ask:', {
    trust: supportedQuery.trust,
    timestamps: supportedQuery.timestamps,
    evidenceCount: supportedQuery.evidence?.length,
    answer: supportedQuery.answer
  });

  const unsupportedQuery = await page.evaluate(async () => {
    const res = await fetch('http://127.0.0.1:8000/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: 'DEMO_python_loops',
        question: 'What is the speed of light in vacuum?'
      })
    });
    return await res.json();
  });
  console.log('Unsupported Ask:', {
    trust: unsupportedQuery.trust,
    timestamps: unsupportedQuery.timestamps,
    evidenceCount: unsupportedQuery.evidence?.length,
    answer: unsupportedQuery.answer
  });

  // -------------------------------------------------------------
  // STEP 11, 12, 13: ACCESSIBILITY TWIN, LEARNING & NEXT BEST ACTION
  // -------------------------------------------------------------
  console.log('\n[Step 11-13] Auditing Learning Intelligence (/learning)...');
  await page.goto(`${BASE_URL}/learning`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(JUDGE_DIR, '07_learning_hub.png'), fullPage: false });

  const learningMetrics = await page.evaluate(() => {
    const hasNextAction = document.body.innerText.includes('Next Best Action') || document.body.innerText.includes('Recommendation') || document.body.innerText.includes('Adaptive');
    const hasKnowledgeGraph = document.body.innerText.includes('Knowledge') || document.body.innerText.includes('Concept');
    const hasQuiz = document.body.innerText.includes('Quiz') || document.body.innerText.includes('Question');
    return { hasNextAction, hasKnowledgeGraph, hasQuiz };
  });
  console.log('Learning Intelligence Hub:', learningMetrics);

  // -------------------------------------------------------------
  // STEP 14: SETTINGS & PERSONA PROFILES AUDIT
  // -------------------------------------------------------------
  console.log('\n[Step 14] Auditing Settings & Personas (/settings)...');
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(JUDGE_DIR, '08_settings_personas.png'), fullPage: false });

  const personaAudit = await page.evaluate(() => {
    const modes = Array.from(document.querySelectorAll('button')).map(b => b.innerText).filter(t => 
      t.includes('Blind') || t.includes('Low Vision') || t.includes('Deaf') || t.includes('Cognitive') || t.includes('Standard')
    );
    const hasEgSLDisclaimer = document.body.innerText.includes('Egyptian Sign Language is NOT IMPLEMENTED') || document.body.innerText.includes('NOT IMPLEMENTED');
    return { modes, hasEgSLDisclaimer };
  });
  console.log('Persona Profile Audit:', personaAudit);

  await browser.close();
  console.log('=== JUDGE-LEVEL AUDIT RUN COMPLETED SUCCESSFULLY ===');
}

runJudgeAudit().catch(err => {
  console.error('Judge audit failed:', err);
  process.exit(1);
});
