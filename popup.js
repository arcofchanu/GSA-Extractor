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

  // ─── Helpers ────────────────────────────────────────────────────

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
   * Format: "Violet Crocodile Colossal: I'm reviewing chat transcripts..."
   *   → modelId:  "Violet Crocodile Colossal"
   *   → preview:  "I'm reviewing chat transcripts..."
   */
  const parseTitle = (title) => {
    if (!title) return { modelId: null, behavior: null };
    // Try colon separator first (new format)
    const colonSep = title.indexOf(': ');
    if (colonSep !== -1) {
      return {
        modelId: title.slice(0, colonSep).trim(),
        behavior: title.slice(colonSep + 2).trim()
      };
    }
    // Fallback: dash separator (old format)
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
      // Match both old /submissions URL and new ?modal=chats URL
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

  // ─── Core Scan Logic (API-based) ──────────────────────────────

  async function runScan(slug, startPage, endPage) {
    let total = 0;
    let approved = 0;
    let rejected = 0;
    const submissions = [];
    const wins = [];
    const seen = new Set();

    const PAGE_SIZE = 10;
    const PAGE_DELAY = 150;

    const updateProgress = (msg) => {
      statTotal.textContent = total;
      statApproved.textContent = approved;
      statRejected.textContent = rejected;
      const winRate = total > 0 ? ((approved / total) * 100).toFixed(1) : 0;
      statWinrate.textContent = `${winRate}%`;
      statusMessage.textContent = msg;
    };

    updateProgress('Starting scan...');

    // ── Phase 1: Paginate through the submissions API ────────────

    for (let page = startPage; page <= endPage && !stopRequested; page++) {
      updateProgress(`Fetching page ${page}...`);

      // Gray Swan Arena REST API endpoint for submissions
      const apiUrl = `https://app.grayswan.ai/arena/challenge/${slug}/panels/submissions?page=${page}&limit=${PAGE_SIZE}&sort=recent`;

      try {
        const res = await fetch(apiUrl, { 
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!res.ok) {
          // If we get a 404 or similar, we've gone past the last page
          if (res.status === 404) {
            updateProgress(`Finished. No more pages after page ${page - 1}.`);
            break;
          }
          throw new Error(`HTTP ${res.status}`);
        }

        const rawText = await res.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (err) {
          throw new Error(`Expected JSON but got HTML. Are you logged in? (${rawText.substring(0, 30)})`);
        }
        
        const userSubmissions = data.userSubmissions || data.submissions || [];

        // No submissions on this page → we've reached the end
        if (userSubmissions.length === 0) {
          if (page > startPage) {
            updateProgress(`No more submissions. Finished at page ${page - 1}.`);
          } else {
            updateProgress('No submissions found.');
          }
          break;
        }

        for (const sub of userSubmissions) {
          const submissionId = sub._id || 'unknown';

          if (seen.has(submissionId)) continue;
          seen.add(submissionId);

          total++;

          // ── Determine status from API fields ──
          let status = 'unknown';
          if (sub.grade_status === 'success' || sub.successful === true) {
            status = 'approved';
            approved++;
          } else if (sub.grade_status === 'fail' || sub.successful === false) {
            status = 'rejected';
            rejected++;
          }

          // ── Extract the payload (first user message) ──
          let payload = '';
          if (sub.messages && Array.isArray(sub.messages)) {
            const userMsg = sub.messages.find(m => m.role === 'user');
            if (userMsg) {
              payload = userMsg.content || '';
            }
          }

          // ── Build the full conversation transcript ──
          let conversation = [];
          if (sub.messages && Array.isArray(sub.messages)) {
            conversation = sub.messages.map(m => ({
              role: m.role,
              content: m.content || '',
              timestamp: m.created_at || null
            }));
          }

          // ── Parse title for model name ──
          const { modelId, behavior: titleBehavior } = parseTitle(sub.title);

          const chatUrl = sub.chat_id
            ? `https://app.grayswan.ai/arena/challenge/${slug}?submissionId=${submissionId}`
            : '';

          const formatSlugToName = (s) => {
            if (!s) return 'Unknown Challenge';
            return s.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          };

          const subData = {
            submission_id: submissionId,
            chat_id: sub.chat_id || null,
            status: status,
            challenge_slug: slug,
            challenge_name: formatSlugToName(slug),
            title: sub.title || null,
            model: modelId || 'unknown',
            behavior: sub.behavior || titleBehavior || null,
            chat_url: chatUrl,
            submitted_at: sub.created_at || oidDate(submissionId),
            timestamp: new Date().toISOString(),
            payload: payload
          };

          if (status === 'approved') {
            wins.push(subData);
          }

          submissions.push(subData);

          updateProgress(`Processing page ${page} — ${total} submissions found...`);
        }

        // If this page had fewer results than PAGE_SIZE, it's the last page
        if (userSubmissions.length < PAGE_SIZE) {
          updateProgress(`Last page reached (page ${page}). ${total} submissions found.`);
          break;
        }

      } catch (e) {
        console.error(`Page ${page} failed`, e);
        updateProgress(`Error: ${e.message}`);
        // Stop scan on error so user can see it
        break;
      }

      if (PAGE_DELAY) await sleep(PAGE_DELAY);
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
      submissions: wins
    };

    scanBtn.disabled = false;
    fullScanBtn.disabled = false;
    exportBtn.disabled = false;
    updateProgress(stopRequested ? 'Scan Stopped (partial)' : `Scan Complete — ${total} submissions found`);

    // Auto-download when finished
    triggerDownload();
  }
});
