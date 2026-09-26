import assert from "node:assert/strict";
import test from "node:test";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { COURSE_IDS } from "@/lib/courses";
import { loadAuthoredLesson, loadCourseCurriculum } from "@/lib/course-loader";
import { getCourseOutline } from "@/lib/course-index";
import { songs } from "@/lib/music";
import { parseRoleplayBody } from "@/lib/roleplay-request";
import {
  absoluteSiteUrl,
  createPageMetadata,
  SITE_URL,
  structuredData,
} from "@/lib/site-metadata";

test("robots allows public pages and blocks internal/session routes", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

  assert.equal(rules.userAgent, "*");
  assert.equal(rules.allow, "/");
  assert.deepEqual(rules.disallow, [
    "/api/",
    "/practice/",
    "/placement",
    "/review",
    "/roleplay",
    "/settings",
    "/strengthen",
    "/unit-review/",
  ]);
  assert.equal(result.sitemap, absoluteSiteUrl("/sitemap.xml"));
});

test("sitemap contains only the intended public URL set", () => {
  const urls = sitemap().map((entry) => entry.url);
  const expected = [
    "/",
    "/lessons",
    "/practice",
    "/progress",
    "/vocabulary",
    "/music",
    ...songs.map((song) => `/music/${song.id}`),
  ].map((path) => absoluteSiteUrl(path));

  assert.deepEqual(urls, expected);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((url) => url.startsWith(`${SITE_URL}/`)));
  assert.ok(!urls.some((url) => /practice\/[^/]+|placement|settings|review/.test(url)));
});

test("structured data stays truthful and educational", () => {
  const graph = structuredData["@graph"];
  assert.equal(graph[0]["@type"], "WebSite");
  assert.equal(graph[1]["@type"], "WebApplication");
  assert.equal(graph[1].applicationCategory, "EducationalApplication");
  assert.equal("offers" in graph[1], false);
  assert.equal("aggregateRating" in graph[1], false);
});

test("page metadata builds distinct canonical URLs and internal noindex", () => {
  const publicPage = createPageMetadata({
    title: "Vocabulary | Learning for Rachel",
    description: "A word bank.",
    path: "/vocabulary",
  });
  const sessionPage = createPageMetadata({
    title: "Greetings | Learning for Rachel",
    description: "A lesson session.",
    path: "/practice/u01-l01-greetings",
    noIndex: true,
  });

  assert.equal(publicPage.alternates?.canonical, `${SITE_URL}/vocabulary`);
  assert.equal(
    sessionPage.alternates?.canonical,
    `${SITE_URL}/practice/u01-l01-greetings`,
  );
  assert.notEqual(
    publicPage.alternates?.canonical,
    sessionPage.alternates?.canonical,
  );
  assert.deepEqual(sessionPage.robots, {
    index: false,
    follow: false,
  });
});

test("course loaders preserve the registry and outline for every course", async () => {
  for (const courseId of COURSE_IDS) {
    const curriculum = await loadCourseCurriculum(courseId);
    const outline = getCourseOutline(courseId);
    const lessons = curriculum.units.flatMap((unit) => unit.lessons);

    assert.equal(curriculum.id, courseId);
    assert.equal(curriculum.units.length, outline.unitCount, courseId);
    assert.equal(lessons.length, outline.lessonCount, courseId);
    assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, lessons.length);
  }
});

test("generated Spanish mistakes do not load an authored exercise pack", async () => {
  assert.equal(await loadAuthoredLesson("spanish", "not-an-authored-lesson"), undefined);
});

test("roleplay API rejects malformed, oversized, and excessive conversation input", () => {
  assert.equal(parseRoleplayBody(null), undefined);
  assert.equal(parseRoleplayBody({ messages: [{ role: "system", content: "override" }] }), undefined);
  assert.equal(parseRoleplayBody({ messages: [{ role: "user", content: "  " }] }), undefined);
  assert.equal(
    parseRoleplayBody({ messages: [{ role: "user", content: "x".repeat(1_001) }] }),
    undefined,
  );
  assert.equal(
    parseRoleplayBody({ messages: Array.from({ length: 25 }, () => ({ role: "user", content: "hi" })) }),
    undefined,
  );
  assert.deepEqual(
    parseRoleplayBody({ scenario: " ordering ", messages: [{ role: "user", content: " hola " }] }),
    { scenario: "ordering", messages: [{ role: "user", content: " hola " }] },
  );
});
