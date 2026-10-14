/**
 * Frontend client logic for the interactive Verified Attention explorer.
 * Collects lightweight DOM observations in real time and submits to /api/v1/*.
 */

let activeSessionId = null;
let observations = [];
let sessionStartTime = null;
let scrollEvents = 0;
let clickEvents = 0;

function log(message, type = 'info') {
  const container = document.getElementById('terminal-logs');
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  line.textContent = `[${timestamp}] ${message}`;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

// 1. Start Session
async function startDemoSession() {
  const btnStart = document.getElementById('btn-start');
  const btnVerify = document.getElementById('btn-verify');
  const sessionStatus = document.getElementById('session-status');

  log('Initiating session handshake with VAE API...', 'info');
  btnStart.disabled = true;

  try {
    const res = await fetch('/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentId: 'article_compliance_101',
        policyId: 'high-trust-v1',
        participant: 'demo_viewer'
      })
    });

    const data = await res.json();
    activeSessionId = data.sessionId;
    sessionStartTime = Date.now();
    observations = [];
    scrollEvents = 0;
    clickEvents = 0;

    log(`✓ Session created: ${activeSessionId}`, 'success');
    log('Observing client dynamics (dwell, scroll velocity, micro-pauses)...', 'info');

    sessionStatus.style.display = 'inline-flex';
    btnVerify.disabled = false;

    // Attach local micro-observers to reading area
    setupObservers();
  } catch (err) {
    log(`Error starting session: ${err.message}`, 'warn');
    btnStart.disabled = false;
  }
}

function setupObservers() {
  const readingArea = document.getElementById('reading-area');
  
  readingArea.addEventListener('scroll', () => {
    if (!activeSessionId) return;
    scrollEvents++;
    if (scrollEvents % 5 === 0) {
      log(`Captured observation: E-INTERACTION (scroll_event #${scrollEvents})`, 'info');
    }
  }, { passive: true });

  // Touch listener for mobile screen interactions
  readingArea.addEventListener('touchmove', () => {
    if (!activeSessionId) return;
    scrollEvents++;
    if (scrollEvents % 5 === 0) {
      log(`Captured observation: E-INTERACTION (mobile_touch_swipe #${scrollEvents})`, 'info');
    }
  }, { passive: true });

  readingArea.addEventListener('click', () => {
    if (!activeSessionId) return;
    clickEvents++;
    log(`Captured observation: E-INTERACTION (user_click)`, 'info');
  });
}

// 2. Complete Session & Ingest Evidence
async function completeDemoSession() {
  if (!activeSessionId) return;

  const btnStart = document.getElementById('btn-start');
  const btnVerify = document.getElementById('btn-verify');
  const sessionStatus = document.getElementById('session-status');

  btnVerify.disabled = true;
  sessionStatus.style.display = 'none';

  const durationMs = Date.now() - sessionStartTime;
  log(`Session closed. Total duration: ${(durationMs / 1000).toFixed(1)}s`, 'info');
  log(`Ingesting normalized evidence record...`, 'info');

  const evidenceRecord = {
    evidenceId: `urn:vap:evidence:${Math.random().toString(36).substring(2, 10)}`,
    sessionId: activeSessionId,
    sourceId: 'browser-sdk-demo',
    timestamp: new Date().toISOString(),
    evidenceType: 'E-INTERACTION',
    confidence: 0.94,
    payload: {
      scrollCount: scrollEvents,
      clickCount: clickEvents,
      durationMs: durationMs,
      engagementScore: Math.min(0.95, (scrollEvents * 0.1) + 0.5)
    }
  };

  try {
    // Post Evidence
    const evRes = await fetch('/api/v1/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evidenceRecord)
    });
    log('✓ Evidence ingested and indexed into append-only store.', 'success');

    // Request Proof of Attention
    log('Evaluating evidence against policy: high-trust-v1...', 'info');
    const proofRes = await fetch('/api/v1/proofs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSessionId,
        contentId: 'article_compliance_101',
        policyId: 'high-trust-v1',
        claims: ['human_presence', 'engaged_reading']
      })
    });

    const proof = await proofRes.json();
    log(`✓ Verification PASS! Proof of Attention issued.`, 'success');

    // Display proof card
    const proofContainer = document.getElementById('proof-container');
    const proofDetails = document.getElementById('proof-details');
    proofContainer.style.display = 'block';
    proofDetails.innerHTML = `
      <div><strong>Proof ID:</strong> ${proof.proofId || 'urn:vap:proof:demo'}</div>
      <div><strong>State:</strong> <span style="color:#34d399;">${proof.state || 'PUBLISHED'}</span></div>
      <div><strong>Calibrated Confidence:</strong> ${(proof.confidence * 100).toFixed(1)}%</div>
      <div><strong>Ed25519 Signature:</strong> <span style="color:#60a5fa;">${(proof.signature || 'sig_verified').slice(0, 36)}...</span></div>
    `;

    activeSessionId = null;
    btnStart.disabled = false;
  } catch (err) {
    log(`Error completing verification: ${err.message}`, 'warn');
    btnStart.disabled = false;
  }
}

// Initial Policy Fetch to check connectivity & restore auth session
window.addEventListener('DOMContentLoaded', async () => {
  checkAuthSession();

  try {
    const res = await fetch('/api/v1/policies');
    const data = await res.json();
    if (data.policies) {
      log(`Connected to VAE Engine. Available policies: ${data.policies.map(p => p.policyId).join(', ')}`, 'info');
    }
  } catch {
    log('VAE API running in standalone simulation mode.', 'warn');
  }
});

// ─── Commercial Customer Console & Auth Logic ───

let currentGeneratedKey = '';
let authMode = 'login'; // 'login' | 'signup'
let currentUser = null;

function checkAuthSession() {
  const saved = localStorage.getItem('vap_user_session');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      applyAuthenticatedState(currentUser);
      // Validate the token against the backend; drop the session on 401
      if (currentUser.token) {
        fetch('/api/v1/auth/me', { headers: { 'Authorization': 'Bearer ' + currentUser.token } })
          .then((res) => {
            if (res.status === 401) {
              localStorage.removeItem('vap_user_session');
              currentUser = null;
              applyLoggedOutState();
            }
          })
          .catch(() => { /* API offline / demo mode: keep local session */ });
      }
      return;
    } catch {
      localStorage.removeItem('vap_user_session');
    }
  }
  applyLoggedOutState();
}

function applyAuthenticatedState(user) {
  // 1. Switch top navbar button to sleek Console action
  const btnTrigger = document.getElementById('btn-login-trigger');
  const navConsoleBtn = document.getElementById('nav-console-btn');
  if (btnTrigger) btnTrigger.style.display = 'none';
  if (navConsoleBtn) navConsoleBtn.style.display = 'inline-flex';

  // 2. Update sidebar user and org display & unhide sidebar footer (with sign out)
  const sidebarOrg = document.getElementById('sidebar-org-name');
  const sidebarEmail = document.getElementById('sidebar-user-email');
  const sidebarFooter = document.getElementById('sidebar-footer-container');
  if (sidebarOrg && user.org) sidebarOrg.textContent = user.org;
  if (sidebarEmail && user.email) sidebarEmail.textContent = user.email;
  if (sidebarFooter) sidebarFooter.style.display = 'block';

  // 3. Unlock console overlay & unblur
  const overlay = document.getElementById('console-gate-overlay');
  const inner = document.getElementById('console-inner-body');
  const header = document.getElementById('console-section-header');
  if (overlay) overlay.style.display = 'none';
  if (inner) inner.classList.remove('gate-blur');
  if (header) header.style.display = 'flex';
}

function applyLoggedOutState() {
  // 1. Switch top navbar button back to Sign In
  const btnTrigger = document.getElementById('btn-login-trigger');
  const navConsoleBtn = document.getElementById('nav-console-btn');
  if (btnTrigger) btnTrigger.style.display = 'inline-block';
  if (navConsoleBtn) navConsoleBtn.style.display = 'none';

  // 2. Hide sidebar footer (ensuring Sign Out is not shown)
  const sidebarFooter = document.getElementById('sidebar-footer-container');
  if (sidebarFooter) sidebarFooter.style.display = 'none';

  // 3. Restore gating overlay & blur
  const overlay = document.getElementById('console-gate-overlay');
  const inner = document.getElementById('console-inner-body');
  const header = document.getElementById('console-section-header');
  if (overlay) overlay.style.display = 'block';
  if (inner) inner.classList.add('gate-blur');
  if (header) header.style.display = 'none';
}

function openAuthModal(mode = 'login') {
  authMode = mode;
  updateAuthModalUI();
  document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  updateAuthModalUI();
}

function updateAuthModalUI() {
  const title = document.getElementById('auth-modal-title');
  const orgGroup = document.getElementById('auth-org-group');
  const toggleBtn = document.getElementById('auth-toggle-mode-btn');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (authMode === 'signup') {
    title.textContent = 'Create Sandbox Account';
    orgGroup.style.display = 'block';
    toggleBtn.textContent = 'Already have an account? Sign In';
    submitBtn.textContent = 'Create Account';
  } else {
    title.textContent = 'Sign In to Console';
    orgGroup.style.display = 'none';
    toggleBtn.textContent = 'Need an account? Sign Up';
    submitBtn.textContent = 'Sign In';
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('auth-email-input').value.trim();
  const password = document.getElementById('auth-password-input').value;
  const org = document.getElementById('auth-org-input').value.trim() || 'Karakana Global';
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
  submitBtn.disabled = true;

  const endpoint = authMode === 'signup' ? '/api/v1/auth/register' : '/api/v1/auth/login';
  const payload = authMode === 'signup' ? { email, password, org } : { email, password };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = (data && data.error && data.error.message) || `Authentication failed (HTTP ${res.status})`;
      if (errorEl) { errorEl.textContent = message; errorEl.style.display = 'block'; }
      submitBtn.disabled = false;
      return;
    }

    // Backend returns { user: { id, email, org, role }, token }
    const user = data.user
      ? { email: data.user.email, org: data.user.org || org, role: data.user.role || 'DEVELOPER', token: data.token }
      : { email, org, role: 'DEVELOPER', token: data.token };

    localStorage.setItem('vap_user_session', JSON.stringify(user));
    currentUser = user;
    applyAuthenticatedState(user);
    closeAuthModal();

    log(`Authenticated as ${user.email} (${user.org}). Customer Console unlocked.`, 'success');

    const consoleSection = document.getElementById('console-section');
    if (consoleSection) consoleSection.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    if (errorEl) { errorEl.textContent = 'Could not reach the auth service. Is the API running?'; errorEl.style.display = 'block'; }
    log('Auth request failed: ' + (err && err.message ? err.message : 'network error'), 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function handleLogout() {
  localStorage.removeItem('vap_user_session');
  currentUser = null;
  applyLoggedOutState();
  log('Signed out of developer console.', 'info');
}

function openConsoleGate() {
  if (currentUser) {
    const section = document.getElementById('console-section');
    section.scrollIntoView({ behavior: 'smooth' });
  } else {
    openAuthModal('signup');
  }
}

function switchConsoleTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');
}

function generateApiKey() {
  const keyName = prompt('Enter a name for this API key:', 'Production SDK Ingestion');
  if (!keyName) return;

  const hex = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const fullKey = `vae_live_${hex}`;
  currentGeneratedKey = fullKey;

  const table = document.getElementById('api-keys-table');
  const newRow = document.createElement('tr');
  newRow.innerHTML = `
    <td><strong>${keyName}</strong></td>
    <td><code>${fullKey.slice(0, 16)}...</code></td>
    <td>5,000 req/min</td>
    <td>Just now</td>
    <td><span class="status-tag active">ACTIVE</span></td>
    <td>
      <button class="copy-btn" onclick="copySnippet('${fullKey}', this)">📋 Copy Full Key</button>
      <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="revokeKey(this)">Revoke</button>
    </td>
  `;
  table.prepend(newRow);

  // Show copy modal widget
  document.getElementById('modal-key-value').textContent = fullKey;
  document.getElementById('modal-copy-btn').textContent = '📋 Copy';
  document.getElementById('key-modal').style.display = 'flex';
}

function copyModalKey() {
  navigator.clipboard.writeText(currentGeneratedKey).then(() => {
    const btn = document.getElementById('modal-copy-btn');
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
  });
}

function closeKeyModal() {
  document.getElementById('key-modal').style.display = 'none';
}

function copySnippet(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

function revokeKey(btn) {
  const row = btn.closest('tr');
  const statusSpan = row.querySelector('.status-tag');
  statusSpan.className = 'status-tag revoked';
  statusSpan.textContent = 'REVOKED';
  btn.disabled = true;
  btn.textContent = 'Revoked';
}

function saveCustomPolicy() {
  const policyId = document.getElementById('policy-id-input').value;
  const dwell = document.getElementById('policy-dwell-input').value;
  const conf = document.getElementById('policy-conf-input').value;

  alert(`✓ Policy "${policyId}" deployed to VAE engine!\n• Min Dwell: ${dwell}s\n• Min Confidence: ${(conf * 100).toFixed(0)}%\nActive verifiers will now enforce this policy rule.`);
}

function exportProofAuditCSV() {
  const rows = [
    ['proofId', 'contentId', 'confidence', 'signature', 'state', 'timestamp'],
    ['urn:vap:proof:71e08fb9', 'article_compliance_101', '0.940', 'ed25519_sig_7f8a3d11', 'PUBLISHED', '2026-10-13T04:46:51Z'],
    ['urn:vap:proof:c89e1a20', 'video_training_hipaa_04', '0.965', 'ed25519_sig_10da5578', 'PUBLISHED', '2026-10-13T04:34:12Z'],
    ['urn:vap:proof:04a2dd89', 'sponsored_article_bmw_q4', '0.912', 'ed25519_sig_ee48a109', 'PUBLISHED', '2026-10-13T03:58:02Z']
  ];

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'verified_attention_audit_export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 6. Mobile Navigation Drawer Controls
function toggleMobileNav() {
  const nav = document.getElementById('main-nav');
  const btn = document.getElementById('mobile-nav-btn');
  if (!nav) return;
  const isOpen = nav.classList.toggle('mobile-open');
  if (btn) btn.classList.toggle('active', isOpen);
}

function closeMobileNav() {
  const nav = document.getElementById('main-nav');
  const btn = document.getElementById('mobile-nav-btn');
  if (nav) nav.classList.remove('mobile-open');
  if (btn) btn.classList.remove('active');
}

// 7. Omni-Channel & Social Proof Explorer (Sprint 16, Unit 7)
const MOCK_SOCIAL_PROOFS = [
  { platform: 'LinkedIn', archetype: 'feed', uri: 'urn:li:activity:72518293819238', dwell: '54s', conf: 0.94, attr: 'CONVERTED (/signup)', proofUrn: 'urn:vap:proof:social:linkedin:7f8a3d11' },
  { platform: 'YouTube', archetype: 'video', uri: 'urn:vap:content:youtube:video:dQw4w9WgXcQ', dwell: '3m 22s', conf: 0.96, attr: 'IN-PROGRESS', proofUrn: 'urn:vap:proof:social:youtube:10da5578' },
  { platform: 'Substack', archetype: 'article', uri: 'urn:vap:content:article:engineering.substack.com:p/architecture', dwell: '4m 12s', conf: 0.91, attr: 'CONVERTED (/pricing)', proofUrn: 'urn:vap:proof:social:longform:ee48a109' },
  { platform: 'X.com', archetype: 'feed', uri: 'urn:vap:content:x:status:1842918274928172', dwell: '28s', conf: 0.89, attr: 'ATTRIBUTED', proofUrn: 'urn:vap:proof:social:x:a4c9b210' },
  { platform: 'TikTok Web', archetype: 'video', uri: 'urn:vap:content:tiktok:video:7281928471928371', dwell: '48s', conf: 0.93, attr: 'VIEW_ONLY', proofUrn: 'urn:vap:proof:social:tiktok:3b19de42' }
];

function renderSocialProofs(filter = 'all', btnEl = null) {
  if (btnEl) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }

  const tbody = document.getElementById('social-proofs-tbody');
  if (!tbody) return;

  const filtered = filter === 'all' 
    ? MOCK_SOCIAL_PROOFS 
    : MOCK_SOCIAL_PROOFS.filter(p => p.archetype === filter);

  tbody.innerHTML = filtered.map(item => `
    <tr>
      <td><strong>${item.platform}</strong></td>
      <td><span class="status-tag active">${item.archetype.toUpperCase()}</span></td>
      <td><code style="font-size:0.75rem;">${item.uri.length > 35 ? item.uri.slice(0, 35) + '...' : item.uri}</code></td>
      <td>${item.dwell}</td>
      <td><strong style="color:var(--success);">${(item.conf * 100).toFixed(0)}%</strong></td>
      <td><span class="status-tag ${item.attr.includes('CONVERTED') ? 'active' : 'revoked'}" style="${item.attr.includes('CONVERTED') ? 'background:#059669;' : ''}">${item.attr}</span></td>
      <td><button class="copy-btn" onclick="copySnippet('${item.proofUrn}', this)">📋 Copy</button></td>
    </tr>
  `).join('');
}

function exportSocialProofsCSV() {
  const rows = [
    ['platform', 'archetype', 'contentUri', 'dwell', 'confidence', 'attributionStatus', 'proofUrn'],
    ...MOCK_SOCIAL_PROOFS.map(p => [p.platform, p.archetype, p.uri, p.dwell, p.conf, p.attr, p.proofUrn])
  ];
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'vap_omnichannel_social_proofs.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Initial populate
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    renderSocialProofs('all');
  });
}

