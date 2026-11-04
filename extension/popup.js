let currentPaper = null;
const BACKEND_URL = 'http://127.0.0.1:8000';

async function checkBackend() {
  const badge = document.getElementById('conn-badge');
  try {
    const res = await fetch(`${BACKEND_URL}/api/clipper/status`, { cache: 'no-store' });
    if (res.ok) {
      badge.textContent = 'Active (Background)';
      badge.className = 'badge online';
      return true;
    }
  } catch (e) {
    // offline
  }
  badge.textContent = 'Desktop Offline';
  badge.className = 'badge offline';
  return false;
}

async function extractPageData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return null;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
  } catch (err) {
    console.error('Failed to extract metadata:', err);
  }
  return null;
}

async function checkVaultDuplicate(paper) {
  const box = document.getElementById('vault-status-box');
  const text = document.getElementById('vault-status-text');
  const clipBtn = document.getElementById('clip-btn');

  try {
    const res = await fetch(`${BACKEND_URL}/api/clipper/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doi: paper.doi,
        title: paper.title,
        url: paper.source_url
      })
    });
    if (res.ok) {
      const data = await res.json();
      box.style.display = 'flex';
      if (data.in_vault) {
        box.className = 'vault-status exists';
        text.textContent = '✓ Already in your ResearchLoom vault';
        clipBtn.textContent = 'Update Vault Entry';
      } else {
        box.className = 'vault-status new';
        text.textContent = '★ New paper (Not in vault)';
        clipBtn.textContent = 'Clip to Vault & Queue PDF';
      }
      clipBtn.disabled = false;
      return;
    }
  } catch (e) {}
  clipBtn.disabled = false;
}

function generateBibtex(paper) {
  const firstAuthor = paper.authors && paper.authors[0] ? paper.authors[0].split(' ').pop().toLowerCase() : 'paper';
  const citeKey = `${firstAuthor}${paper.year || 2026}`;
  const authorList = (paper.authors || []).join(' and ');
  return `@article{${citeKey},\n  title={${paper.title}},\n  author={${authorList}},\n  year={${paper.year || ''}},\n  journal={${paper.venue || ''}},\n  doi={${paper.doi || ''}}\n}`;
}

async function searchVault(q) {
  const container = document.getElementById('vault-search-results');
  if (!q.trim()) {
    container.innerHTML = '<div style="text-align: center; color: #71717a; padding: 20px 0; font-size: 11px;">Type to search vaulted literature</div>';
    return;
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/clipper/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #71717a; padding: 20px 0; font-size: 11px;">No matching papers in vault</div>';
        return;
      }
      container.innerHTML = data.results.map(r => `
        <div class="result-item" data-doi="${r.doi || ''}" data-title="${r.title}">
          <div class="result-item-title">${r.title}</div>
          <div class="result-item-sub">${r.doi ? r.doi : 'No DOI'} • ${r.has_pdf ? 'PDF Available' : 'Metadata'}</div>
        </div>
      `).join('');

      container.querySelectorAll('.result-item').forEach(el => {
        el.addEventListener('click', () => {
          const t = el.getAttribute('data-title');
          const d = el.getAttribute('data-doi');
          const bib = `@article{cite,\n  title={${t}},\n  doi={${d}}\n}`;
          navigator.clipboard.writeText(bib).then(() => {
            const msg = document.getElementById('feedback-msg');
            msg.innerHTML = '<div class="status-msg">✓ Copied BibTeX to clipboard!</div>';
            setTimeout(() => { msg.innerHTML = ''; }, 2000);
          });
        });
      });
    }
  } catch (e) {
    container.innerHTML = '<div class="error-msg">Failed to search vault</div>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const isOnline = await checkBackend();
  const paper = await extractPageData();

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Open App Button
  document.getElementById('open-app-btn').addEventListener('click', async () => {
    try {
      await fetch(`${BACKEND_URL}/api/clipper/launch-app`, { method: 'POST' });
    } catch (e) {
      console.warn('Launch app error:', e);
    }
  });

  // Paper Clipper population
  if (paper) {
    currentPaper = paper;
    document.getElementById('p-title').textContent = paper.title;
    document.getElementById('p-authors').textContent = paper.authors && paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Authors';
    document.getElementById('p-year').textContent = paper.year || 'N/A';
    document.getElementById('p-venue').textContent = paper.venue || 'Journal';
    document.getElementById('p-pdf').textContent = paper.pdf_url ? 'PDF' : 'Abstract';

    if (isOnline) {
      await checkVaultDuplicate(paper);
    } else {
      document.getElementById('clip-btn').disabled = true;
    }
  } else {
    document.getElementById('p-title').textContent = 'No academic publication detected on this tab';
    document.getElementById('p-authors').textContent = 'Navigate to arXiv, PubMed, or any journal page';
  }

  // Clip Button Action
  document.getElementById('clip-btn').addEventListener('click', async () => {
    if (!currentPaper) return;
    const btn = document.getElementById('clip-btn');
    const msg = document.getElementById('feedback-msg');
    btn.disabled = true;
    btn.textContent = 'Clipping to Vault...';

    try {
      const res = await fetch(`${BACKEND_URL}/api/clipper/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPaper)
      });
      if (res.ok) {
        const data = await res.json();
        btn.textContent = '✓ Clipped to Vault';
        msg.innerHTML = `<div class="status-msg">${data.message || 'Saved successfully!'}</div>`;
      } else {
        btn.disabled = false;
        btn.textContent = 'Clip to Vault & Queue PDF';
        msg.innerHTML = '<div class="error-msg">Failed to clip paper</div>';
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Clip to Vault & Queue PDF';
      msg.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
  });

  // BibTeX Copy Action
  document.getElementById('bibtex-btn').addEventListener('click', () => {
    if (!currentPaper) return;
    const bib = generateBibtex(currentPaper);
    navigator.clipboard.writeText(bib).then(() => {
      const msg = document.getElementById('feedback-msg');
      msg.innerHTML = '<div class="status-msg">✓ Copied BibTeX to clipboard!</div>';
      setTimeout(() => { msg.innerHTML = ''; }, 2000);
    });
  });

  // Search Vault Tab
  let searchTimer = null;
  document.getElementById('vault-search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchVault(e.target.value), 250);
  });

  // Save Quick Note
  document.getElementById('save-note-btn').addEventListener('click', async () => {
    const textEl = document.getElementById('quick-note-text');
    const content = textEl.value.trim();
    if (!content) return;
    const msg = document.getElementById('feedback-msg');
    const btn = document.getElementById('save-note-btn');
    btn.disabled = true;
    btn.textContent = 'Saving Note...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
      const res = await fetch(`${BACKEND_URL}/api/clipper/quick-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentPaper ? `Thought on: ${currentPaper.title}` : 'Clipper Quick Thought',
          content: content,
          source_url: tab ? tab.url : null
        })
      });
      if (res.ok) {
        textEl.value = '';
        btn.textContent = '✓ Note Saved';
        msg.innerHTML = '<div class="status-msg">Saved to ResearchLoom notes!</div>';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Save to ResearchLoom Notes';
          msg.innerHTML = '';
        }, 2000);
      } else {
        btn.disabled = false;
        btn.textContent = 'Save to ResearchLoom Notes';
        msg.innerHTML = '<div class="error-msg">Failed to save note</div>';
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Save to ResearchLoom Notes';
      msg.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
  });
});
