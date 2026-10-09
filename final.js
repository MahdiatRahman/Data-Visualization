function setupThemeToggle(){
  const btn = document.getElementById('theme-toggle');
  const icon = btn.querySelector('.theme-icon');
  const label = btn.querySelector('.theme-label');

  const paint = () => {
    const t = document.documentElement.getAttribute('data-theme');
    icon.textContent = t === 'dark' ? '☾' : '☼';
    label.textContent = t === 'dark' ? 'DARK' : 'LIGHT';
    btn.setAttribute('aria-pressed', t === 'dark');
  };
  paint();

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('wsl-theme', next);
    paint();
  });
}

/* ============================================================
   1. DATA LOADING
   ============================================================ */

function coerceDataset1(row){
  const stress = (row.Stress_Level || '').trim();
  return {
    study: +row.Study_Hours_Per_Day,
    extra: +row.Extracurricular_Hours_Per_Day,
    sleep: +row.Sleep_Hours_Per_Day,
    social: +row.Social_Hours_Per_Day,
    physical: +row.Physical_Activity_Hours_Per_Day,
    gpa: +row.GPA,
    stress: stress,
    stressScore: { low: 1, moderate: 2, high: 3 }[stress.toLowerCase()] ?? null,
    productive: +row.Total_Productive_Hours
  };
}

function coerceDataset2(row){
  const yes = v => /^(yes|1|true)$/i.test((v || '').trim());
  return {
    gender: row.Gender,
    age: +row.Age,
    pressure: +row['Academic Pressure'],
    satisfaction: +row['Study Satisfaction'],
    sleepDuration: row['Sleep Duration'],
    diet: row['Dietary Habits'],
    suicidal: yes(row['Have you ever had suicidal thoughts ?']),
    studyHours: +row['Study Hours'],
    financial: +row['Financial Stress'],
    familyHistory: yes(row['Family History of Mental Illness']),
    depression: yes(row['Depression'])
  };
}

function seededRandom(seed){
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function createTooltip(){
  if (d3.select('.viz-tooltip').empty()){
    d3.select('body').append('div').attr('class', 'viz-tooltip');
  }
  return d3.select('.viz-tooltip');
}
function showTooltip(event, html){
  createTooltip()
    .html(html)
    .style('left', (event.clientX + 14) + 'px')
    .style('top', (event.clientY - 10) + 'px')
    .style('opacity', 1);
}
function moveTooltip(event){
  createTooltip()
    .style('left', (event.clientX + 14) + 'px')
    .style('top', (event.clientY - 10) + 'px');
}
function hideTooltip(){
  createTooltip().style('opacity', 0);
}

function generateFallbackDataset1(n){
  const rnd = seededRandom(42);
  const rows = [];
  const stressLevels = ['Low', 'Moderate', 'High'];
  for (let i = 0; i < n; i++){
    const study = Math.max(0.5, Math.min(12, 3 + rnd() * 7));
    const gpa = Math.max(2.0, Math.min(4.0, 2.2 + study * 0.16 + (rnd() - 0.5) * 0.5));
    const social = Math.max(0, Math.min(6, 1 + rnd() * 4));
    const sleep = Math.max(4, Math.min(10, 6.5 + (rnd() - 0.5) * 3));
    const physical = Math.max(0, Math.min(4, rnd() * 2.5));
    const extra = Math.max(0, Math.min(4, rnd() * 2));
    const productive = study + extra + physical;
    const stressIdx = Math.min(2, Math.floor((study / 12) * 1.6 + rnd() * 1.4));
    rows.push({
      study: +study.toFixed(2), extra: +extra.toFixed(2), sleep: +sleep.toFixed(2),
      social: +social.toFixed(2), physical: +physical.toFixed(2), gpa: +gpa.toFixed(2),
      stress: stressLevels[stressIdx], stressScore: stressIdx + 1,
      productive: +productive.toFixed(2)
    });
  }
  return rows;
}

function generateFallbackDataset2(n){
  const rnd = seededRandom(7);
  const rows = [];
  for (let i = 0; i < n; i++){
    const depression = rnd() < 0.42;
    const studyHours = Math.max(0, Math.min(12, (depression ? 6.5 : 5) + (rnd() - 0.5) * 3));
    const satisfaction = Math.max(1, Math.min(5, (depression ? 2.3 : 3.6) + (rnd() - 0.5) * 1.4));
    const pressure = Math.max(1, Math.min(5, (depression ? 3.6 : 2.6) + (rnd() - 0.5) * 1.4));
    const financial = Math.max(1, Math.min(5, (depression ? 3.4 : 2.5) + (rnd() - 0.5) * 1.6));
    rows.push({
      gender: rnd() < 0.5 ? 'Female' : 'Male',
      age: Math.round(18 + rnd() * 10),
      pressure: +pressure.toFixed(1),
      satisfaction: +satisfaction.toFixed(1),
      sleepDuration: ['Less than 5 hours', '5-6 hours', '7-8 hours', 'More than 8 hours'][Math.floor(rnd() * 4)],
      diet: ['Healthy', 'Moderate', 'Unhealthy'][Math.floor(rnd() * 3)],
      suicidal: rnd() < (depression ? 0.38 : 0.10),
      studyHours: +studyHours.toFixed(1),
      financial: +financial.toFixed(1),
      familyHistory: rnd() < 0.3,
      depression
    });
  }
  return rows;
}

async function loadData(){
  let ds1, ds2;
  try{
    // Loads the two real CSVs. Keep both files next to index.html
    // with these exact filenames.
    [ds1, ds2] = await Promise.all([
      d3.csv('student lifestyle dataset.csv', coerceDataset1),
      d3.csv('depression student dataset.csv', coerceDataset2)
    ]);
    if (!ds1 || !ds1.length || !ds2 || !ds2.length) throw new Error('CSV files came back empty');
  } catch (err){
    ds1 = generateFallbackDataset1(220);
    ds2 = generateFallbackDataset2(220);
  }
  return { ds1, ds2 };
}

/* ============================================================
   2. STATISTICS
   ============================================================ */
const mean = (arr, acc) => d3.mean(arr, acc);

function pearson(data, xAcc, yAcc){
  const pts = data
    .map(d => [xAcc(d), yAcc(d)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pts.length;
  if (n < 2) return 0;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const mx = d3.mean(xs), my = d3.mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++){
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

function groupMean(data, catAcc, valAcc){
  const groups = d3.rollup(
    data.filter(d => catAcc(d) != null && Number.isFinite(valAcc(d))),
    v => d3.mean(v, valAcc),
    catAcc
  );
  return Object.fromEntries(groups);
}

function computeStats(ds1, ds2){
  const s = {};
  s.meanGPA = mean(ds1, d => d.gpa);
  s.meanStudy = mean(ds1, d => d.study);
  s.meanSocial = mean(ds1, d => d.social);
  s.meanSleep = mean(ds1, d => d.sleep);
  s.meanActive = mean(ds1, d => d.physical);
  s.meanExtra = mean(ds1, d => d.extra);
  s.meanProductive = mean(ds1, d => d.productive);
  s.meanStressScore = mean(ds1, d => d.stressScore);
  s.corrStudyGPA = pearson(ds1, d => d.study, d => d.gpa);

  s.depressionRate = mean(ds2, d => (d.depression ? 1 : 0));
  s.studyByDep = groupMean(ds2, d => (d.depression ? 'Yes' : 'No'), d => d.studyHours);
  s.satisfactionByDep = groupMean(ds2, d => (d.depression ? 'Yes' : 'No'), d => d.satisfaction);
  s.pressureByDep = groupMean(ds2, d => (d.depression ? 'Yes' : 'No'), d => d.pressure);
  s.financialByDep = groupMean(ds2, d => (d.depression ? 'Yes' : 'No'), d => d.financial);
  s.suicidalRate = mean(ds2, d => (d.suicidal ? 1 : 0));

  return s;
}

/* ============================================================
   3. THE STUDENT — small floating figure. Only the face changes:
      day-clock filters drive the mood in section 1 (happy / sad /
      very sad), pressure filters drive the mood in section 2
      (very happy / neutral / very sad).
   ============================================================ */
function renderStudent(){
  const svg = d3.select('#student-svg');

  svg.append('ellipse').attr('cx', 210).attr('cy', 428).attr('rx', 70).attr('ry', 10)
    .attr('fill', 'currentColor').attr('opacity', 0.08).attr('class', 'ground-shadow');

  const legs = svg.append('g').attr('id', 'legs');
  legs.append('path').attr('id', 'leg-left').attr('d', 'M198,300 L190,365 L192,410')
    .attr('fill', 'none').attr('stroke', 'currentColor').attr('stroke-width', 13).attr('stroke-linecap', 'round').attr('opacity', 0.85);
  legs.append('path').attr('id', 'leg-right').attr('d', 'M222,300 L230,365 L228,410')
    .attr('fill', 'none').attr('stroke', 'currentColor').attr('stroke-width', 13).attr('stroke-linecap', 'round').attr('opacity', 0.85);

  const posture = svg.append('g').attr('id', 'posture-group');

  const arms = posture.append('g').attr('id', 'arms');
  arms.append('path').attr('id', 'arm-left').attr('d', 'M182,155 Q160,230 168,290')
    .attr('fill', 'none').attr('stroke', 'currentColor').attr('stroke-width', 10).attr('stroke-linecap', 'round').attr('opacity', 0.75);
  arms.append('path').attr('id', 'arm-right').attr('d', 'M238,155 Q260,230 252,290')
    .attr('fill', 'none').attr('stroke', 'currentColor').attr('stroke-width', 10).attr('stroke-linecap', 'round').attr('opacity', 0.75);

  posture.append('path').attr('id', 'torso')
    .attr('d', 'M182,150 L238,150 L246,300 L174,300 Z')
    .attr('fill', 'var(--c-study)').attr('opacity', 0.85);

  const headGroup = posture.append('g').attr('id', 'head-group');
  headGroup.append('path').attr('id', 'hair').attr('d', 'M178,92 a32,30 0 0 1 64,-2 Q214,58 178,74 Z')
    .attr('fill', 'currentColor').attr('opacity', 0.65);
  headGroup.append('circle').attr('id', 'head').attr('cx', 210).attr('cy', 96).attr('r', 30)
    .attr('fill', 'currentColor').attr('opacity', 0.9);

  const face = headGroup.append('g').attr('id', 'face');
  face.append('circle').attr('cx', 199).attr('cy', 96).attr('r', 2.6).attr('fill', 'var(--bg-card)');
  face.append('circle').attr('cx', 221).attr('cy', 96).attr('r', 2.6).attr('fill', 'var(--bg-card)');
  face.append('path').attr('id', 'mouth').attr('d', 'M196,112 Q210,120 224,112')
    .attr('stroke', 'var(--bg-card)').attr('stroke-width', 2.2).attr('stroke-linecap', 'round').attr('fill', 'none');
}

// Face presets, from happiest to saddest.
const FACE = {
  veryhappy: {
    browL: 'M188,86 L200,82', browR: 'M220,82 L232,86',
    mouth: 'M194,108 Q210,124 226,108'
  },
  happy: {
    browL: 'M188,88 L200,85', browR: 'M220,85 L232,88',
    mouth: 'M196,111 Q210,121 224,111'
  },
  neutral: {
    browL: 'M188,87 L200,86', browR: 'M220,86 L232,87',
    mouth: 'M197,114 L223,114'
  },
  sad: {
    browL: 'M188,84 L200,89', browR: 'M220,89 L232,84',
    mouth: 'M196,118 Q210,109 224,118'
  },
  verysad: {
    browL: 'M187,83 L200,90', browR: 'M220,90 L233,83',
    mouth: 'M194,122 Q210,106 226,122'
  }
};

function updateStudentFace(mood){
  const f = FACE[mood] || FACE.neutral;
  const t = d3.transition().duration(500).ease(d3.easeCubicInOut);
  d3.select('#brow-left').transition(t).attr('d', f.browL);
d3.select('#brow-right').transition(t).attr('d', f.browR);
  d3.select('#mouth').transition(t).attr('d', f.mouth);
}

/* Maps a mean stress score (1=low .. 3=high) to a mood.
   Low stress -> happy, moderate -> neutral (no smile), high -> sad. */
function stressScoreToMood(score){
  if (!Number.isFinite(score)) return 'neutral';
  if (score <= 1.5) return 'happy';
  if (score <= 2.5) return 'neutral';
  return 'sad';
}

/* Called whenever the day-clock filters change (Section 1). */
function syncAvatarToClock(filtered, ds1){
  const source = filtered.length ? filtered : ds1;
  const avgScore = mean(source, d => d.stressScore);
  updateStudentFace(stressScoreToMood(avgScore));
}

/* Called whenever the pressure-profile filters change (Section 2). */
function syncAvatarToPressure(filtered, ds2){
  if (pressureFilterState.status === 'yes'){
    updateStudentFace('verysad');
  } else if (pressureFilterState.status === 'no'){
    updateStudentFace('veryhappy');
  } else {
    updateStudentFace('neutral');
  }
}

/* ============================================================
   3b. AVATAR DRAG — lets the person pick the avatar up and drop
   it anywhere in the viewport. Position is remembered across
   reloads via localStorage.
   ============================================================ */
function setupAvatarDrag(){
  const el = document.getElementById('floating-avatar');
  if (!el) return;

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  const placeAt = (left, top) => {
    const rect = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width;
    const maxTop = window.innerHeight - rect.height;
    left = clamp(left, 0, Math.max(0, maxLeft));
    top = clamp(top, 0, Math.max(0, maxTop));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.transform = 'none';
    el.classList.add('is-positioned');
    return { left, top };
  };

  // Restore a previously-saved position, if any.
  try{
    const saved = JSON.parse(localStorage.getItem('wsl-avatar-pos') || 'null');
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)){
      requestAnimationFrame(() => placeAt(saved.left, saved.top));
    }
  } catch(e){ /* ignore corrupt saved position */ }

  let dragging = false, offsetX = 0, offsetY = 0, moved = false;

  el.addEventListener('pointerdown', (event) => {
    dragging = true;
    moved = false;
    const rect = el.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    el.classList.add('is-dragging');
    el.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  el.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    moved = true;
    placeAt(event.clientX - offsetX, event.clientY - offsetY);
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    if (moved){
      const rect = el.getBoundingClientRect();
      localStorage.setItem('wsl-avatar-pos', JSON.stringify({ left: rect.left, top: rect.top }));
    }
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  // Keep the avatar on-screen if the window is resized after it's
  // been dropped somewhere custom.
  window.addEventListener('resize', () => {
    if (!el.classList.contains('is-positioned')) return;
    const rect = el.getBoundingClientRect();
    placeAt(rect.left, rect.top);
  });
}

/* ============================================================
   4. MISC UI
   ============================================================ */
function setupMiscUI(ds1, ds2){
  document.getElementById('reset-view').addEventListener('click', () => {
    const avatar = document.getElementById('floating-avatar');
    if (avatar){
      avatar.classList.remove('is-positioned', 'is-dragging');
      avatar.style.left = '';
      avatar.style.top = '';
      avatar.style.right = '';
      avatar.style.bottom = '';
      avatar.style.transform = '';
      localStorage.removeItem('wsl-avatar-pos');
    }
    clockFilterState = { stress: 'all', sleep: 0, study: 0, social: 0, active: 0, gpa: 1 };
    document.getElementById('clock-sleep-min').value = 0;
    document.getElementById('clock-study-min').value = 0;
    document.getElementById('clock-social-min').value = 0;
    document.getElementById('clock-active-min').value = 0;
    document.getElementById('clock-gpa-min').value = 1;
    document.getElementById('clock-sleep-val').textContent = '0.0h';
    document.getElementById('clock-study-val').textContent = '0.0h';
    document.getElementById('clock-social-val').textContent = '0.0h';
    document.getElementById('clock-active-val').textContent = '0.0h';
    document.getElementById('clock-gpa-val').textContent = '1.0';
    d3.selectAll('#clock-stress-toggle .filter-toggle').classed('is-active', function(){ return this.getAttribute('data-value') === 'all'; });
    refreshClockSection(ds1);

    pressureFilterState = { status: 'all', gender: 'all', age: 18, pressure: 1, satisfaction: 1, financial: 1, family: 'all' };
    document.getElementById('pressure-age-min').value = 18;
    document.getElementById('pressure-pressure-min').value = 1;
    document.getElementById('pressure-satisfaction-min').value = 1;
    document.getElementById('pressure-financial-min').value = 1;
    document.getElementById('pressure-gender').value = 'all';
    document.getElementById('pressure-family').value = 'all';
    document.getElementById('pressure-age-val').textContent = '18';
    document.getElementById('pressure-pressure-val').textContent = '1.0';
    document.getElementById('pressure-satisfaction-val').textContent = '1.0';
    document.getElementById('pressure-financial-val').textContent = '1.0';
    d3.selectAll('#pressure-status-toggle .filter-toggle').classed('is-active', function(){ return this.getAttribute('data-value') === 'all'; });
    refreshPressureSection(ds2);
  });
}

/* ============================================================
   5. BOOT
   ============================================================ */
async function main(){
  setupThemeToggle();
  renderStudent();
  updateStudentFace('neutral');
  setupAvatarDrag();

  const { ds1, ds2 } = await loadData();
  const stats = computeStats(ds1, ds2);

  window.__wsl_stats = stats;
  window.__wsl_ds1 = ds1;
  window.__wsl_ds2 = ds2;

  setupMiscUI(ds1, ds2);

  setupClockFilters(ds1);
  setupPressureFilters(ds2);
}

document.addEventListener('DOMContentLoaded', main);

/* ============================================================
   6. SECTION — 24-HOUR CLOCK (Dataset 1)
   ============================================================ */
const CLOCK_CATS = [
  { key: 'sleep', label: 'Sleep', color: 'var(--c-sleep)' },
  { key: 'study', label: 'Study', color: 'var(--c-study)' },
  { key: 'social', label: 'Social', color: 'var(--c-social)' },
  { key: 'physical', label: 'Activity', color: 'var(--c-active)' },
  { key: 'extra', label: 'Extracurricular', color: 'var(--c-depression)' }
];
const STRESS_COLOR = { Low: 'var(--c-active)', Moderate: 'var(--c-study)', High: 'var(--c-warning)' };

let clockFilterState = { stress: 'all', sleep: 0, study: 0, social: 0, active: 0, gpa: 1 };

function applyClockFilters(ds1){
  return ds1.filter(d =>
    (clockFilterState.stress === 'all' || (d.stress || '').toLowerCase() === clockFilterState.stress) &&
    d.sleep >= clockFilterState.sleep &&
    d.study >= clockFilterState.study &&
    d.social >= clockFilterState.social &&
    d.physical >= clockFilterState.active &&
    d.gpa >= clockFilterState.gpa
  );
}

function setupClockFilters(ds1){
  const idMap = { sleep: 'clock-sleep-min', study: 'clock-study-min', social: 'clock-social-min', active: 'clock-active-min', gpa: 'clock-gpa-min' };
  const valMap = { sleep: 'clock-sleep-val', study: 'clock-study-val', social: 'clock-social-val', active: 'clock-active-val', gpa: 'clock-gpa-val' };

  Object.keys(idMap).forEach(key => {
    const input = document.getElementById(idMap[key]);
    const paint = () => {
      document.getElementById(valMap[key]).textContent = key === 'gpa' ? (+input.value).toFixed(1) : `${(+input.value).toFixed(1)}h`;
    };
    paint();
    input.addEventListener('input', () => {
      clockFilterState[key] = +input.value;
      paint();
      refreshClockSection(ds1);
    });
  });

  d3.selectAll('#clock-stress-toggle .filter-toggle').on('click', function(){
    const val = this.getAttribute('data-value');
    clockFilterState.stress = val;
    d3.selectAll('#clock-stress-toggle .filter-toggle').classed('is-active', function(){ return this.getAttribute('data-value') === val; });
    refreshClockSection(ds1);
  });
  d3.select('#clock-stress-toggle .filter-toggle[data-value="all"]').classed('is-active', true);

  document.getElementById('clock-reset').addEventListener('click', () => {
    clockFilterState = { stress: 'all', sleep: 0, study: 0, social: 0, active: 0, gpa: 1 };
    Object.keys(idMap).forEach(key => { document.getElementById(idMap[key]).value = key === 'gpa' ? 1 : 0; });
    document.getElementById('clock-sleep-val').textContent = '0.0h';
    document.getElementById('clock-study-val').textContent = '0.0h';
    document.getElementById('clock-social-val').textContent = '0.0h';
    document.getElementById('clock-active-val').textContent = '0.0h';
    document.getElementById('clock-gpa-val').textContent = '1.0';
    d3.selectAll('#clock-stress-toggle .filter-toggle').classed('is-active', function(){ return this.getAttribute('data-value') === 'all'; });
    refreshClockSection(ds1);
  });

  refreshClockSection(ds1);
}

function refreshClockSection(ds1){
  const filtered = applyClockFilters(ds1);
  document.getElementById('clock-count').textContent = `${filtered.length} of ${ds1.length} students`;
  renderDayClock(filtered);
  syncAvatarToClock(filtered, ds1);
}

function renderDayClock(data){
  const svg = d3.select('#day-clock-svg');
  svg.html('');
  const cx = 270, cy = 250, innerR = 26, dataR = 100;
  const rimR = dataR + 30;

  // ---- Clock face: rim + hour ticks + hour numbers sit close to
  // the rim. Category names are drawn further out, in their own
  // color, so the two label rings never visually mix. ----
  svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', rimR)
    .attr('fill', 'var(--bg-raised)').attr('fill-opacity', 0.35)
    .attr('stroke', 'currentColor').attr('stroke-opacity', 0.22).attr('stroke-width', 1.5);

  const HOURS = 24;
  for (let h = 0; h < HOURS; h++){
    const a = -Math.PI / 2 + (h / HOURS) * 2 * Math.PI;
    const isMajor = h % 6 === 0;
    const isMid = h % 3 === 0;
    const outer = rimR - 2;
    const inner = outer - (isMajor ? 12 : isMid ? 7 : 4);
    svg.append('line')
      .attr('x1', cx + Math.cos(a) * inner).attr('y1', cy + Math.sin(a) * inner)
      .attr('x2', cx + Math.cos(a) * outer).attr('y2', cy + Math.sin(a) * outer)
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', isMajor ? 0.5 : isMid ? 0.28 : 0.14)
      .attr('stroke-width', isMajor ? 2 : 1);
  }
  // Quarter-day hour numbers, in a tight ring just outside the rim —
  // this ring stays close and stays plain/grey.
  const hourLabelR = rimR + 14; // 144 — tight ring right against the rim
  [0, 6, 12, 18].forEach(h => {
    const a = -Math.PI / 2 + (h / HOURS) * 2 * Math.PI;
    svg.append('text')
      .attr('x', cx + Math.cos(a) * hourLabelR).attr('y', cy + Math.sin(a) * hourLabelR + 3)
      .attr('text-anchor', 'middle').attr('font-size', 12)
      .attr('fill', 'var(--text-faint)').attr('font-weight', 700)
      .text(String(h).padStart(2, '0') + ':00');
  });

  const angleScale = d3.scalePoint().domain(CLOCK_CATS.map(c => c.key)).range([-Math.PI / 2, 1.5 * Math.PI]).padding(0.5);
  const maxHours = { sleep: 10, study: 12, social: 8, physical: 6, extra: 4 };

  // Category names live in a second, wider ring of their own — far
  // enough past the hour numbers that the two never overlap or read
  // as one label set, and colored to match each spoke.
  const catLabelR = rimR + 50; // 180 — a clearly separate outer ring, own color per category
  CLOCK_CATS.forEach(cat => {
    const a = angleScale(cat.key);
    const lx = cx + Math.cos(a) * catLabelR;
    const ly = cy + Math.sin(a) * catLabelR;
    const cos = Math.cos(a);
    const anchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle';
    const avg = data.length ? d3.mean(data, d => d[cat.key]) : null;
    const g = svg.append('g').attr('class', 'clock-outer-label').style('cursor', data.length ? 'pointer' : 'default');
    g.append('text')
      .attr('x', lx).attr('y', ly - 4)
      .attr('text-anchor', anchor)
      .attr('font-size', 14.5).attr('font-weight', 700)
      .attr('fill', cat.color)
      .text(cat.label);
    g.append('text')
      .attr('x', lx).attr('y', ly + 13)
      .attr('text-anchor', anchor)
      .attr('font-size', 12)
      .attr('fill', 'var(--text-faint)')
      .text(avg == null ? '—' : `${avg.toFixed(1)}h avg`);
    if (data.length){
      g.on('mouseover', (event) => {
        showTooltip(event, `<div class="tt-row"><span>${cat.label} avg</span><b>${avg.toFixed(1)}h/day</b></div>`);
      }).on('mousemove', moveTooltip).on('mouseout', hideTooltip);
    }
  });

  if (!data.length){
    svg.append('text').attr('x', cx).attr('y', cy).attr('text-anchor', 'middle')
      .attr('fill', 'currentColor').attr('opacity', 0.5).attr('font-size', 13).text('No students match these filters');
    return;
  }

  // Faint spokes only — no text on the face itself.
  CLOCK_CATS.forEach(cat => {
    const a = angleScale(cat.key);
    svg.append('line').attr('x1', cx).attr('y1', cy)
      .attr('x2', cx + Math.cos(a) * dataR).attr('y2', cy + Math.sin(a) * dataR)
      .attr('stroke', 'currentColor').attr('stroke-opacity', 0.08).attr('stroke-width', 1);
  });

  CLOCK_CATS.forEach(cat => {
    const avg = d3.mean(data, d => d[cat.key]);
    const a = angleScale(cat.key);
    const r = innerR + Math.min(1, avg / maxHours[cat.key]) * (dataR - innerR);
    svg.append('circle').attr('cx', cx + Math.cos(a) * r).attr('cy', cy + Math.sin(a) * r).attr('r', 6.5)
      .attr('fill', cat.color).attr('stroke', 'var(--bg-card)').attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', (event) => {
        showTooltip(event, `
          <div class="tt-row"><span>${cat.label} avg</span><b>${avg.toFixed(1)}h/day</b></div>
        `);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', hideTooltip);
  });

  const rnd = seededRandom(11);
  data.forEach(d => {
    CLOCK_CATS.forEach(cat => {
      const a = angleScale(cat.key) + (rnd() - 0.5) * 0.3;
      const r = innerR + Math.min(1, d[cat.key] / maxHours[cat.key]) * (dataR - innerR);
      svg.append('circle')
        .attr('cx', cx + Math.cos(a) * r).attr('cy', cy + Math.sin(a) * r).attr('r', 3)
        .attr('fill', STRESS_COLOR[d.stress] || 'currentColor').attr('opacity', 0.5)
        .style('cursor', 'pointer')
        .on('mouseover', (event) => {
          showTooltip(event, `
            <div class="tt-row"><span>${cat.label}</span><b>${d[cat.key].toFixed(1)}h</b></div>
            <div class="tt-row"><span>GPA</span><b>${d.gpa.toFixed(2)}</b></div>
            <div class="tt-row"><span>Stress</span><b>${d.stress}</b></div>
          `);
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', hideTooltip);
    });
  });

  // ---- Clock hands: two subtle hands pointing toward the two
  // most dominant activities in the current filter. ----
  const sorted = CLOCK_CATS.map(cat => ({ cat, avg: d3.mean(data, d => d[cat.key]) / maxHours[cat.key] }))
    .sort((a, b) => b.avg - a.avg);
  if (sorted[0]){
    const a = angleScale(sorted[0].cat.key);
    svg.append('line').attr('x1', cx).attr('y1', cy)
      .attr('x2', cx + Math.cos(a) * (dataR - 14)).attr('y2', cy + Math.sin(a) * (dataR - 14))
      .attr('stroke', sorted[0].cat.color).attr('stroke-width', 2.4).attr('stroke-linecap', 'round').attr('opacity', 0.6);
  }
  if (sorted[1]){
    const a = angleScale(sorted[1].cat.key);
    svg.append('line').attr('x1', cx).attr('y1', cy)
      .attr('x2', cx + Math.cos(a) * (dataR - 34)).attr('y2', cy + Math.sin(a) * (dataR - 34))
      .attr('stroke', sorted[1].cat.color).attr('stroke-width', 1.8).attr('stroke-linecap', 'round').attr('opacity', 0.45);
  }

  svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', innerR)
    .attr('fill', 'var(--bg-raised)').attr('stroke', 'currentColor').attr('opacity', 0.9).attr('stroke-opacity', 0.12);
  svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 3).attr('fill', 'var(--text-faint)');
}

/* ============================================================
   7. SECTION — PRESSURE PROFILE (RADAR / SPIDER) (Dataset 2)
   ============================================================ */
const SLEEP_HOURS_MAP = { 'Less than 5 hours': 4, '5-6 hours': 5.5, '7-8 hours': 7.5, 'More than 8 hours': 9 };
const DEP_COLOR = { Yes: 'var(--c-warning)', No: 'var(--c-active)' };

let pressureFilterState = { status: 'all', gender: 'all', age: 18, pressure: 1, satisfaction: 1, financial: 1, family: 'all' };

function applyPressureFilters(ds2){
  return ds2.filter(d =>
    (pressureFilterState.status === 'all' || (pressureFilterState.status === 'yes') === d.depression) &&
    (pressureFilterState.gender === 'all' || d.gender === pressureFilterState.gender) &&
    d.age >= pressureFilterState.age &&
    d.pressure >= pressureFilterState.pressure &&
    d.satisfaction >= pressureFilterState.satisfaction &&
    d.financial >= pressureFilterState.financial &&
    (pressureFilterState.family === 'all' || (pressureFilterState.family === 'yes') === d.familyHistory)
  );
}

function setupPressureFilters(ds2){
  const rangeMap = { age: 'pressure-age-min', pressure: 'pressure-pressure-min', satisfaction: 'pressure-satisfaction-min', financial: 'pressure-financial-min' };
  const valMap = { age: 'pressure-age-val', pressure: 'pressure-pressure-val', satisfaction: 'pressure-satisfaction-val', financial: 'pressure-financial-val' };

  Object.keys(rangeMap).forEach(key => {
    const input = document.getElementById(rangeMap[key]);
    const paint = () => { document.getElementById(valMap[key]).textContent = (+input.value).toFixed(key === 'age' ? 0 : 1); };
    paint();
    input.addEventListener('input', () => {
      pressureFilterState[key] = +input.value;
      paint();
      refreshPressureSection(ds2);
    });
  });

  d3.selectAll('#pressure-status-toggle .filter-toggle').on('click', function(){
    const val = this.getAttribute('data-value');
    pressureFilterState.status = val;
    d3.selectAll('#pressure-status-toggle .filter-toggle').classed('is-active', function(){ return this.getAttribute('data-value') === val; });
    refreshPressureSection(ds2);
  });
  d3.select('#pressure-status-toggle .filter-toggle[data-value="all"]').classed('is-active', true);

  document.getElementById('pressure-gender').addEventListener('change', function(){
    pressureFilterState.gender = this.value;
    refreshPressureSection(ds2);
  });
  document.getElementById('pressure-family').addEventListener('change', function(){
    pressureFilterState.family = this.value;
    refreshPressureSection(ds2);
  });

  document.getElementById('pressure-reset').addEventListener('click', () => {
    pressureFilterState = { status: 'all', gender: 'all', age: 18, pressure: 1, satisfaction: 1, financial: 1, family: 'all' };
    document.getElementById('pressure-age-min').value = 18;
    document.getElementById('pressure-pressure-min').value = 1;
    document.getElementById('pressure-satisfaction-min').value = 1;
    document.getElementById('pressure-financial-min').value = 1;
    document.getElementById('pressure-gender').value = 'all';
    document.getElementById('pressure-family').value = 'all';
    document.getElementById('pressure-age-val').textContent = '18';
    document.getElementById('pressure-pressure-val').textContent = '1.0';
    document.getElementById('pressure-satisfaction-val').textContent = '1.0';
    document.getElementById('pressure-financial-val').textContent = '1.0';
    d3.selectAll('#pressure-status-toggle .filter-toggle').classed('is-active', function(){ return this.getAttribute('data-value') === 'all'; });
    refreshPressureSection(ds2);
  });

  refreshPressureSection(ds2);
}

function refreshPressureSection(ds2){
  const filtered = applyPressureFilters(ds2);
  document.getElementById('pressure-count').textContent = `${filtered.length} of ${ds2.length} students`;
  renderPressureRadar(filtered);
  syncAvatarToPressure(filtered, ds2);
}

const RADAR_AXES = [
  { key: 'pressure', label: 'Academic pressure', max: 5, get: d => d.pressure },
  { key: 'studyHours', label: 'Study hours', max: 12, get: d => d.studyHours },
  { key: 'financial', label: 'Financial stress', max: 5, get: d => d.financial },
  { key: 'satisfaction', label: 'Study satisfaction', max: 5, get: d => d.satisfaction },
  { key: 'sleep', label: 'Sleep duration', max: 10, get: d => SLEEP_HOURS_MAP[d.sleepDuration] ?? null }
];

function renderPressureRadar(data){
  const svg = d3.select('#pressure-radar-svg');
  svg.html('');
  const cx = 190, cy = 185, maxR = 130;
  const table = d3.select('#radar-table');
  table.html('');

  const groups = { Yes: data.filter(d => d.depression), No: data.filter(d => !d.depression) };
  const angle = i => -Math.PI / 2 + i * (2 * Math.PI / RADAR_AXES.length);

  // grid rings, like the day-clock's radial guide
  [0.33, 0.66, 1].forEach(t => {
    const pts = RADAR_AXES.map((ax, i) => { const a = angle(i); return `${cx + Math.cos(a) * maxR * t},${cy + Math.sin(a) * maxR * t}`; }).join(' ');
    svg.append('polygon').attr('points', pts).attr('fill', 'none').attr('stroke', 'currentColor').attr('opacity', 0.08);
  });

  RADAR_AXES.forEach((ax, i) => {
    const a = angle(i);
    svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', cx + Math.cos(a) * maxR).attr('y2', cy + Math.sin(a) * maxR)
      .attr('stroke', 'currentColor').attr('opacity', 0.14);
    const lx = cx + Math.cos(a) * (maxR + 14), ly = cy + Math.sin(a) * (maxR + 14);
    svg.append('text').attr('x', lx).attr('y', ly).attr('text-anchor', 'middle')
      .attr('font-size', 9).attr('fill', 'var(--text-faint)').text(ax.label);
  });

  const rows = [['', 'Depressed', 'Not depressed']];
  ['No', 'Yes'].forEach(key => {
    const group = groups[key];
    if (!group || !group.length) return;
    const pts = RADAR_AXES.map((ax, i) => {
      const avg = d3.mean(group, ax.get);
      const r = Math.min(1, (avg || 0) / ax.max) * maxR;
      const a = angle(i);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
    const poly = svg.append('polygon')
      .attr('points', pts.map(p => p.join(',')).join(' '))
      .attr('fill', DEP_COLOR[key]).attr('fill-opacity', 0)
      .attr('stroke', DEP_COLOR[key]).attr('stroke-width', 1.8)
      .attr('stroke-opacity', 0);
    poly.transition().duration(500).attr('fill-opacity', 0.16).attr('stroke-opacity', 1);

    pts.forEach((p, i) => {
      const ax = RADAR_AXES[i];
      const avg = d3.mean(group, ax.get);
      svg.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', 4).attr('fill', DEP_COLOR[key])
        .style('cursor', 'pointer')
        .on('mouseover', (event) => {
          showTooltip(event, `
            <div class="tt-row"><span>${ax.label}</span><b>${avg.toFixed(1)}</b></div>
            <div class="tt-row"><span>Group</span><b>${key === 'Yes' ? 'Depressed' : 'Not depressed'}</b></div>
          `);
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', hideTooltip);
    });
  });

  RADAR_AXES.forEach(ax => {
    const yVal = groups.Yes.length ? d3.mean(groups.Yes, ax.get) : null;
    const nVal = groups.No.length ? d3.mean(groups.No, ax.get) : null;
    rows.push([ax.label, yVal == null ? '—' : yVal.toFixed(1), nVal == null ? '—' : nVal.toFixed(1)]);
  });
  const tbl = table.append('table');
  rows.forEach((row, ri) => {
    const tr = tbl.append('tr');
    row.forEach((cell, ci) => tr.append('td').attr('class', ci === 0 ? 'rt-label' : '').text(cell).style('font-weight', ri === 0 ? 700 : 400));
  });
}
// DOM Elements
const chartLoader = document.getElementById('chart-loader');
const chartWrapper = document.getElementById('chart-wrapper');
const tooltip = document.getElementById('tooltip');
const tooltipInner = document.getElementById('tooltip-inner');

// State
let rawData = [];
let filteredData = [];
let mentalData = [];
let sankeyChart = null;
let currentAlign = 'sankeyJustify';
let currentLinkColor = 'source'; // source, target, source-target, none

// Filters
let filters = {
  academic: 'All',
  gender: 'All',
  support: 'All',
  job: 'All',
  usage: 'All',
  sleep: 'All'
};

// Colors mapping for distinct categories (approximate to user prompt)
const colorMap = {
  // Usage Level (Cyan shades)
  'Low (0-2h)_s0': '#0ea5e9',
  'Medium (2-5h)_s0': '#0284c7',
  'High (5h+)_s0': '#0369a1',

  // Platforms (Purple shades)
  'Instagram_s1': '#c084fc',
  'Facebook_s1': '#a855f7',
  'TikTok_s1': '#9333ea',
  'YouTube_s1': '#7e22ce',
  'LinkedIn_s1': '#6b21a8',
  'Snapchat_s1': '#d8b4fe',
  'Twitter_s1': '#f3e8ff',
  'WhatsApp_s1': '#581c87',
  
  // Impact (Emerald/Rose/Neutral)
  'Positive_s2': '#34d399',
  'Neutral_s2': '#94a3b8',
  'Negative_s2': '#fb7185',

  // Academic (Amber/Muted)
  'Yes_s3': '#fbbf24',
  'No_s3': '#64748b'
};

const defaultColor = '#3b82f6';

function getNodeColor(nodeName) {
  return colorMap[nodeName] || defaultColor;
}

// Initialization
async function init() {
  try {
    rawData = d3.csvParse(rawCSVData.trim());
    // Basic data cleanup if needed
    rawData.forEach(d => {
      // Ensure specific columns exist. Fallbacks if header matches are slightly different
      d.usage = d.SM_Usage_Level || 'Unknown';
      d.platform = d.Most_Used_Platform || 'Unknown';
      d.impact = d.Overall_Impact || 'Unknown';
      d.academic = d.Affects_Academic_Performance || 'Unknown';
    });
    
    if (typeof mentalHealthData !== 'undefined') {
      mentalData = d3.csvParse(mentalHealthData.trim());
      mentalData.forEach(d => {
        d.GPA = +d.GPA || 0;
        d.Sleep_Hours = +d.Sleep_Hours || 0;
        d.Daily_Study_Hours = +d.Daily_Study_Hours || 0;
        d.Wellbeing_Score = +d.Wellbeing_Score || 0;
        d.Stress_Score = +d.Stress_Score || 0;
        d.Anxiety_Score = +d.Anxiety_Score || 0;
        d.Depression_Score = +d.Depression_Score || 0;
        d.Daily_SM_Hours = +d.Daily_SM_Hours || 0;
      });
    }
    
    chartLoader.style.opacity = '0';
    setTimeout(() => { chartLoader.style.display = 'none'; }, 300);

    setupEventListeners();
    updateData();
  } catch (error) {
    console.error("Error loading CSV: ", error);
    chartLoader.innerHTML = `<span>Error loading data. Check console.</span>`;
  }
}

function setupEventListeners() {
  // Filters
  document.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filterType = e.target.dataset.filter;
      const val = e.target.dataset.value;
      
      // Update active class
      document.querySelectorAll(`#filter-${filterType} .pill`).forEach(p => p.classList.remove('pill--active'));
      e.target.classList.add('pill--active');
      
      // Update state
      filters[filterType] = val;
      updateData();
    });
  });

  // Alignment Controls
  document.querySelectorAll('#align-control .seg-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#align-control .seg-btn').forEach(b => b.classList.remove('seg-btn--active'));
      e.target.classList.add('seg-btn--active');
      currentAlign = e.target.dataset.align;
      renderChart();
    });
  });

  // Link Color Controls
  document.querySelectorAll('#link-color-control .seg-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#link-color-control .seg-btn').forEach(b => b.classList.remove('seg-btn--active'));
      e.target.classList.add('seg-btn--active');
      currentLinkColor = e.target.dataset.linkcolor;
      renderChart();
    });
  });
  
  // Mouse movement for tooltip tracking
  document.addEventListener('mousemove', (e) => {
    if (tooltip.classList.contains('show')) {
      // Position tooltip near cursor
      const offset = 15;
      let x = e.clientX + offset;
      let y = e.clientY + offset;
      
      // Keep inside bounds
      const rect = tooltip.getBoundingClientRect();
      if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - offset;
      if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - offset;
      
      tooltip.style.transform = `translate(${x}px, ${y}px)`;
    }
  });
}

function updateData() {
  // Filter the raw data
  filteredData = rawData.filter(d => {
    let matchAcad = filters.academic === 'All' || d.Academic_Level === filters.academic;
    let matchGen = filters.gender === 'All' || d.Gender === filters.gender;
    return matchAcad && matchGen;
  });

  updateStats();
  renderChart();
  if (typeof renderMentalCharts === 'function') {
    renderMentalCharts();
  }
}

function updateStats() {
  const total = rawData.length;
  const current = filteredData.length;
  
  document.getElementById('total-count').innerText = d3.format(",")(total);
  
  // Count animation (simple)
  const countEl = document.getElementById('student-count');
  d3.select(countEl)
    .transition()
    .duration(500)
    .tween("text", function() {
      let startVal = parseInt(this.textContent.replace(/,/g, ''));
      if (isNaN(startVal)) startVal = 0;
      const i = d3.interpolateRound(startVal, current);
      return function(t) {
        this.textContent = d3.format(",")(i(t));
      };
    });

  const pct = total > 0 ? ((current / total) * 100).toFixed(1) : 0;
  document.getElementById('student-pct').innerText = `${pct}% of total dataset`;
  document.getElementById('stat-bar-fill').style.width = `${pct}%`;

  // Mini stats
  let highUsageCount = 0;
  let negImpactCount = 0;
  let posImpactCount = 0;
  let affectsAcadCount = 0;

  filteredData.forEach(d => {
    if (d.usage.includes('High')) highUsageCount++;
    if (d.impact === 'Negative') negImpactCount++;
    if (d.impact === 'Positive') posImpactCount++;
    if (d.academic === 'Yes') affectsAcadCount++;
  });

  document.getElementById('ms-high-usage').innerText = d3.format(",")(highUsageCount);
  document.getElementById('ms-negative').innerText = d3.format(",")(negImpactCount);
  document.getElementById('ms-positive').innerText = d3.format(",")(posImpactCount);
  document.getElementById('ms-affects').innerText = d3.format(",")(affectsAcadCount);
}

function processSankeyData() {
  // Build graph arrays
  let nodesMap = new Map();
  let linksMap = new Map();

  function addNode(name, stage) {
    const id = `${name}_s${stage}`;
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { name: id, label: name, stage: stage });
    }
    return id;
  }

  function addLink(sourceId, targetId) {
    const linkId = `${sourceId}->${targetId}`;
    if (!linksMap.has(linkId)) {
      linksMap.set(linkId, { source: sourceId, target: targetId, value: 0 });
    }
    linksMap.get(linkId).value += 1;
  }

  filteredData.forEach(d => {
    const s0 = addNode(d.usage, 0);
    const s1 = addNode(d.platform, 1);
    const s2 = addNode(d.impact, 2);
    const s3 = addNode(d.academic, 3);

    addLink(s0, s1);
    addLink(s1, s2);
    addLink(s2, s3);
  });

  return {
    nodes: Array.from(nodesMap.values()),
    links: Array.from(linksMap.values())
  };
}

function renderChart() {
  chartWrapper.innerHTML = ''; // clear previous
  
  if (filteredData.length === 0) {
    chartWrapper.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color: var(--text-muted)">No data matches current filters</div>';
    return;
  }

  const data = processSankeyData();
  
  const rect = chartWrapper.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const format = d3.format(",.0f");

  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "auto")
      .style("font", "12px var(--font-sans)");

  const alignMap = {
    'sankeyJustify': d3.sankeyJustify,
    'sankeyLeft': d3.sankeyLeft,
    'sankeyRight': d3.sankeyRight,
    'sankeyCenter': d3.sankeyCenter
  };

  const sankey = d3.sankey()
      .nodeId(d => d.name)
      .nodeAlign(alignMap[currentAlign])
      .nodeWidth(20)
      .nodePadding(15)
      .extent([[10, 20], [width - 10, height - 20]]);

  let graph = sankey({
    nodes: data.nodes.map(d => Object.assign({}, d)),
    links: data.links.map(d => Object.assign({}, d))
  });

  // Check if graph nodes are empty
  if (!graph.nodes.length) return;

  const totalFlow = d3.sum(graph.nodes.filter(n => n.layer === 0), d => d.value);

  // Definitions for gradients
  const defs = svg.append("defs");
  
  if (currentLinkColor === "source-target") {
    const gradients = defs.selectAll("linearGradient")
      .data(graph.links)
      .join("linearGradient")
        .attr("id", d => {
          d.gradientId = `grad-${d.source.name.replace(/\W/g,'')}-${d.target.name.replace(/\W/g,'')}`;
          return d.gradientId;
        })
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", d => d.source.x1)
        .attr("x2", d => d.target.x0);

    gradients.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d => getNodeColor(d.source.name));

    gradients.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d => getNodeColor(d.target.name));
  }

  // Draw links
  const linkGroup = svg.append("g")
      .attr("fill", "none");
      
  const link = linkGroup.selectAll("path")
    .data(graph.links)
    .join("path")
      .attr("class", "link-path")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke", d => {
        if (currentLinkColor === "source-target") return `url(#${d.gradientId})`;
        if (currentLinkColor === "source") return getNodeColor(d.source.name);
        if (currentLinkColor === "target") return getNodeColor(d.target.name);
        return "rgba(255,255,255,0.2)";
      })
      .attr("stroke-opacity", 0.25)
      .attr("stroke-width", d => Math.max(1, d.width));
      
  // Draw nodes
  const nodeGroup = svg.append("g");
  
  const node = nodeGroup.selectAll("g")
    .data(graph.nodes)
    .join("g")
      .attr("class", "node-rect-group");

  node.append("rect")
      .attr("class", "node-rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("height", d => Math.max(1, d.y1 - d.y0))
      .attr("width", d => d.x1 - d.x0)
      .attr("fill", d => getNodeColor(d.name))
      .attr("rx", 3);

  // Node labels
  node.append("text")
      .attr("class", "node-label")
      .attr("x", d => d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8)
      .attr("y", d => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
      .text(d => d.label);

  // Interactions
  function highlightNode(d) {
    chartWrapper.classList.add('dimming');
    // Highlight connected paths
    let connectedNodes = new Set([d.name]);
    let connectedLinks = new Set();
    
    // Traverse forward
    let toVisit = [d];
    while(toVisit.length > 0) {
      let curr = toVisit.pop();
      curr.sourceLinks.forEach(l => {
        connectedLinks.add(l);
        connectedNodes.add(l.target.name);
        toVisit.push(l.target);
      });
    }
    // Traverse backward
    toVisit = [d];
    while(toVisit.length > 0) {
      let curr = toVisit.pop();
      curr.targetLinks.forEach(l => {
        connectedLinks.add(l);
        connectedNodes.add(l.source.name);
        toVisit.push(l.source);
      });
    }

    node.selectAll(".node-rect").classed("highlight", n => connectedNodes.has(n.name));
    link.classed("highlight", l => connectedLinks.has(l));
  }

  function unhighlightNode() {
    chartWrapper.classList.remove('dimming');
    node.selectAll(".node-rect").classed("highlight", false);
    link.classed("highlight", false);
  }

  node.on("mouseenter", function(e, d) {
    highlightNode(d);
    
    // Tooltip
    tooltip.classList.add("show");
    const pct = ((d.value / totalFlow) * 100).toFixed(1);
    
    tooltipInner.innerHTML = `
      <div class="tooltip-header">${d.label}</div>
      <div class="tooltip-row">
        <span class="tooltip-label">Students:</span>
        <span class="tooltip-value">${format(d.value)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Share:</span>
        <span class="tooltip-value">${pct}%</span>
      </div>
    `;
  });

  node.on("mouseleave", function() {
    unhighlightNode();
    tooltip.classList.remove("show");
  });

  link.on("mouseenter", function(e, d) {
    // Also dim rest for links
    chartWrapper.classList.add('dimming');
    d3.select(this).classed("highlight", true);
    
    // Highlight connected nodes
    node.selectAll(".node-rect").classed("highlight", n => n.name === d.source.name || n.name === d.target.name);
    
    tooltip.classList.add("show");
    const nodeValue = d.source.value;
    const linkPct = ((d.value / nodeValue) * 100).toFixed(1);
    const totalPct = ((d.value / totalFlow) * 100).toFixed(1);
    
    tooltipInner.innerHTML = `
      <div class="tooltip-header">${d.source.label} → ${d.target.label}</div>
      <div class="tooltip-row">
        <span class="tooltip-label">Flow:</span>
        <span class="tooltip-value">${format(d.value)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Of Source:</span>
        <span class="tooltip-value">${linkPct}%</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Of Total:</span>
        <span class="tooltip-value">${totalPct}%</span>
      </div>
    `;
  });

  link.on("mouseleave", function() {
    unhighlightNode();
    tooltip.classList.remove("show");
  });

  // Insert SVG
  chartWrapper.appendChild(svg.node());
  
  // Enter transition (opacity)
  svg.style("opacity", 0)
     .transition()
     .duration(500)
     .style("opacity", 1);
}

// Window resize handler (debounce)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (filteredData.length > 0) renderChart();
    if (typeof renderMentalCharts === 'function') renderMentalCharts();
  }, 200);
});

// Mental Health Charts
function renderMentalCharts() {
  const filteredMental = mentalData.filter(d => {
    const matchGen = filters.gender === 'All' || d.Gender === filters.gender;
    const matchAcad = filters.academic === 'All' || filters.academic === 'Undergraduate'; // All mentalData are Year 1-4 (Undergrad)
    const matchSup = filters.support === 'All' || d.Sought_Mental_Health_Support === filters.support;
    const matchJob = filters.job === 'All' || d.Part_Time_Job === filters.job;
    
    let matchUsage = true;
    if (filters.usage === 'High') matchUsage = d.Daily_SM_Hours >= 5;
    else if (filters.usage === 'Medium') matchUsage = d.Daily_SM_Hours >= 2 && d.Daily_SM_Hours < 5;
    else if (filters.usage === 'Low') matchUsage = d.Daily_SM_Hours < 2;

    let matchSleep = true;
    if (filters.sleep === 'Good') matchSleep = d.Sleep_Hours >= 7;
    else if (filters.sleep === 'Poor') matchSleep = d.Sleep_Hours < 7;

    return matchGen && matchAcad && matchSup && matchJob && matchUsage && matchSleep;
  });

  renderRadarChart(filteredMental);
  renderBarChart(filteredMental);
}

function renderBarChart(data) {
  const container = document.getElementById('bar-chart-wrapper');
  if (!container) return;
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color: var(--text-muted)">No data for this filter segment</div>';
    return;
  }

  const rect = container.getBoundingClientRect();
  const margin = {top: 20, right: 120, bottom: 80, left: 40};
  const width = rect.width - margin.left - margin.right;
  const height = rect.height - margin.top - margin.bottom;

  const svgRoot = d3.create("svg")
    .attr("width", rect.width)
    .attr("height", rect.height);

  const svg = svgRoot.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const dimensions = ['Sleep_Hours', 'Daily_SM_Hours', 'GPA', 'Depression_Score'];
  const displayNames = {
    'Sleep_Hours': 'Sleep',
    'Daily_SM_Hours': 'SM Use',
    'GPA': 'GPA',
    'Depression_Score': 'Depression'
  };

  const avgData = dimensions.map(dim => ({
    name: displayNames[dim],
    value: d3.mean(data, d => d[dim]) || 0
  }));

  const x = d3.scaleBand()
    .range([ 0, width ])
    .domain(avgData.map(d => d.name))
    .padding(0.2);
    
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
      .attr("transform", "rotate(-35)")
      .attr("dx", "-0.8em")
      .attr("dy", "0.15em")
      .style("text-anchor", "end")
      .style("fill", "var(--text-main)")
      .style("font-size", "11px");

  const y = d3.scaleLinear()
    .domain([0, d3.max(avgData, d => d.value) * 1.2])
    .range([ height, 0]);
    
  svg.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .selectAll("text")
      .style("fill", "var(--text-muted)");

  const colors = ['#34d399', '#0284c7', '#fbbf24', '#fb7185'];

  svg.selectAll("mybar")
    .data(avgData)
    .join("rect")
      .attr("x", d => x(d.name))
      .attr("y", d => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d.value))
      .attr("fill", (d, i) => colors[i % colors.length])
      .attr("rx", 4);
      
  svg.selectAll("mytext")
    .data(avgData)
    .join("text")
      .attr("x", d => x(d.name) + x.bandwidth() / 2)
      .attr("y", d => y(d.value) - 5)
      .attr("text-anchor", "middle")
      .style("fill", "var(--text-main)")
      .style("font-size", "11px")
      .text(d => d.value.toFixed(2));
      
  // Add Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width + 10}, 10)`);
    
  avgData.forEach((d, i) => {
    const legendRow = legend.append("g")
      .attr("transform", `translate(0, ${i * 20})`);
      
    legendRow.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", colors[i % colors.length]);
      
    legendRow.append("text")
      .attr("x", 15)
      .attr("y", 10)
      .attr("text-anchor", "start")
      .style("fill", "var(--text-main)")
      .style("font-size", "11px")
      .text(d.name);
  });

  container.appendChild(svgRoot.node());
}

function renderParallelCoordinates(data) {
  const container = document.getElementById('pc-chart-wrapper');
  if (!container) return;
  container.innerHTML = '';
  
  if (data.length === 0) return;

  const rect = container.getBoundingClientRect();
  const margin = {top: 30, right: 10, bottom: 10, left: 10};
  const width = rect.width - margin.left - margin.right;
  const height = rect.height - margin.top - margin.bottom;

  const svgRoot = d3.create("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);
    
  const svg = svgRoot.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const dimensions = ['GPA', 'Sleep_Hours', 'Daily_Study_Hours', 'Wellbeing_Score', 'Stress_Score', 'Anxiety_Score', 'Depression_Score'];
  
  const displayNames = {
    'GPA': 'GPA',
    'Sleep_Hours': 'Sleep',
    'Daily_Study_Hours': 'Study Hrs',
    'Wellbeing_Score': 'Wellbeing',
    'Stress_Score': 'Stress',
    'Anxiety_Score': 'Anxiety',
    'Depression_Score': 'Depress'
  };

  const y = {};
  for (let dim of dimensions) {
    y[dim] = d3.scaleLinear()
      .domain(d3.extent(data, d => d[dim]))
      .range([height, 0]);
  }

  const x = d3.scalePoint()
    .range([0, width])
    .padding(1)
    .domain(dimensions);

  const color = d3.scaleSequential(d3.interpolateCool)
    .domain(d3.extent(data, d => d.GPA));

  function path(d) {
    return d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));
  }

  // Draw lines
  svg.selectAll("myPath")
    .data(data)
    .join("path")
    .attr("d", path)
    .style("fill", "none")
    .style("stroke", d => color(d.GPA))
    .style("stroke-width", 1)
    .style("opacity", 0.3)
    .on("mouseover", function() {
      d3.select(this).style("stroke-width", 3).style("opacity", 1);
    })
    .on("mouseout", function() {
      d3.select(this).style("stroke-width", 1).style("opacity", 0.3);
    });

  // Draw axes
  const axes = svg.selectAll("myAxis")
    .data(dimensions).enter()
    .append("g")
    .attr("transform", d => `translate(${x(d)})`);
    
  axes.append("g")
    .each(function(d) { d3.select(this).call(d3.axisLeft(y[d]).ticks(5)); })
    .style("color", "var(--text-muted)");

  axes.append("text")
    .style("text-anchor", "middle")
    .attr("y", -9)
    .text(d => displayNames[d])
    .style("fill", "var(--text-main)")
    .style("font-size", "10px");

  container.appendChild(svg.node());
}

function renderRadarChart(data) {
  const container = document.getElementById('radar-chart-wrapper');
  if (!container) return;
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color: var(--text-muted)">No data for this filter segment</div>';
    return;
  }

  const rect = container.getBoundingClientRect();
  const margin = 30;
  const width = rect.width;
  const height = rect.height;
  const radius = Math.min(width, height) / 2 - margin;

  const svgRoot = d3.create("svg")
    .attr("width", width)
    .attr("height", height);

  const svg = svgRoot.append("g")
    .attr("transform", `translate(${width/2},${height/2})`);

  const dimensions = ['GPA', 'Sleep_Hours', 'Daily_Study_Hours', 'Wellbeing_Score', 'Stress_Score', 'Anxiety_Score', 'Depression_Score', 'Daily_SM_Hours'];
  
  // Calculate averages
  const avgData = {};
  dimensions.forEach(dim => {
    avgData[dim] = d3.mean(data, d => d[dim]);
  });
  
  // Normalize values (0 to 1) based on max possible or max in dataset
  const normalized = dimensions.map(dim => {
    const max = d3.max(data, d => d[dim]) || 1;
    return {
      axis: dim,
      value: avgData[dim] / max,
      actual: avgData[dim]
    };
  });

  const angleSlice = Math.PI * 2 / dimensions.length;
  const rScale = d3.scaleLinear().range([0, radius]).domain([0, 1]);

  // Draw grid circles
  const levels = 4;
  for(let i=0; i<levels; i++) {
    const r = radius / levels * (i+1);
    svg.append("circle")
       .attr("r", r)
       .style("fill", "none")
       .style("stroke", "rgba(255,255,255,0.1)")
       .style("stroke-dasharray", "3,3");
  }

  // Draw axes
  const axis = svg.selectAll(".axis")
    .data(dimensions).enter()
    .append("g").attr("class", "axis");

  axis.append("line")
    .attr("x1", 0).attr("y1", 0)
    .attr("x2", (d, i) => rScale(1.1) * Math.cos(angleSlice * i - Math.PI/2))
    .attr("y2", (d, i) => rScale(1.1) * Math.sin(angleSlice * i - Math.PI/2))
    .style("stroke", "rgba(255,255,255,0.2)")
    .style("stroke-width", "1px");

  const displayNames = {
    'GPA': 'GPA', 'Sleep_Hours': 'Sleep', 'Daily_Study_Hours': 'Study', 
    'Wellbeing_Score': 'Wellbeing', 'Stress_Score': 'Stress', 
    'Anxiety_Score': 'Anxiety', 'Depression_Score': 'Depression',
    'Daily_SM_Hours': 'Social Media'
  };

  axis.append("text")
    .attr("class", "legend")
    .style("font-size", "10px")
    .style("fill", "var(--text-main)")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("x", (d, i) => rScale(1.2) * Math.cos(angleSlice * i - Math.PI/2))
    .attr("y", (d, i) => rScale(1.2) * Math.sin(angleSlice * i - Math.PI/2))
    .text(d => displayNames[d]);

  // Draw blob
  const radarLine = d3.lineRadial()
    .curve(d3.curveLinearClosed)
    .radius(d => rScale(d.value))
    .angle((d,i) => i * angleSlice);

  svg.append("path")
    .datum(normalized)
    .attr("d", radarLine)
    .style("fill", "var(--c-purple)")
    .style("fill-opacity", 0.5)
    .style("stroke", "var(--c-purple)")
    .style("stroke-width", 2);

  // Points
  svg.selectAll(".radar-point")
    .data(normalized).enter()
    .append("circle")
    .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI/2))
    .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI/2))
    .attr("r", 4)
    .style("fill", "#fff")
    .style("stroke", "var(--c-purple)")
    .append("title")
    .text(d => `${displayNames[d.axis]}: ${d.actual.toFixed(1)}`);

  container.appendChild(svgRoot.node());
}

// Boot
init();
