/**
 * Seed process: validate the curriculum, build a normalized seed bundle, and
 * write it to db/seed/. Aborts before writing anything if validation fails
 * (CLAUDE.md: "Validate the JSON against the schema before seeding a database").
 *
 *   npm run seed:curriculum
 *
 * The output is a set of JSON files that mirror db/curriculum-schema.sql. A real
 * database seed would insert these rows; keeping them as files makes the process
 * reviewable and works without a live database.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadCurriculum, loadCurriculumRaw } from "../src/curriculum/loader";
import { buildSeedBundle } from "../src/curriculum/seed";
import { validateCurriculum } from "../src/curriculum/validate";

function outDir(): string {
  return fileURLToPath(new URL("../db/seed/", import.meta.url));
}

function main(): void {
  const raw = loadCurriculumRaw();
  const result = validateCurriculum(raw);
  if (!result.valid) {
    console.error("✗ Refusing to seed: curriculum failed schema validation.");
    for (const error of result.errors.slice(0, 20)) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const bundle = buildSeedBundle(loadCurriculum());
  const dir = outDir();
  mkdirSync(dir, { recursive: true });

  const tables: Array<[string, unknown]> = [
    ["courses", [bundle.course]],
    ["sections", bundle.sections],
    ["units", bundle.units],
    ["vocabulary_items", bundle.vocabulary_items],
    ["phrase_patterns", bundle.phrase_patterns],
    ["lessons", bundle.lessons],
    ["generated_exercises", bundle.exercises],
  ];

  for (const [name, rows] of tables) {
    writeFileSync(`${dir}${name}.json`, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  }

  console.log("✓ Seed bundle written to db/seed/");
  console.log(`  sections: ${bundle.sections.length}`);
  console.log(`  units: ${bundle.units.length}`);
  console.log(`  vocabulary_items: ${bundle.vocabulary_items.length}`);
  console.log(`  phrase_patterns: ${bundle.phrase_patterns.length}`);
  console.log(`  lessons: ${bundle.lessons.length}`);
  console.log(`  generated_exercises: ${bundle.exercises.length}`);
}

main();
