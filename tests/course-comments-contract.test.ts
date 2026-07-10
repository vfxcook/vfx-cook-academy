import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const commentsApi = readFileSync("src/app/api/comments/route.ts", "utf8");
const player = readFileSync("src/components/ClassroomPlayer.tsx", "utf8");
const coursePage = readFileSync("src/app/course/[slug]/page.tsx", "utf8");

test("lesson comments support replies and likes in the data contract", () => {
  assert.match(schema, /parentId\s+String\?/);
  assert.match(schema, /replies\s+TimestampComment\[\]\s+@relation\("TimestampCommentReplies"\)/);
  assert.match(schema, /model TimestampCommentLike/);
  assert.match(schema, /@@unique\(\[commentId, userId\]\)/);
});

test("lesson comments expose reply, like, and owner delete API surfaces", () => {
  assert.match(commentsApi, /parentId/);
  assert.ok(existsSync("src/app/api/comments/[id]/like/route.ts"));
  assert.ok(existsSync("src/app/api/comments/[id]/route.ts"));
});

test("course player renders comment moderation actions", () => {
  assert.match(player, /replyDrafts/);
  assert.match(player, /likeLessonComment/);
  assert.match(player, /deleteLessonComment/);
  assert.match(player, /Reply/);
  assert.match(player, /Delete/);
  assert.match(coursePage, /parentId/);
  assert.match(coursePage, /likes/);
  assert.match(coursePage, /replies/);
});
