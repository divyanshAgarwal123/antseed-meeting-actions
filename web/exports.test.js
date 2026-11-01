const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("./exports.js");
const task = {
  title: "Check the room",
  owner: "Asha",
  due_date: "2026-11-05",
  source: "Asha will check the room by 2026-11-05.",
  confirmed: true,
};
test("only reviewed, assigned tasks enter exports", () => {
  const rows = [
    task,
    { ...task, title: "Do not export this", confirmed: false },
    { ...task, owner: null },
    { ...task, owner: "TBD" },
  ];
  assert.equal(E.confirmed(rows).length, 1);
  assert(!E.csv(rows).includes("Do not export this"));
});
test("CSV quotes fields and neutralizes spreadsheet formulas", () => {
  const csv = E.csv([{ ...task, title: '=HYPERLINK("x")\nsecond line' }]);
  assert(csv.includes("'="));
  assert(csv.includes('""x""'));
  assert(csv.includes("\nsecond line"));
});
test("calendar includes only dated confirmations and uses an exclusive end date", () => {
  const ics = E.calendar(
    [task, { ...task, title: "Undated", due_date: null }],
    "2026-11-02T12:00:00Z",
  );
  assert(ics.includes("DTSTART;VALUE=DATE:20261105"));
  assert(ics.includes("DTEND;VALUE=DATE:20261106"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert(!ics.includes("Undated"));
});
test("invalid calendar dates are excluded", () => {
  assert.equal(E.validDate("2026-02-30"), false);
  assert.equal(E.calendar([{ ...task, due_date: "2026-02-30" }]), "");
});
test("calendar escapes injected content and folds long Unicode lines", () => {
  const ics = E.calendar([
    { ...task, title: "Room\nBEGIN:VEVENT, test;", source: "é".repeat(140) },
  ]);
  assert(ics.includes("Room\\nBEGIN:VEVENT\\, test\\;"));
  assert.equal((ics.match(/^BEGIN:VEVENT$/gm) || []).length, 1);
  for (const line of ics.split("\r\n")) assert(Buffer.byteLength(line) <= 75);
});
test("draft includes only confirmed commitments and keeps missing owners visible", () => {
  const draft = E.followup({
    title: "Demo",
    meeting_date: "2026-11-02",
    tasks: [
      task,
      { ...task, title: "Do not commit this", confirmed: false },
      { ...task, title: "Confirm guest", owner: null, confirmed: false },
    ],
    decisions: [],
    open_questions: [],
  });
  assert(draft.includes("Asha: Check the room"));
  assert(!draft.includes("Do not commit this"));
  assert(draft.includes("Who will own: Confirm guest?"));
});

test("review titles drop stale status labels and repeated ISO deadlines, preserving vague dependencies", () => {
  assert.equal(
    E.taskTitle({ ...task, title: "Confirm guest (unassigned)" }),
    "Confirm guest",
  );
  assert.equal(
    E.taskTitle({ ...task, title: "Check the room by 2026-11-05" }),
    "Check the room",
  );
  assert.equal(
    E.taskTitle({ ...task, title: "Test before rehearsal", due_date: null }),
    "Test before rehearsal",
  );
});
