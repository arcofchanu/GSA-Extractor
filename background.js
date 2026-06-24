// Background service worker
// Currently all logic is handled in popup.js to utilize DOMParser natively.
chrome.runtime.onInstalled.addListener(() => {
  console.log("GSAIS Extension Installed");
});
