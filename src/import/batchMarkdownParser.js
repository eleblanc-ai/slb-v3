/**
 * Batch Markdown Parser — split a multi-lesson .md file on `---` separators,
 * extract `#Template Name` from each section, and return structured data.
 */

import { parseMarkdownImport } from './markdownImporter';

const MAX_LESSONS = 5;

/**
 * Parse a batch markdown file containing multiple lessons separated by `---`.
 *
 * @param {string} markdownText - Full contents of the uploaded .md file
 * @returns {{
 *   lessons: Array<{ templateName: string, parsedFields: Object, index: number }>,
 *   errors: Array<{ index: number, message: string }>
 * }}
 */
export function parseBatchMarkdown(markdownText) {
  if (!markdownText || !markdownText.trim()) {
    return { lessons: [], errors: [{ index: 0, message: 'Empty file' }] };
  }

  // Split on horizontal rules (3+ dashes on their own line)
  const sections = markdownText.split(/^-{3,}\s*$/m);

  const lessons = [];
  const errors = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue; // Skip empty sections (trailing --- etc.)

    const parsedFields = parseMarkdownImport(section);
    const templateName = parsedFields['Template Name'];
    delete parsedFields['Template Name'];

    if (!templateName) {
      errors.push({
        index: i,
        message: `Lesson section ${lessons.length + 1} is missing a #Template Name header`,
      });
      continue;
    }

    lessons.push({
      templateName: templateName.trim(),
      parsedFields,
      index: i,
    });
  }

  if (lessons.length > MAX_LESSONS) {
    errors.push({
      index: -1,
      message: `File contains ${lessons.length} lessons. Maximum is ${MAX_LESSONS}.`,
    });
    lessons.length = MAX_LESSONS;
  }

  if (lessons.length === 0 && errors.length === 0) {
    errors.push({ index: 0, message: 'No lesson sections found in file' });
  }

  return { lessons, errors };
}
