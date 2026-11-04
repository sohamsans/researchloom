/**
 * ResearchLoom Clipper - Metadata Extractor
 * Scrapes academic publication metadata from Highwire Press, Dublin Core, PRISM,
 * and academic domains (arXiv, PubMed, Nature, IEEE, ScienceDirect).
 */
(() => {
  function getMeta(names) {
    for (const name of names) {
      const el = document.querySelector(`meta[name="${name}" i], meta[property="${name}" i]`);
      if (el && el.content && el.content.trim()) {
        return el.content.trim();
      }
    }
    return null;
  }

  function getAllMeta(names) {
    const values = [];
    for (const name of names) {
      const els = document.querySelectorAll(`meta[name="${name}" i], meta[property="${name}" i]`);
      els.forEach(el => {
        if (el.content && el.content.trim()) {
          values.push(el.content.trim());
        }
      });
    }
    return values;
  }

  // 1. Title Extraction
  let title = getMeta([
    'citation_title',
    'dc.title',
    'dcterms.title',
    'og:title',
    'twitter:title'
  ]);
  if (!title) {
    // Domain specific
    if (window.location.hostname.includes('arxiv.org')) {
      const el = document.querySelector('h1.title');
      if (el) title = el.innerText.replace(/^Title:\s*/i, '').trim();
    } else if (window.location.hostname.includes('ncbi.nlm.nih.gov')) {
      const el = document.querySelector('h1.heading-title');
      if (el) title = el.innerText.trim();
    } else {
      title = document.title;
    }
  }

  // 2. Authors Extraction
  let authors = getAllMeta([
    'citation_author',
    'dc.creator',
    'dcterms.creator',
    'author'
  ]);
  if (authors.length === 0) {
    if (window.location.hostname.includes('arxiv.org')) {
      const els = document.querySelectorAll('.authors a');
      authors = Array.from(els).map(a => a.innerText.trim());
    } else if (window.location.hostname.includes('ncbi.nlm.nih.gov')) {
      const els = document.querySelectorAll('.authors-list .full-name');
      authors = Array.from(els).map(a => a.innerText.trim());
    }
  }

  // 3. DOI Extraction
  let doi = getMeta([
    'citation_doi',
    'dc.identifier.doi',
    'dc.identifier',
    'prism.doi'
  ]);
  if (!doi) {
    const doiMatch = document.body.innerText.match(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i);
    if (doiMatch) doi = doiMatch[1];
  }

  // 4. Year / Date Extraction
  let year = null;
  const dateStr = getMeta([
    'citation_publication_date',
    'citation_date',
    'dc.date',
    'dcterms.issued',
    'prism.publicationDate'
  ]);
  if (dateStr) {
    const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) year = parseInt(yearMatch[0], 10);
  }

  // 5. Venue / Journal
  let venue = getMeta([
    'citation_journal_title',
    'citation_conference_title',
    'prism.publicationName',
    'dc.source'
  ]);
  if (!venue && window.location.hostname.includes('arxiv.org')) {
    venue = 'arXiv Preprint';
  }

  // 6. Direct PDF URL
  let pdf_url = getMeta([
    'citation_pdf_url'
  ]);
  if (!pdf_url && window.location.hostname.includes('arxiv.org')) {
    const pdfLink = document.querySelector('a.download-pdf');
    if (pdfLink && pdfLink.href) pdf_url = pdfLink.href;
  }

  // 7. Abstract Extraction
  let abstract = getMeta([
    'citation_abstract',
    'dc.description',
    'description',
    'og:description'
  ]);
  if (!abstract && window.location.hostname.includes('arxiv.org')) {
    const el = document.querySelector('blockquote.abstract');
    if (el) abstract = el.innerText.replace(/^Abstract:\s*/i, '').trim();
  }

  return {
    title: title || 'Untitled Paper',
    authors: authors.slice(0, 15),
    year: year || new Date().getFullYear(),
    venue: venue || null,
    doi: doi || null,
    abstract: abstract || null,
    pdf_url: pdf_url || null,
    source_url: window.location.href
  };
})();
