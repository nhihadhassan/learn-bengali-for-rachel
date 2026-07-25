/**
 * Validate content/spanish-curriculum.json against its shipped JSON Schema.
 * Exits non-zero on failure so it can gate the seed process and CI.
 *
 *   npm run validate:curriculum
 */
import { loadCurriculumRaw } from "../src/curriculum/loader";
import { validateCurriculum } from "../src/curriculum/validate";

function main(): void {
  const data = loadCurriculumRaw();
  const result = validateCurriculum(data);

  if (result.valid) {
    const course = data as { units?: unknown[]; sections?: unknown[] };
    console.log("✓ Curriculum is valid against the schema.");
    console.log(`  sections: ${course.sections?.length ?? 0}, units: ${course.units?.length ?? 0}`);
    return;
  }

  console.error("✗ Curriculum failed schema validation:");
  for (const error of result.errors.slice(0, 50)) {
    console.error(`  - ${error}`);
  }
  if (result.errors.length > 50) {
    console.error(`  ...and ${result.errors.length - 50} more.`);
  }
  process.exit(1);
}

main();
