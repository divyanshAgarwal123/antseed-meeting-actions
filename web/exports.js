/* Exports are built locally from tasks the user has confirmed. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MeetingExports = factory();
})(typeof globalThis === "object" ? globalThis : this, function () {
  function assigned(owner) {
    return (
      typeof owner === "string" &&
      !!owner.trim() &&
      !["unassigned", "unknown", "tbd", "someone", "nobody"].includes(
        owner.trim().toLowerCase(),
      )
    );
  }
  function confirmed(tasks) {
    return tasks.filter(
      (t) => t.confirmed && String(t.title || "").trim() && assigned(t.owner),
    );
  }
  function validDate(value) {
    return (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
    );
  }
  function taskTitle(task) {
    let title = String(task.title || "").replace(
      /\s*\((?:unassigned|tbd|owner unknown)\)\s*$/i,
      "",
    );
    if (validDate(task.due_date)) {
      const phrase = new RegExp(
        "\\s+(?:by|on|due(?:\\s+on)?)\\s+" + task.due_date + "(?=[\\s.,;]|$)",
        "i",
      );
      title = title.replace(phrase, "");
    }
    return title.trim();
  }
  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function csv(tasks) {
    return (
      [
        ["Task", "Owner", "Due date", "Source note"],
        ...confirmed(tasks).map((t) => [
          t.title,
          t.owner,
          t.due_date || "",
          t.source || "",
        ]),
      ]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n") + "\r\n"
    );
  }
  function escapeICS(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }
  function fold(line) {
    let output = "",
      current = "",
      bytes = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (bytes + size > 75) {
        output += current + "\r\n";
        current = " ";
        bytes = 1;
      }
      current += char;
      bytes += size;
    }
    return output + current;
  }
  function uid(text) {
    let value = 2166136261;
    for (const char of text) {
      value ^= char.codePointAt(0);
      value = Math.imul(value, 16777619);
    }
    return (value >>> 0).toString(16) + "@meeting-actions.local";
  }
  function calendar(tasks, stamp = new Date().toISOString()) {
    const dated = confirmed(tasks).filter((t) => validDate(t.due_date));
    if (!dated.length) return "";
    const dtstamp =
      new Date(stamp).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Meeting Actions//Antseed demo//EN",
      "CALSCALE:GREGORIAN",
    ];
    dated.forEach((t) => {
      const end = new Date(t.due_date + "T00:00:00Z");
      end.setUTCDate(end.getUTCDate() + 1);
      lines.push(
        "BEGIN:VEVENT",
        "UID:" + uid(t.title + "|" + t.owner + "|" + t.due_date),
        "DTSTAMP:" + dtstamp,
        "DTSTART;VALUE=DATE:" + t.due_date.replace(/-/g, ""),
        "DTEND;VALUE=DATE:" + end.toISOString().slice(0, 10).replace(/-/g, ""),
        "SUMMARY:" + escapeICS(t.title + " — " + t.owner),
        "DESCRIPTION:" +
          escapeICS("Owner: " + t.owner + "\nSource note: " + (t.source || "")),
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }
  function followup(plan) {
    const tasks = confirmed(plan.tasks);
    if (!tasks.length) return "";
    const lines = [
      "Hi everyone,",
      "",
      `Here are the reviewed actions from ${plan.title} (${plan.meeting_date}):`,
      "",
    ];
    tasks.forEach((t) =>
      lines.push(
        `- ${t.owner}: ${t.title} — ${t.due_date ? "due " + t.due_date : "date not agreed"}.`,
      ),
    );
    if (plan.decisions.length) {
      lines.push("", "Decisions and constraints recorded in the notes:");
      plan.decisions.forEach((d) => lines.push("- " + d.text));
    }
    const questions = [
      ...plan.open_questions.map((q) => q.text),
      ...plan.tasks
        .filter((t) => !assigned(t.owner))
        .map((t) => "Who will own: " + t.title + "?"),
    ];
    if (questions.length) {
      lines.push("", "Still to confirm:");
      [...new Set(questions)].forEach((q) => lines.push("- " + q));
    }
    lines.push(
      "",
      "Please reply if any owner, date or commitment needs correcting.",
    );
    return lines.join("\n");
  }
  return { assigned, confirmed, validDate, taskTitle, csv, calendar, followup };
});
