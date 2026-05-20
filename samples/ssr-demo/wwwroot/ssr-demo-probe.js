(function () {
    const eventNames = [
        "enhancednavigationstart",
        "enhancednavigationend",
        "enhancedload"
    ];

    if (window.ssrDemoProbe && window.ssrDemoProbe.version === "1.0.0") {
        window.ssrDemoProbe.render();
        return;
    }

    const state = {
        startedAt: new Date(),
        events: [],
        listenersAttached: false,
        attachAttempts: 0
    };

    function getText(value) {
        if (value === undefined || value === null) {
            return "";
        }

        if (typeof value === "string") {
            return value;
        }

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    function summarizeEvent(evt) {
        if (!evt) {
            return {};
        }

        const summary = {
            type: evt.type || "",
            href: location.href
        };

        for (const key of ["url", "from", "to", "navigationType"]) {
            if (evt[key] !== undefined) {
                summary[key] = getText(evt[key]);
            }
        }

        if (evt.detail !== undefined) {
            summary.detail = getText(evt.detail);
        }

        return summary;
    }

    function render() {
        const status = document.getElementById("ssr-demo-probe-status");
        const blazorStatus = document.getElementById("ssr-demo-blazor-status");
        const lastEvent = document.getElementById("ssr-demo-last-event");
        const currentUrl = document.getElementById("ssr-demo-current-url");
        const log = document.getElementById("ssr-demo-event-log");

        if (status) {
            status.className = state.listenersAttached ? "badge text-bg-success ms-2" : "badge text-bg-warning ms-2";
            status.textContent = state.listenersAttached ? "Listening" : "Waiting for Blazor";
        }

        if (blazorStatus) {
            const hasBlazor = !!window.Blazor;
            const hasEvents = !!(window.Blazor && typeof window.Blazor.addEventListener === "function");
            blazorStatus.textContent = hasBlazor
                ? (hasEvents ? "window.Blazor.addEventListener available" : "window.Blazor exists without event facade")
                : "window.Blazor not found";
        }

        if (lastEvent) {
            lastEvent.textContent = state.events.length
                ? `${state.events[0].name} at ${state.events[0].time}`
                : "None yet";
        }

        if (currentUrl) {
            currentUrl.textContent = location.href;
        }

        if (log) {
            log.replaceChildren();

            if (!state.events.length) {
                const empty = document.createElement("li");
                empty.className = "text-secondary";
                empty.textContent = "No runtime events captured yet. Try navigating with the links below, or hard refresh this page to install the probe before enhanced navigation starts.";
                log.appendChild(empty);
                return;
            }

            for (const entry of state.events.slice(0, 50)) {
                const item = document.createElement("li");
                const label = document.createElement("span");
                label.className = "fw-semibold";
                label.textContent = `${entry.time} ${entry.name}`;

                const detail = document.createElement("span");
                detail.className = "text-secondary";
                detail.textContent = entry.detail ? ` ${entry.detail}` : "";

                item.append(label, detail);
                log.appendChild(item);
            }
        }
    }

    function log(name, detail) {
        const entry = {
            name,
            time: new Date().toLocaleTimeString(),
            detail: detail === undefined ? "" : getText(detail)
        };

        state.events.unshift(entry);
        render();
    }

    function attachBlazorListeners() {
        state.attachAttempts += 1;

        if (window.Blazor && typeof window.Blazor.addEventListener === "function") {
            if (!state.listenersAttached) {
                for (const eventName of eventNames) {
                    window.Blazor.addEventListener(eventName, evt => log(eventName, summarizeEvent(evt)));
                }

                state.listenersAttached = true;
                log("probe-listeners-attached", { events: eventNames });
            }

            render();
            return;
        }

        render();

        if (state.attachAttempts < 50) {
            window.setTimeout(attachBlazorListeners, 100);
        }
    }

    function clear() {
        state.events = [];
        render();
    }

    function incrementText(id) {
        const target = document.getElementById(id);
        if (!target) {
            return;
        }

        const current = Number.parseInt(target.textContent || "0", 10);
        target.textContent = Number.isFinite(current) ? String(current + 1) : "1";
        log("dom-mutated", { id, value: target.textContent });
    }

    function addNote(inputId, listId) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);

        if (!input || !list) {
            return;
        }

        const value = input.value.trim();

        if (!value) {
            return;
        }

        const item = document.createElement("li");
        item.textContent = value;
        list.appendChild(item);
        input.value = "";
        log("permanent-note-added", { value });
    }

    window.ssrDemoProbe = {
        version: "1.0.0",
        state,
        log,
        clear,
        render,
        incrementText,
        addNote
    };

    window.addEventListener("pageshow", evt => log("pageshow", { persisted: evt.persisted }));
    window.addEventListener("popstate", () => log("popstate", { href: location.href }));

    attachBlazorListeners();
    log("probe-loaded", { href: location.href });
})();
