const $ = (id) => document.getElementById(id);
const E = MeetingExports;
let offers = [],
  busy = false,
  run = null,
  plan = null,
  originalPlan = null,
  runInput = null,
  timer = null;
const today = new Date();
$("meeting-date").value =
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function showError(error) {
  $("error").hidden = false;
  $("error-title").textContent =
    error.message || "The request could not finish.";
  $("error-action").textContent =
    error.action || "Check your connection and try again.";
  $("limits").replaceChildren();
  $("limits").hidden = error.code !== "spend_limit_reached";
  if (!$("limits").hidden) {
    [
      ["Limit", "limit_usd"],
      ["Spent", "spent_usd"],
      ["Temporary hold", "held_usd"],
    ].forEach(([label, key]) => {
      const group = element("div");
      group.append(
        element("dt", label),
        element("dd", `$${Number(error.details?.[key] || 0).toFixed(2)}`),
      );
      $("limits").append(group);
    });
  }
}
function chosen() {
  return offers.find((offer) => offer.id === $("offer").value) || offers[0];
}
function updateConnection() {
  const offer = chosen();
  $("offer-detail").textContent = offer
    ? `${offer.model} via ${offer.provider} · peer ${offer.peer.slice(0, 10)}… · score ${offer.reputation} · advertised $0 input / output`
    : "Start an Antseed buyer or gateway to run live. A saved run can be viewed offline.";
  $("extract").disabled = busy || !offers.length;
  $("offer").disabled = busy || !offers.length;
}
async function refresh() {
  const previous = $("offer").value;
  $("refresh").disabled = true;
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message || "Connection unavailable.");
    offers = data.offers;
    $("offer").replaceChildren(new Option("Automatic free selection", ""));
    offers.forEach((offer) =>
      $("offer").add(
        new Option(`${offer.model} · ${offer.provider} · $0`, offer.id),
      ),
    );
    if (offers.some((offer) => offer.id === previous))
      $("offer").value = previous;
    $("connection-label").textContent = offers.length
      ? "Free Antseed route ready · show model details"
      : "No eligible free route · show connection details";
  } catch (error) {
    offers = [];
    $("connection-label").textContent =
      "Live connection unavailable · show setup details";
  } finally {
    $("refresh").disabled = busy;
    updateConnection();
  }
}
function setBusy(value) {
  busy = value;
  ["sample", "recorded", "refresh", "file", "meeting-date"].forEach(
    (id) => ($(id).disabled = value),
  );
  $("notes").readOnly = value;
  updateConnection();
}
function editedNotes() {
  $("count").textContent = `${$("notes").value.length} / 12000`;
  $("results").hidden = true;
  $("error").hidden = true;
}
function clearSession() {
  run = null;
  plan = null;
  originalPlan = null;
  $("results").hidden = true;
  $("error").hidden = true;
  $("progress").hidden = true;
}
function status(task) {
  if (!task.title?.trim()) return "Add the task wording before including it.";
  if (!E.assigned(task.owner))
    return "Owner missing — assign someone before including this task.";
  if (task.confirmed)
    return task.user_edited
      ? "Included in your handoff · edited by you."
      : "Included in your handoff.";
  if (!task.due_date)
    return task.due_text
      ? `Date to confirm: “${task.due_text}”. Choose a date, or include without one.`
      : "No deadline in the notes. Choose a date, or include without one.";
  return "Owner and date available — check the quote, then include.";
}
function rowStatus(task, row) {
  row.querySelector(".task-status").textContent = status(task);
  row.querySelector(".task-status").classList.toggle("ready", !!task.confirmed);
  const check = row.querySelector("input[type=checkbox]");
  check.disabled = !E.assigned(task.owner) || !task.title?.trim();
  check.checked = !!task.confirmed;
}
function updateOutputs() {
  if (!plan) return;
  const confirmed = E.confirmed(plan.tasks),
    dated = confirmed.filter((task) => E.validDate(task.due_date));
  const stats = [
    [plan.tasks.length, "tasks found"],
    [
      plan.tasks.filter((task) => !E.assigned(task.owner)).length,
      "missing owner",
    ],
    [plan.tasks.filter((task) => !task.due_date).length, "date to review"],
    [confirmed.length, "included"],
  ];
  $("stats").replaceChildren(
    ...stats.map(([value, label]) => {
      const item = element("span");
      item.append(
        element("strong", String(value)),
        document.createTextNode(label),
      );
      return item;
    }),
  );
  $("export-status").textContent = confirmed.length
    ? `${confirmed.length} included task${confirmed.length === 1 ? "" : "s"} · ${dated.length} with dates for your calendar.`
    : "Confirm at least one task with an owner to create your handoff.";
  $("csv").disabled = !confirmed.length;
  $("draft-download").disabled = !confirmed.length;
  $("copy").disabled = !confirmed.length;
  $("calendar").disabled = !dated.length;
  $("followup").value = E.followup(plan);
  $("raw").textContent = JSON.stringify(run, null, 2);
  $("copy-status").textContent = "";
}
function renderTasks() {
  $("tasks").replaceChildren();
  $("empty-tasks").hidden = !!plan.tasks.length;
  plan.tasks.forEach((task, index) => {
    const row = element("article", undefined, "task");
    const fields = element("div", undefined, "task-head");
    [
      ["title", "Task", task.title],
      ["owner", "Owner", task.owner || ""],
      ["due_date", "Date", task.due_date || ""],
    ].forEach(([key, label, value]) => {
      const wrap = element("label", label);
      const input = key === "title" ? element("textarea") : element("input");
      if (key === "title") {
        input.rows = 2;
        input.className = "task-title";
        input.maxLength = 300;
      } else {
        input.type = key === "due_date" ? "date" : "text";
        if (key === "owner") {
          input.placeholder = "Unassigned";
          input.maxLength = 80;
        }
      }
      input.value = value;
      input.setAttribute("aria-label", `${label} for task ${index + 1}`);
      input.addEventListener("input", () => {
        task[key] =
          key === "title" ? input.value.trim() : input.value.trim() || null;
        task.user_edited = true;
        task.confirmed = false;
        rowStatus(task, row);
        updateOutputs();
      });
      wrap.append(input);
      fields.append(wrap);
    });
    const include = element("label", undefined, "include");
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("aria-label", `Include task ${index + 1}`);
    checkbox.addEventListener("change", () => {
      task.confirmed = checkbox.checked;
      rowStatus(task, row);
      updateOutputs();
    });
    include.append(checkbox, document.createTextNode("Include"));
    fields.append(include);
    row.append(fields, element("p", undefined, "task-status"));
    const source = element("details");
    source.append(
      element("summary", "Show source note"),
      element("blockquote", task.source, "source"),
    );
    if (task.flags?.length) source.append(element("p", task.flags.join(" ")));
    row.append(source);
    rowStatus(task, row);
    $("tasks").append(row);
  });
}
function renderContext(id, items, empty) {
  $(id).replaceChildren();
  if (!items.length) {
    $(id).append(element("p", empty, "empty"));
    return;
  }
  items.forEach((item) => {
    const block = element("article", undefined, "context-item");
    block.append(element("p", item.text));
    const details = element("details");
    details.append(
      element("summary", "Source note"),
      element("blockquote", item.source, "source"),
    );
    block.append(details);
    $(id).append(block);
  });
}
function render() {
  plan = structuredClone(run.plan);
  originalPlan = structuredClone(run.plan);
  plan.tasks.forEach((task) => (task.title = E.taskTitle(task)));
  $("results").hidden = false;
  $("recorded-banner").hidden = run.mode !== "recorded";
  $("plan-title").textContent = plan.title;
  $("warnings").hidden = !plan.warnings?.length;
  $("warnings").textContent = (plan.warnings || []).join(" ");
  renderTasks();
  renderContext(
    "decisions",
    plan.decisions,
    "No explicit decisions were recorded.",
  );
  renderContext(
    "questions",
    plan.open_questions,
    "No open questions were extracted; check for missing details.",
  );
  $("request-meta").textContent =
    `${run.mode === "recorded" ? "Recorded" : "Live"} · ${run.offer.model} via ${run.offer.provider} · ${run.response.seconds}s · response peer ${run.response.peer}${run.response.usage?.total_tokens ? " · " + run.response.usage.total_tokens + " tokens" : ""}`;
  updateOutputs();
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = element("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("notes").addEventListener("input", editedNotes);
$("meeting-date").addEventListener("change", () => {
  $("results").hidden = true;
});
$("offer").addEventListener("change", updateConnection);
$("refresh").addEventListener("click", refresh);
$("sample").addEventListener("click", async () => {
  try {
    const response = await fetch("/sample-notes.txt");
    $("notes").value = await response.text();
    $("meeting-date").value = "2026-11-02";
    clearSession();
    editedNotes();
  } catch (error) {
    showError({ message: "The sample notes could not be loaded." });
  }
});
$("file").addEventListener("change", async () => {
  const file = $("file").files[0];
  if (!file) return;
  if (file.size > 60_000 || !/(\.txt|\.md)$/i.test(file.name)) {
    showError({ message: "Choose a .txt or .md file under 60 KB." });
    $("file").value = "";
    return;
  }
  const text = await file.text();
  if (text.length > 12000) {
    showError({ message: "Use up to 12,000 characters from one meeting." });
    return;
  }
  $("notes").value = text;
  clearSession();
  editedNotes();
});
$("extract").addEventListener("click", async () => {
  const notes = $("notes").value.trim(),
    meetingDate = $("meeting-date").value;
  if (notes.length < 40 || notes.length > 12000 || !E.validDate(meetingDate)) {
    showError({
      message:
        "Add meeting notes (40–12,000 characters) and a valid meeting date.",
    });
    return;
  }
  clearSession();
  runInput = { notes, meeting_date: meetingDate };
  setBusy(true);
  $("progress").hidden = false;
  const start = Date.now();
  $("progress-text").textContent =
    "Finding actions, decisions and missing details…";
  $("elapsed").textContent = "0s";
  timer = setInterval(() => {
    const seconds = Math.floor((Date.now() - start) / 1000);
    $("elapsed").textContent = seconds + "s";
    if (seconds > 20)
      $("progress-text").textContent =
        "Still waiting for the free provider. Availability can vary…";
  }, 1000);
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...runInput, offer: $("offer").value || null }),
    });
    const data = await response.json();
    if (!response.ok) throw { publicError: data.error };
    run = data;
    render();
  } catch (error) {
    showError(
      error.publicError || {
        message: "The connection ended before a plan was ready.",
        action: "Try another free offer, or view the recorded run.",
      },
    );
  } finally {
    clearInterval(timer);
    $("progress").hidden = true;
    setBusy(false);
  }
});
$("recorded").addEventListener("click", async () => {
  try {
    const response = await fetch("/api/demo");
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message || "Recorded run unavailable.");
    clearSession();
    run = data.result;
    runInput = data.input;
    $("notes").value = runInput.notes;
    $("meeting-date").value = runInput.meeting_date;
    $("count").textContent = `${runInput.notes.length} / 12000`;
    render();
  } catch (error) {
    showError({
      message: error.message,
      action: "Use the sample meeting for a live run.",
    });
  }
});
$("confirm-ready").addEventListener("click", () => {
  plan.tasks.forEach((task) => {
    if (
      E.assigned(task.owner) &&
      task.title?.trim() &&
      E.validDate(task.due_date)
    )
      task.confirmed = true;
  });
  document
    .querySelectorAll(".task")
    .forEach((row, index) => rowStatus(plan.tasks[index], row));
  updateOutputs();
});
$("new-meeting").addEventListener("click", () => {
  clearSession();
  $("notes").value = "";
  $("file").value = "";
  editedNotes();
  $("notes").focus();
});
$("csv").addEventListener("click", () =>
  download("meeting-tasks.csv", E.csv(plan.tasks), "text/csv;charset=utf-8"),
);
$("calendar").addEventListener("click", () =>
  download(
    "meeting-tasks.ics",
    E.calendar(plan.tasks),
    "text/calendar;charset=utf-8",
  ),
);
$("draft-download").addEventListener("click", () =>
  download(
    "meeting-follow-up.txt",
    E.followup(plan),
    "text/plain;charset=utf-8",
  ),
);
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("followup").value);
    $("copy-status").textContent = "Copied. Review it before sending.";
  } catch (error) {
    $("followup").focus();
    $("followup").select();
    $("copy-status").textContent = "Select and copy the draft above.";
  }
});
$("save-json").addEventListener("click", () =>
  download(
    "meeting-actions-run.json",
    JSON.stringify(
      {
        input: runInput,
        result: { ...run, plan: originalPlan },
        reviewed_plan: plan,
      },
      null,
      2,
    ),
    "application/json",
  ),
);
refresh();
