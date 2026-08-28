import { generateMarkdown as generateAdditionalReadingPracticeMarkdown } from './templates/additionalreadingpracticeMarkdownExport';
import { generateMarkdown as generateAdditionalReadingPracticeFloridaMarkdown } from './templates/additionalreadingpracticefloridaMarkdownExport';
import { generateMarkdown as generateAdditionalReadingPracticeTexasMarkdown } from './templates/additionalreadingpracticetexasMarkdownExport';
import { generateMarkdown as generateNarrativeLessonFloridaMarkdown } from './templates/narrativelessonfloridaMarkdownExport';
import { generateMarkdown as generateAppliedLessonMarkdown } from './templates/appliedlessonMarkdownExport';
import { generateMarkdown as generateAppliedLessonFloridaMarkdown } from './templates/appliedlessonfloridaMarkdownExport';
import { generateMarkdown as generateAppliedLessonTexasMarkdown } from './templates/appliedlessontexasMarkdownExport';
import { generateMarkdown as generateAdditionalReadingPracticev2Markdown } from './templates/additionalreadingpracticev2MarkdownExport';
import { generateMarkdown as generateAshasAppliedLessonMarkdown } from './templates/ashasappliedlessonMarkdownExport';

/**
 * Template name -> markdown export function.
 *
 * Single source of truth. This used to be three separate object literals
 * inside CreateNewLesson.jsx (download, preview, and the read-only view for
 * locked lessons). They drifted: only one of the three knew about 'Applied
 * Lesson' or either of Asha's templates, so the same lesson exported fine from
 * one screen and failed from another.
 *
 * Keys must match lesson_templates.name in Supabase exactly, apostrophes
 * included.
 */
export const EXPORT_FUNCTIONS = {
  'Additional Reading Practice': generateAdditionalReadingPracticeMarkdown,
  'Additional Reading Practice (Florida)': generateAdditionalReadingPracticeFloridaMarkdown,
  'Additional Reading Practice (Texas)': generateAdditionalReadingPracticeTexasMarkdown,
  'Narrative Lesson (Florida)': generateNarrativeLessonFloridaMarkdown,
  'Applied Lesson': generateAppliedLessonMarkdown,
  'Applied Lesson (Florida)': generateAppliedLessonFloridaMarkdown,
  'Applied Lesson (Texas)': generateAppliedLessonTexasMarkdown,

  // Asha's Experiments. These use copies of the standard exports because the
  // templates are clones with identical field names and types, so they produce
  // identical markdown. If a standard export changes, change its copy too.
  "Asha's Additional Reading Practice": generateAdditionalReadingPracticev2Markdown,
  "Asha's Applied Lesson": generateAshasAppliedLessonMarkdown,
};

/**
 * Look up the export function for a template.
 * @param {string} templateName - lesson_templates.name
 * @returns {Function|undefined}
 */
export function getExportFunction(templateName) {
  return EXPORT_FUNCTIONS[templateName];
}
