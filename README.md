<div align="center">
  <img src="assets/icon.png" alt="GSAIS Extension Logo" width="120"/>

  # GSAIS: Chrome Extension

  <p>
    <em>A sleek and powerful browser extension to seamlessly extract Gray Swan Arena submissions.</em>
  </p>

  [![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](#)
  [![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](#)
</div>

---

## 🌟 Overview
This extension is the data-collection engine of the **Gray Swan Arena Intelligence Suite**. It hooks directly into your active browser session, scans challenge submissions, extracts payload conversations, and packages it all into a clean JSON export for visualization.

### ✨ Features
- **Auto-Detection (Arena 2.0 Ready):** Automatically detects the challenge slug directly from any challenge page URL without requiring the submissions modal or tab to be open.
- **Cascading Judge Fallbacks:** Resilient multi-layer win/loss evaluation (`grade_status`, `successful`, `grading.is_break`, `severity.judge_result.is_break`) ensuring zero dropped records across schema variations.
- **Customizable Scans:** Scan a specific page range or trigger a full scan.
- **Beautiful Glassmorphism UI:** Features a sleek dark-mode interface with glowing orbs and frosted glass effects.
- **Custom Exports:** Allows you to define your custom export filename (defaults to the challenge slug).
- **Live Progress:** Watch real-time statistics (Approved, Rejected, Win Rate) update as the scan progresses.

---

## 🛠️ Installation

1. Clone or extract all repository files into a folder of your choice.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked**.
5. Select this `extension` folder.
6. *Tip:* Pin the extension to your browser toolbar for quick access!

---

## 🚀 How to Use

1. Log into your [Gray Swan Arena](https://app.grayswan.ai/) account.
2. Navigate to any challenge page.
   *Example: `https://app.grayswan.ai/arena/challenge/{challenge-slug}`*
   > **Note:** Arena 2.0 compatible. You no longer need to open the Submissions/Chats modal first — the extension detects the challenge slug directly from the page URL.
3. Click the **GSAIS** icon in your toolbar.
   - The challenge slug will automatically be detected from the page URL.
   - If not on a valid challenge page, a warning will prompt you to navigate to one.
4. Input your desired **Start Page** and **End Page**.
5. Click **Scan Range** (or **Full Scan**).
6. Provide a custom **Export Filename** if desired, then click **Export JSON**.

---

<div align="center">
  <img src="assets/bg.png" alt="Watermark Background" width="100%" style="opacity: 0.5; border-radius: 8px; margin-top: 20px;"/>
  <p><em>The extension relies on your browser's active session, meaning it securely fetches data without requiring API keys.</em></p>
</div>
