// content.js — Runs in the ISOLATED world
// Listens for messages from inject.js and plays audio files
// Sound only plays AFTER the result visually appears on screen

(function () {
    "use strict";

    let isWaitingForResult = false;
    let hasPlayed = false;
    let pendingResult = null; // stores the result to play after DOM confirms it

    console.log("[LC-Sound] Content script loaded.");

    // ── Audio URLs ────────────────────────────────────────────────────
    const successUrl = chrome.runtime.getURL("success.mp3");
    const errorUrl = chrome.runtime.getURL("error.mp3");

    function playSound(type) {
        if (hasPlayed) return;
        hasPlayed = true;
        isWaitingForResult = false;
        pendingResult = null;

        console.log(`[LC-Sound] ▶ Playing ${type} sound.`);
        const audio = new Audio(type === "success" ? successUrl : errorUrl);
        audio.volume = 1.0;
        audio.play().catch((e) =>
            console.warn(`[LC-Sound] Audio play error (${type}):`, e)
        );
    }

    // ── Listen for postMessage from inject.js ─────────────────────────
    window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || typeof msg.type !== "string") return;

        if (msg.type === "LC_SOUND_SUBMIT") {
            console.log("[LC-Sound] Submit detected.");
            isWaitingForResult = true;
            hasPlayed = false;
            pendingResult = null;
        }

        if (msg.type === "LC_SOUND_RESULT" && isWaitingForResult && !hasPlayed) {
            const type = msg.status_msg === "Accepted" ? "success" : "error";
            console.log("[LC-Sound] API result received:", msg.status_msg, "→", type);
            // Don't play immediately — wait for the DOM to show the result visually
            pendingResult = type;
            // Start checking the DOM for the visual confirmation
            waitForVisualResult(type, msg.status_msg);
        }
    });

    // ── Wait for the result to appear visually before playing ─────────
    function waitForVisualResult(type, statusMsg) {
        let attempts = 0;
        const maxAttempts = 40; // 40 × 250ms = 10 seconds max

        function check() {
            if (hasPlayed) return; // already played
            attempts++;

            // Look for the result text on screen
            const found = findResultOnScreen(statusMsg);
            if (found) {
                console.log(`[LC-Sound] Visual confirmation found: "${statusMsg}". Playing now.`);
                playSound(type);
                return;
            }

            if (attempts >= maxAttempts) {
                // Fallback: play anyway after 10s even if DOM didn't match
                console.log("[LC-Sound] Visual confirmation timed out. Playing sound anyway.");
                playSound(type);
                return;
            }

            setTimeout(check, 250);
        }

        check();
    }

    function findResultOnScreen(statusMsg) {
        // Search for the exact status message text in small DOM elements
        const els = document.querySelectorAll("span, div, p");
        for (const el of els) {
            const t = el.textContent.trim();
            if (t.length > 80 || t.length < 4) continue;
            if (t === statusMsg) return true;
        }
        return false;
    }

    console.log("[LC-Sound] Fully loaded. Waiting for submit…");
})();
