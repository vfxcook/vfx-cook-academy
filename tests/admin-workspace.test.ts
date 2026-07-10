import assert from "node:assert/strict";
import test from "node:test";

import {
  adminCourseEditorTabs,
  adminCrmColumns,
  adminWorkspaceNav,
} from "../src/lib/admin-workspace";

test("admin workspace exposes professional operating sections", () => {
  assert.deepEqual(
    adminWorkspaceNav.map((item) => item.label),
    ["Overview", "Courses", "Students CRM", "Payments", "Lessons", "Prompts", "Community"],
  );
  assert.deepEqual(
    adminWorkspaceNav.map((item) => item.href),
    ["/admin", "/admin/courses", "/admin/students", "/admin/payments", "/admin/lessons", "/admin/prompts", "/admin/community"],
  );
});

test("course editor tabs separate content operations", () => {
  assert.deepEqual(
    adminCourseEditorTabs.map((item) => item.label),
    ["Basics", "Curriculum", "Resources", "Access", "Preview"],
  );
});

test("student CRM includes enrollment and commercial context", () => {
  assert.deepEqual(adminCrmColumns, [
    "Student",
    "Contact",
    "Courses",
    "Payment",
    "Progress",
    "Last Activity",
    "Actions",
  ]);
});
