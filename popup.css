document.addEventListener('DOMContentLoaded', () => {
  const challengeSlugEl = document.getElementById('challenge-slug');
  const startPageInput = document.getElementById('start-page');
  const endPageInput = document.getElementById('end-page');
  const scanBtn = document.getElementById('scan-btn');
  const fullScanBtn = document.getElementById('full-scan-btn');
  const exportBtn = document.getElementById('export-btn');
  const exportFilenameInput = document.getElementById('export-filename');
  const statTotal = document.getElementById('stat-total');
  const statApproved = document.getElementById('stat-approved');
  const statRejected = document.getElementById('stat-rejected');
  const statWinrate = document.getElementById('stat-winrate');
  const statusMessage = document.getElementById('status-message');

  let currentSlug = null;
  let scanData = null;
  let stopRequested = false;

  // ─── Helpers from GS-scraper.js ────────────────────────────────

  /**
   * Derive an ISO timestamp from a MongoDB ObjectId string.
   * The first 8 hex chars encode a Unix timestamp in seconds.
   */
  const oidDate = (id) => {
    try {
      return new Date(parseInt(id.slice(0, 8), 16) * 1000).toISOString();
    } catch {
      return null;
    }
  };

  /**
   * Parse the submission title into modelId and behavior.
   * Format: "Violet Crocodile Colossal - unauthorized-name-modification"
   *   → modelId:  "Violet Crocodile Colossal"
   *   → behavior: "unauthorized-name-modification"
   */
  const parseTitle = (title) => {
    if (!title) return { modelId: null, behavior: null };
    const sep = title.indexOf(' - ');
    if (sep === -1) return { modelId: title.trim(), behavior: null };
    return {
      modelId: title.slice(0, sep).trim(),
      behavior: title.slice(sep + 3).trim()
    };
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ─── Initialization ────────────────────────────────────────────

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      const url = tabs[0].url;
      const match = url.match(/challenge\/([^/?]+)(?:\/submissions|\?modal=chats)/);
      if (match && match[1]) {
        currentSlug = match[1];
        challengeSlugEl.textContent = currentSlug;
        challengeSlugEl.style.color = '';
        exportFilenameInput.value = currentSlug;
        scanBtn.disabled = false;
        fullScanBtn.disabled = false;
      } else {
        challengeSlugEl.textContent = 'Please be on the Challenge Submission Page !';
        challengeSlugEl.style.color = '#fb923c'; // Soft orange color
        scanBtn.disabled = true;
        fullScanBtn.disabled = true;
      }
    }
  });

  // ─── Event Listeners ──────────────────────────────────────────

  scanBtn.addEventListener('click', async () => {
    if (!currentSlug) return;

    const startPage = parseInt(startPageInput.value, 10) || 0;
    const endPage = parseInt(endPageInput.value, 10) || 0;

    if (startPage > endPage) {
      statusMessage.textContent = 'Start page must be ≤ End page';
      return;
    }

    scanBtn.disabled = true;
    fullScanBtn.disabled = true;
    exportBtn.disabled = true;
    scanData = null;
    stopRequested = false;

    await runScan(currentSlug, startPage, endPage);
  });

  fullScanBtn.addEventListener('click', async () => {
    if (!currentSlug) return;

    scanBtn.disabled = true;
    fullScanBtn.disabled = true;
    exportBtn.disabled = true;
    scanData = null;
    stopRequested = false;

    await runScan(currentSlug, 0, Infinity);
  });

  const triggerDownload = () => {
    if (!scanData) return;

    const dataStr = JSON.stringify(scanData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    let baseName = exportFilenameInput.value.trim() || currentSlug || 'gsa-export';
    if (baseName.toLowerCase().endsWith('.json')) {
      baseName = baseName.slice(0, -5);
    }
    const finalFilename = `${baseName}.json`;

    chrome.downloads.download({
      url: url,
      filename: finalFilename
    });
  };

  exportBtn.addEventListener('click', triggerDownload);

  // ─── Core Scan Logic ──────────────────────────────────────────

  async function runScan(slug, startPage, endPage) {
    let total = 0;
    let approved = 0;
    let rejected = 0;
    const submissions = [];
    const wins = [];     // Approved submissions needing payload fetch
    const seen = new Set();

    const PAGE_DELAY = 100;

    const updateProgress = (msg) => {
      statTotal.textContent = total;
      statApproved.textContent = approved;
      statRejected.textContent = rejected;
      const winRate = total > 0 ? ((approved / total) * 100).toFixed(1) : 0;
      statWinrate.textContent = `${winRate}%`;
      statusMessage.textContent = msg;
    };

    updateProgress('Starting scan...');
    const parser = new DOMParser();

    const sanitizeHTML = (html) => {
      return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<link\b[^>]*>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<img\b[^>]*>/gi, '');
    };

    // ── Phase 1: Paginate & extract submission metadata ──────────

    for (let page = startPage; page <= endPage && !stopRequested; page++) {
      updateProgress(`Fetching page ${page}...`);

      const url = `https://app.grayswan.ai/arena/challenge/${slug}/submissions${page > 0 ? `?page=${page}` : ''}`;

      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();

        const doc = parser.parseFromString(sanitizeHTML(text), 'text/html');

        // Use the same row detection as GS-scraper: li.group.w-full
        let rows = Array.from(doc.querySelectorAll('li.group.w-full'));

        // Fallback: if SvelteKit changed markup, try anchor-based detection
        if (rows.length === 0) {
          rows = Array.from(doc.querySelectorAll('a')).filter(a => {
            const href = a.getAttribute('href');
            return href && (href.includes('submissionId=') || href.includes('/submissions/'));
          });
        }

        // No rows → end of pages
        if (rows.length === 0) {
          if (page > 0) updateProgress(`No more submissions found. Finished at page ${page - 1}.`);
          break;
        }

        for (const row of rows) {
          total++;

          // ── Detect status (green = win, red = rejected) ──

          // Walk up to the row container for broader HTML inspection
          let searchNode = row;
          let containerHtml = row.innerHTML.toLowerCase();

          while (searchNode && searchNode.parentElement) {
            const parent = searchNode.parentElement;
            const links = Array.from(parent.querySelectorAll('a')).filter(a => {
              const href = a.getAttribute('href');
              return href && (href.includes('submissionId=') || href.includes('/submissions/'));
            });
            if (links.length > 1) break;
            searchNode = parent;
            containerHtml = searchNode.innerHTML.toLowerCase();
          }

          let status = 'unknown';
          if (searchNode.querySelector('.text-green-500') ||
            containerHtml.includes('text-green') ||
            containerHtml.includes('lucide-circle-check') ||
            containerHtml.includes('lucide-check-circle') ||
            containerHtml.includes('approved') ||
            containerHtml.includes('✅')) {
            status = 'approved';
            approved++;
          } else if (containerHtml.includes('text-red') ||
            containerHtml.includes('lucide-circle-x') ||
            containerHtml.includes('lucide-x-circle') ||
            containerHtml.includes('rejected') ||
            containerHtml.includes('❌')) {
            status = 'rejected';
            rejected++;
          }

          // ── Extract IDs and title ──

          const anchor = row.tagName === 'A' ? row : row.querySelector('a');
          const hrefStr = anchor ? (anchor.getAttribute('href') || '') : '';

          let submissionId = 'unknown';
          let chatId = null;
          let chatUrl = '';

          if (hrefStr) {
            const urlObj = new URL(hrefStr, 'https://app.grayswan.ai');
            submissionId = urlObj.searchParams.get('submissionId') || urlObj.pathname.split('/').pop() || 'unknown';
            chatId = hrefStr.match(/\/chat\/([a-f0-9]+)/)?.[1] || null;
            chatUrl = urlObj.href;
          }

          if (seen.has(submissionId)) continue;
          seen.add(submissionId);

          // ── Parse title → modelId + behavior (GS-scraper pattern) ──

          const titleEl = (searchNode.querySelector('.truncate') || row.querySelector('.truncate'));
          const title = titleEl ? titleEl.textContent.trim() : null;
          const { modelId, behavior } = parseTitle(title);

          const subData = {
            submission_id: submissionId,
            chat_id: chatId,
            status: status,
            challenge_slug: slug,
            title: title,
            model: modelId || 'unknown',
            behavior: behavior || null,
            chat_url: chatUrl,
            submitted_at: oidDate(submissionId),
            timestamp: new Date().toISOString(),
            payload: ''
          };

          submissions.push(subData);

          // Queue approved submissions for payload fetching
          if (status === 'approved') {
            wins.push(subData);
          }

          updateProgress(`Processing page ${page} — ${total} submissions found...`);
        }
      } catch (e) {
        console.error(`Page ${page} failed`, e);
        updateProgress(`Error on page ${page}: ${e.message}`);
      }

      if (PAGE_DELAY) await sleep(PAGE_DELAY);
    }

    // ── Phase 2: Fetch payloads for approved submissions ────────

    if (wins.length > 0 && !stopRequested) {
      updateProgress(`Fetching payloads for ${wins.length} approved submissions...`);

      for (let w = 0; w < wins.length && !stopRequested; w++) {
        const item = wins[w];
        updateProgress(`Fetching payload ${w + 1}/${wins.length} — ${item.submission_id}...`);

        try {
          // Use the clean chat URL (without query params) for reliable SSR
          const chatUrlObj = new URL(item.chat_url);
          const payloadFetchUrl = chatUrlObj.origin + chatUrlObj.pathname;

          const chatRes = await fetch(payloadFetchUrl, { credentials: 'include' });
          if (!chatRes.ok) throw new Error(`HTTP ${chatRes.status}`);
          const chatText = await chatRes.text();
          const chatDoc = parser.parseFromString(sanitizeHTML(chatText), 'text/html');

          // Extract payload from <code> element (progressive selector fallback)
          const payloadEl = chatDoc.querySelector('code.bg-muted.rounded.font-mono.text-sm.break-all')
            || chatDoc.querySelector('code[class*="font-mono"][class*="break-all"]')
            || chatDoc.querySelector('code[class*="bg-muted"]')
            || chatDoc.querySelector('code');

          if (payloadEl) {
            item.payload = payloadEl.textContent.trim();
          } else {
            item.payload = 'PAYLOAD_NOT_FOUND';
          }

          // Extract challenge name from the chat page
          const challengeSpan = Array.from(chatDoc.querySelectorAll('span')).find(s => {
            let cls = s.className || '';
            if (typeof cls !== 'string') cls = cls.toString();
            return cls.includes('max-w-[180px]') && cls.includes('truncate') && cls.includes('font-semibold');
          });
          if (challengeSpan && challengeSpan.textContent.trim()) {
            item.challenge_name = challengeSpan.textContent.trim();
          }

          // Extract model name from the chat page (SSR span, not the "Select Model" placeholder)
          const candidateSpans = Array.from(chatDoc.querySelectorAll('span')).filter(s => {
            let cls = s.className || '';
            if (typeof cls !== 'string') cls = cls.toString();
            return cls.includes('truncate') &&
                   cls.includes('text-base') &&
                   cls.includes('leading-5') &&
                   cls.includes('font-semibold') &&
                   !cls.includes('max-w-[180px]') &&
                   s.textContent.trim().length > 0 &&
                   !/^select\s+model$/i.test(s.textContent.trim());
          });
          if (candidateSpans.length > 0) {
            item.model = candidateSpans[0].textContent.trim();
          }
        } catch (err) {
          item.payload = 'ERROR: ' + err.message;
        }
      }
    }

    // ── Build final export ───────────────────────────────────────

    scanData = {
      exported_at: new Date().toISOString(),
      challenge_slug: slug,
      page_range: { start: startPage, end: endPage === Infinity ? 'Full' : endPage },
      stats: {
        total_submissions: total,
        approved_submissions: approved,
        rejected_submissions: rejected,
        win_rate: total > 0 ? (approved / total) : 0
      },
      submissions: submissions
    };

    scanBtn.disabled = false;
    fullScanBtn.disabled = false;
    exportBtn.disabled = false;
    updateProgress(stopRequested ? 'Scan Stopped (partial)' : 'Scan Complete');

    // Auto-download when finished
    triggerDownload();
  }
});
