let currentPaper = null;
const BACKEND_URL = 'http://127.0.0.1:8000';

async function checkBackend() {
  const badge = document.getElementById('conn-badge');
  try {
    const res = await fetch(`${BACKEND_URL}/api/clipper/status`, { cache: 'no-store' });
    if (res.ok) {
      badge.textContent = 'Desktop Connected';
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
  } catch (e) {
    // fallback
  }
  clipBtn.disabled = false;
}

function generateBibtex(paper) {
  const firstAuthor = paper.authors && paper.authors[0] ? paper.authors[0].split(' ').pop().toLowerCase() : 'paper';
  const citeKey = `${firstAuthor}${paper.year || 2026}`;
  const authorList = (paper.authors || []).join(' and ');
  return `@article{${citeKey},\n  title={${paper.title}},\n  author={${authorList}},\n  year={${paper.year || ''}},\n  journal={${paper.venue || ''}},\n  doi={${paper.doi || ''}}\n}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const isOnline = await checkBackend();
  const paper = await extractPageData();

  if (paper) {
    currentPaper = paper;
    document.getElementById('p-title').textContent = paper.title;
    document.getElementById('p-authors').textContent = paper.authors && paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Authors';
    document.getElementById('p-year').textContent = paper.year || 'Unknown Year';
    document.getElementById('p-venue').textContent = paper.venue || 'Journal / Conference';
    document.getElementById('p-pdf').textContent = paper.pdf_url ? 'PDF: Available' : 'PDF: Web Abstract';

    if (isOnline) {
      await checkVaultDuplicate(paper);
    } else {
      document.getElementById('clip-btn').disabled = true;
      document.getElementById('feedback-msg').innerHTML = '<div class="error-msg">Launch ResearchLoom desktop to clip directly</div>';
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
      setTimeout(() => { msg.innerHTML = ''; }, 2500);
    });
  });
});
