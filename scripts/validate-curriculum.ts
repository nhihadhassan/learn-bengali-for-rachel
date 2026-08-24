/**
 * Validate both curriculum packs against their shipped JSON Schemas.
 * Exits non-zero on failure so it can gate the seed process and CI.
 *
 *   npm run validate:curriculum
 */
import { loadCurriculumRaw, loadPilotRaw } from "../src/curriculum/loader";
import { validateCurriculum, validatePilot } from "../src/curriculum/validate";
import type { ValidationResult } from "../src/curriculum/types";

function report(label: string, result: ValidationResult): boolean {
  if (result.valid) {
    return true;
  }

  console.error(`✗ ${label} failed schema validation:`);
  for (const error of result.errors.slice(0, 50)) {
    console.error(`  - ${error}`);
  }
  if (result.errors.length > 50) {
    console.error(`  ...and ${result.errors.length - 50} more.`);
  }

  return false;
}

function main(): void {
  const course = loadCurriculumRaw() as { units?: unknown[]; sections?: unknown[] };
  const pilot = loadPilotRaw() as { units?: unknown[] };

  const ok = [
    report("Curriculum", validateCurriculum(course)),
    report("Pilot", validatePilot(pilot)),
  ].every(Boolean);

  if (!ok) {
    process.exit(1);
  }

  console.log("✓ Both curriculum packs are valid against their schemas.");
  console.log(`  curriculum: ${course.sections?.length ?? 0} sections, ${course.units?.length ?? 0} units`);
  console.log(`  pilot:      ${pilot.units?.length ?? 0} units`);
}

main();
