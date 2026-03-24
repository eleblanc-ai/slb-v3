/**
 * Markdown Import — parse #Field Name sections from uploaded files
 * and map them to lesson template field values.
 */

import { lookupStandardByCode } from '../lib/standardsMapper';

// Field types that cannot be imported from plain text
const SKIP_TYPES = new Set([
  'section_header',
  'image',
  'mcqs',
  'vocabulary_words',
]);

/**
 * Parse a markdown string with `#Field Name` headers into a map.
 * Returns { "Field Name": "raw value string", ... }
 */
export function parseMarkdownImport(markdownText) {
  const result = {};
  if (!markdownText) return result;

  // Split on lines that start with # (single hash only, not ##)
  const sections = markdownText.split(/^#(?!#)/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const newlineIndex = section.indexOf('\n');
    if (newlineIndex === -1) {
      // Header with no content
      const name = section.trim();
      if (name) result[name] = '';
      continue;
    }

    const name = section.substring(0, newlineIndex).trim();
    const value = section.substring(newlineIndex + 1).trim();
    if (name) {
      result[name] = value;
    }
  }

  return result;
}

/**
 * Generate a downloadable format template for a given template's fields.
 * Shows all importable field names as #headers with placeholder hints.
 */
export function generateFormatTemplate(fields, templateName) {
  let template = `# Format Template: ${templateName}\n`;
  template += `# Delete this header section before importing.\n`;
  template += `# Fill in values below each #Field Name header.\n`;
  template += `# Leave sections empty to skip them.\n\n`;

  for (const field of fields) {
    if (!field.importable) continue;
    if (SKIP_TYPES.has(field.type)) continue;

    template += `#${field.name}\n`;

    // Add a hint based on field type
    switch (field.type) {
      case 'checklist':
        template += `[One item per line]\n`;
        break;
      case 'assign_standards':
        template += `[Standard codes separated by semicolons, e.g. CCSS.ELA.6.R.1.2; CCSS.ELA.6.R.1.3]\n`;
        break;
      case 'rich_text':
        template += `[Enter text or HTML content]\n`;
        break;
      case 'dropdown':
      case 'grade_band_selector':
      case 'theme_selector':
        template += `[Enter the exact option value]\n`;
        break;
      default:
        template += `[Enter value]\n`;
    }
    template += '\n';
  }

  return template;
}

/**
 * Convert parsed markdown data into a fieldId→value map, doing
 * type-aware conversion for each field.
 *
 * @param {Object} parsedData  — from parseMarkdownImport()
 * @param {Array}  fields      — full field list with id, name, type
 * @returns {{ values: Object, count: number }}
 */
export async function applyImportToFields(parsedData, fields) {
  const values = {};
  let count = 0;

  for (const field of fields) {
    if (!field.importable) continue;
    if (SKIP_TYPES.has(field.type)) continue;

    const raw = parsedData[field.name];
    if (raw === undefined || raw === '') continue;

    let converted;

    switch (field.type) {
      case 'text':
      case 'long_text':
        converted = raw;
        break;

      case 'rich_text':
        // Wrap in <p> tags if plain text (no HTML tags)
        if (/<[^>]+>/.test(raw)) {
          converted = raw;
        } else {
          converted = raw
            .split('\n\n')
            .filter(p => p.trim())
            .map(p => `<p>${p.split('\n').join('<br>')}</p>`)
            .join('');
        }
        break;

      case 'dropdown':
      case 'grade_band_selector':
      case 'theme_selector':
        converted = raw;
        break;

      case 'checklist':
        converted = raw
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean);
        break;

      case 'assign_standards': {
        // Split by semicolons or newlines
        const codes = raw
          .split(/[;\n]/)
          .map(code => code.trim())
          .filter(Boolean);
        converted = await Promise.all(
          codes.map(code => lookupStandardByCode(code))
        );
        break;
      }

      default:
        converted = raw;
    }

    values[field.id] = converted;
    count++;
  }

  return { values, count };
}
