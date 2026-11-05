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

  // Domain check helpers using strict hostname suffix matching
  const host = window.location.hostname.toLowerCase();
  const isArxiv = host === 'arxiv.org' || host.endsWith('.arxiv.org');
  const isNcbi = host === 'ncbi.nlm.nih.gov' || host.endsWith('.ncbi.nlm.nih.gov');
  const isScholar = host === 'scholar.google.com' || host.endsWith('.scholar.google.com');

  // Google Scholar specific multi-result or card parsing
  if (isScholar) {
    const scholarCards = document.querySelectorAll('div.gs_r.gs_or.gs_scl');
    if (scholarCards.length > 0) {
      const parsedItems = [];
      scholarCards.forEach((card, index) => {
        const titleEl = card.querySelector('h3.gs_rt a') || card.querySelector('h3.gs_rt');
        if (!titleEl) return;
        const itemTitle = titleEl.innerText.replace(/^\[[A-Z]+\]\s*/, '').trim();
        const authorLine = card.querySelector('div.gs_a')?.innerText || '';
        const snippet = card.querySelector('div.gs_rs')?.innerText || '';
        const pdfLink = card.querySelector('div.gs_or_ggsm a')?.href || null;

        // Parse citation count "Cited by 124"
        let citations = 0;
        const bottomLinks = card.querySelectorAll('div.gs_fl a');
        bottomLinks.forEach(link => {
          const match = link.innerText.match(/Cited by (\d+)/i);
          if (match) citations = parseInt(match[1], 10);
        });

        // Authors & year from authorLine "A Vaswani, N Shazeer... - Advances in neural..., 2017 - papers.nips.cc"
        const yearMatch = authorLine.match(/\b(19|20)\d{2}\b/);
        const itemYear = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();
        const authorsPart = authorLine.split('-')[0] || '';
        const itemAuthors = authorsPart.split(',').map(a => a.trim()).filter(Boolean);

        parsedItems.push({
          title: itemTitle,
          authors: itemAuthors,
          year: itemYear,
          venue: 'Google Scholar',
          doi: null,
          abstract: snippet,
          pdf_url: pdfLink,
          citations_count: citations,
          source_url: titleEl.href || window.location.href
        });
      });

      if (parsedItems.length > 0) {
        return {
          is_scholar_list: true,
          items: parsedItems,
          title: parsedItems[0].title,
          authors: parsedItems[0].authors,
          year: parsedItems[0].year,
          venue: parsedItems[0].venue,
          doi: null,
          abstract: parsedItems[0].abstract,
          pdf_url: parsedItems[0].pdf_url,
          citations_count: parsedItems[0].citations_count,
          source_url: parsedItems[0].source_url
        };
      }
    }
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
    if (isArxiv) {
      const el = document.querySelector('h1.title');
      if (el) title = el.innerText.replace(/^Title:\s*/i, '').trim();
    } else if (isNcbi) {
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
    if (isArxiv) {
      const els = document.querySelectorAll('.authors a');
      authors = Array.from(els).map(a => a.innerText.trim());
    } else if (isNcbi) {
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
  if (!venue && isArxiv) {
    venue = 'arXiv Preprint';
  }

  // 6. Direct PDF URL
  let pdf_url = getMeta([
    'citation_pdf_url'
  ]);
  if (!pdf_url && isArxiv) {
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
  if (!abstract && isArxiv) {
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
