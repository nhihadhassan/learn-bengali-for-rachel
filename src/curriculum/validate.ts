import { loadBengaliSchema, loadCurriculumSchema, loadPilotSchema } from "./loader";
import type { ValidationResult } from "./types";

// A small, dependency-free JSON Schema validator covering exactly the subset the
// curriculum schema uses: type (object/array/string/integer/number/boolean),
// required, properties, items, $ref -> #/$defs, minimum. Enough to satisfy the
// CLAUDE.md rule "validate before seeding" without pulling in a full validator.

type Schema = Record<string, unknown>;

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function resolveRef(root: Schema, ref: string): Schema | null {
  // Only local pointers like "#/$defs/unit" are supported.
  if (!ref.startsWith("#/")) {
    return null;
  }
  const segments = ref.slice(2).split("/");
  let node: unknown = root;
  for (const segment of segments) {
    if (typeof node !== "object" || node === null) {
      return null;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return (node as Schema) ?? null;
}

function checkType(value: unknown, type: string): boolean {
  switch (type) {
    case "object":
      return typeName(value) === "object";
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}

function validateNode(
  value: unknown,
  schema: Schema,
  path: string,
  root: Schema,
  errors: string[],
): void {
  const ref = schema["$ref"];
  if (typeof ref === "string") {
    const resolved = resolveRef(root, ref);
    if (!resolved) {
      errors.push(`${path}: could not resolve $ref "${ref}"`);
      return;
    }
    validateNode(value, resolved, path, root, errors);
    return;
  }

  const type = schema["type"];
  if (typeof type === "string" && !checkType(value, type)) {
    errors.push(`${path}: expected ${type}, got ${typeName(value)}`);
    return;
  }

  if (type === "object" || typeName(value) === "object") {
    const object = value as Record<string, unknown>;

    const required = schema["required"];
    if (Array.isArray(required)) {
      for (const key of required) {
        if (typeof key === "string" && !(key in object)) {
          errors.push(`${path}: missing required property "${key}"`);
        }
      }
    }

    const properties = schema["properties"];
    if (properties && typeof properties === "object") {
      for (const [key, propSchema] of Object.entries(properties as Schema)) {
        if (key in object) {
          validateNode(
            object[key],
            propSchema as Schema,
            path ? `${path}.${key}` : key,
            root,
            errors,
          );
        }
      }
    }
  }

  if (type === "array" && Array.isArray(value)) {
    const items = schema["items"];
    if (items && typeof items === "object") {
      value.forEach((element, index) => {
        validateNode(element, items as Schema, `${path}[${index}]`, root, errors);
      });
    }
  }

  const minimum = schema["minimum"];
  if (typeof minimum === "number" && typeof value === "number" && value < minimum) {
    errors.push(`${path}: ${value} is below minimum ${minimum}`);
  }
}

/** Validate arbitrary data against a JSON Schema (subset). */
export function validateAgainstSchema(data: unknown, schema: Schema): ValidationResult {
  const errors: string[] = [];
  validateNode(data, schema, "", schema, errors);
  return { valid: errors.length === 0, errors };
}

/** Validate the curriculum pack against its shipped schema. */
export function validateCurriculum(data: unknown): ValidationResult {
  return validateAgainstSchema(data, loadCurriculumSchema());
}

/** Validate the pilot pack (Spanish Curriculum v2) against its own schema. */
export function validatePilot(data: unknown): ValidationResult {
  return validateAgainstSchema(data, loadPilotSchema());
}

/** Validate the Bengali pack (Bengali Curriculum v2) against its own schema. */
export function validateBengali(data: unknown): ValidationResult {
  return validateAgainstSchema(data, loadBengaliSchema());
}
