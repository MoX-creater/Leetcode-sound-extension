// inject.js — Runs in the MAIN world (page context)
// Intercepts XHR and fetch to detect LeetCode submission API responses
// Communicates results to content.js via window.postMessage

(function () {
    "use strict";

    console.log("[LC-Sound-Inject] Main-world script loaded.");

    // ── Intercept XMLHttpRequest ──────────────────────────────────────
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._lcUrl = typeof url === "string" ? url : String(url);
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        const xhr = this;
        const url = xhr._lcUrl || "";

        // Detect the initial submit POST (contains /problems/.../submit/)
        if (/\/problems\/.*\/submit\/?/.test(url)) {
            console.log("[LC-Sound-Inject] XHR submit detected:", url);
            window.postMessage({ type: "LC_SOUND_SUBMIT" }, "*");
        }

        // Listen for the polling /check/ response that returns the final result
        if (url.includes("/check/")) {
            xhr.addEventListener("load", function () {
                try {
                    const data = JSON.parse(xhr.responseText);
                    // Only fire when the judging is fully done (state === "SUCCESS" means judging finished)
                    if (data.state === "SUCCESS" && data.status_msg) {
                        console.log("[LC-Sound-Inject] XHR final result:", data.status_msg, "| total_correct:", data.total_correct, "| total_testcases:", data.total_testcases);
                        window.postMessage({
                            type: "LC_SOUND_RESULT",
                            status_msg: data.status_msg,
                            total_correct: data.total_correct,
                            total_testcases: data.total_testcases,
                        }, "*");
                    }
                } catch (_) { }
            });
        }

        return origSend.apply(this, arguments);
    };

    // ── Intercept fetch ───────────────────────────────────────────────
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
        const url = typeof input === "string" ? input : input?.url || "";

        if (/\/problems\/.*\/submit\/?/.test(url)) {
            console.log("[LC-Sound-Inject] Fetch submit detected:", url);
            window.postMessage({ type: "LC_SOUND_SUBMIT" }, "*");
        }

        return origFetch.apply(this, arguments).then((response) => {
            if (url.includes("/check/")) {
                response.clone().text().then((text) => {
                    try {
                        const data = JSON.parse(text);
                        if (data.state === "SUCCESS" && data.status_msg) {
                            console.log("[LC-Sound-Inject] Fetch final result:", data.status_msg);
                            window.postMessage({
                                type: "LC_SOUND_RESULT",
                                status_msg: data.status_msg,
                                total_correct: data.total_correct,
                                total_testcases: data.total_testcases,
                            }, "*");
                        }
                    } catch (_) { }
                });
            }
            return response;
        });
    };

    console.log("[LC-Sound-Inject] XHR + Fetch interception active.");
})();
