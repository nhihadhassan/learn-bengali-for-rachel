/**
 * Generates `content/course-index.json` — the lightweight navigation outline
 * for every registered course (units, lesson titles, counts, sections) with no
 * phrases, exercises or audio.
 *
 * Why: the full curriculum content is 1.7MB, dominated by the Spanish pack, and
 * anything that imports `@/lib/content` from a client component ships all of it
 * to the browser. Navigation only needs titles and ids, so it reads this index
 * instead.
 *
 *   npm run build:course-index      # regenerate after changing content
 *   npm run test:course-index       # fails if the committed index is stale
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCourseIndex, courseIndexPath } from "./course-index-source";

const index = buildCourseIndex();
const target = join(process.cwd(), courseIndexPath);

writeFileSync(target, `${JSON.stringify(index, null, 2)}\n`, "utf8");

const summary = Object.values(index.courses)
  .map((course) => `${course.id}: ${course.unitCount}u/${course.lessonCount}l`)
  .join(", ");

console.log(`Wrote ${courseIndexPath} (${summary})`);
