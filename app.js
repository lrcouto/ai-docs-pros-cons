// firebaseConfig is loaded from firebase-config.js (gitignored).
// See firebase-config.example.js for the template.
firebase.initializeApp(window.firebaseConfig);
const db = firebase.database();

// ── State ─────────────────────────────────────────────────────

let allSubmissions = [];

// ── DOM refs ──────────────────────────────────────────────────

const body          = document.body;
const modeToggle    = document.getElementById('modeToggle');

const doInput       = document.getElementById('doInput');
const dontInput     = document.getElementById('dontInput');
const submitBtn     = document.getElementById('submitBtn');
const submitMsg     = document.getElementById('submitMsg');
const feedList      = document.getElementById('feedList');
const feedCount     = document.getElementById('feedCount');
const feedEmpty     = document.getElementById('feedEmpty');
const cloudTitle    = document.getElementById('cloudTitle');
const cloudEmpty    = document.getElementById('cloudEmpty');
const barChart      = document.getElementById('barChart');
const barEmpty      = document.getElementById('barEmpty');
const canvas        = document.getElementById('wordCloudCanvas');

// ── Mode switch ───────────────────────────────────────────────

function currentMode() { return body.dataset.mode; }

modeToggle.addEventListener('change', () => {
  body.dataset.mode = modeToggle.checked ? 'dont' : 'do';
  if (isTabActive('feed'))     renderFeed();
  if (isTabActive('insights')) renderInsights();
});

// ── Tabs ──────────────────────────────────────────────────────

function isTabActive(name) {
  return !document.getElementById('tab-' + name).classList.contains('hidden');
}

const allTabs = document.querySelectorAll('.tab');

function showTab(name) {
  allTabs.forEach(t => { t.style.display = 'none'; t.classList.add('hidden'); });
  const el = document.getElementById('tab-' + name);
  el.style.display = 'block';
  el.classList.remove('hidden');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showTab(btn.dataset.tab);
    if (btn.dataset.tab === 'feed')     renderFeed();
    if (btn.dataset.tab === 'insights') renderInsights();
  });
});


// ── Submit ────────────────────────────────────────────────────

submitBtn.addEventListener('click', async () => {
  const doText   = doInput.value.trim();
  const dontText = dontInput.value.trim();

  if (!doText && !dontText) {
    showMsg('Please fill in at least one field.', 'error');
    return;
  }

  submitBtn.disabled = true;

  const entries = [];
  if (doText)   entries.push({ type: 'do',   text: doText,   createdAt: Date.now() });
  if (dontText) entries.push({ type: 'dont', text: dontText, createdAt: Date.now() });

  try {
    await Promise.all(entries.map(e => db.ref('submissions').push(e)));
    doInput.value   = '';
    dontInput.value = '';
    showMsg('Submitted!', 'success');
  } catch (err) {
    showMsg('Could not submit — check your Firebase config.', 'error');
    console.error(err);
  }

  submitBtn.disabled = false;
});

function showMsg(text, type) {
  submitMsg.textContent = text;
  submitMsg.className   = 'submit-msg ' + type;
  clearTimeout(submitMsg._timer);
  submitMsg._timer = setTimeout(() => {
    submitMsg.className = 'submit-msg hidden';
  }, 4000);
}

// ── Real-time listener ────────────────────────────────────────

db.ref('submissions').on('value', snapshot => {
  allSubmissions = [];
  snapshot.forEach(child => {
    allSubmissions.push({ id: child.key, ...child.val() });
  });
  if (isTabActive('feed'))     renderFeed();
  if (isTabActive('insights')) renderInsights();
});

// ── Feed ──────────────────────────────────────────────────────

function renderFeed() {
  const mode     = currentMode();
  const filtered = allSubmissions.filter(s => s.type === mode);
  const label    = mode === 'do' ? 'I want AI to' : "I don't want AI to";

  feedCount.textContent = `${filtered.length} "${label}" response${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    feedList.innerHTML = '';
    feedEmpty.classList.remove('hidden');
    return;
  }

  feedEmpty.classList.add('hidden');
  feedList.innerHTML = '';

  // newest first
  [...filtered].reverse().forEach(s => {
    const card = document.createElement('div');
    card.className   = 'card';
    card.textContent = s.text;
    feedList.appendChild(card);
  });
}

// ── Word cloud ────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall','must',
  'can','it','its','i','we','you','he','she','they','me','us','him','her',
  'them','my','our','your','his','their','this','that','these','those','what',
  'which','who','whom','not','no','so','if','as','up','out','about','into',
  'through','after','before','when','where','how','all','more','also','just',
  'only','very','well','now','then','there','here','want','dont','ai',
]);

function tokenize(entries) {
  const freq = {};
  entries.forEach(s => {
    s.text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      .forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]);
}

// ── Insights ──────────────────────────────────────────────────

function renderInsights() {
  const mode     = currentMode();
  const filtered = allSubmissions.filter(s => s.type === mode);
  const label    = mode === 'do' ? 'I want AI to' : "I don't want AI to";

  cloudTitle.textContent = `"${label}" — word cloud`;

  const words = tokenize(filtered);

  // Word cloud
  if (words.length < 2) {
    canvas.style.display = 'none';
    cloudEmpty.classList.remove('hidden');
  } else {
    canvas.style.display = 'block';
    cloudEmpty.classList.add('hidden');
    const w = canvas.parentElement.clientWidth  || 600;
    const h = Math.max(260, Math.round(w * 0.42));
    canvas.width  = w;
    canvas.height = h;

    const palette = mode === 'do'
      ? ['#1a5c38', '#2e7d50', '#3d9e68', '#5cb88a', '#81c995', '#a8d5b5']
      : ['#7b1818', '#c0392b', '#d9534f', '#e07070', '#f08080', '#f5aaaa'];

    WordCloud(canvas, {
      list:         words.slice(0, 80),
      gridSize:     Math.round(w / 60),
      weightFactor: n => Math.max(14, Math.sqrt(n) * 18),
      fontFamily:   'system-ui, -apple-system, sans-serif',
      fontWeight:   '600',
      color:        () => palette[Math.floor(Math.random() * palette.length)],
      rotateRatio:  0.25,
      backgroundColor: 'transparent',
      shrinkToFit:  true,
    });
  }

  // Bar chart
  const top10 = words.slice(0, 10);

  if (top10.length === 0) {
    barChart.innerHTML = '';
    barEmpty.classList.remove('hidden');
    return;
  }

  barEmpty.classList.add('hidden');
  const max = top10[0][1];

  barChart.innerHTML = top10.map(([word, count]) => `
    <div class="bar-row">
      <span class="bar-word">${escapeHtml(word)}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${((count / max) * 100).toFixed(1)}%"></div>
      </div>
      <span class="bar-count">${count}</span>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
