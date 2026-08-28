/**
 * Markdown Export for Asha's Applied Lesson
 *
 * Byte-for-byte identical logic to appliedlessonMarkdownExport.js. Asha's
 * template has the same 50 field names and types, so the two export the same
 * way by construction. Keep them in sync if either changes.
 */

export function generateMarkdown(templateData, fields, fieldValues) {
  let markdown = '';

  // Helper: find field value by name
  const getFieldValue = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    return fieldValues[field.id] || '';
  };

  // Helper: find the Nth field with duplicate names (0-indexed)
  const getNthFieldValue = (fieldName, n) => {
    const matches = fields.filter(f => f.name === fieldName);
    if (!matches[n]) return '';
    return fieldValues[matches[n].id] || '';
  };

  // Helper: get image URL
  const getImageUrl = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    const imageData = fieldValues[field.id];
    return imageData?.url || '';
  };

  // Helper: strip HTML to plain text
  const stripHtml = (value) => {
    if (typeof value !== 'string') return value || '';
    return value
      .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
  };

  // Helper: format standard codes from array of objects
  const getStandardCodes = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    const value = fieldValues[field.id];
    if (Array.isArray(value) && value.length > 0) {
      return value
        .map(item => {
          if (typeof item === 'object' && item !== null) {
            return item.fullCode || item.code || '';
          }
          return String(item);
        })
        .filter(Boolean)
        .join('; ');
    }
    return '';
  };

  // Helper: format MCQs
  const getMCQs = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    const value = fieldValues[field.id];
    if (value?.questions && Array.isArray(value.questions)) {
      return value.questions
        .filter(Boolean)
        .map(q => {
          if (typeof q === 'string') {
            return q
              .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<[^>]*>/g, '')
              .replace(/\n\s*\n+/g, '\n')
              .trim()
          }
          return q;
        })
        .join('\n\n');
    }
    return '';
  };

  // --- Designer metadata ---

  markdown += `#Content ID\n`;
  markdown += `${getFieldValue('Content ID')}\n\n`;

  markdown += `#Text set\n`;
  markdown += `${getFieldValue('Text Set')}\n\n`;

  markdown += `#Selection\n`;
  markdown += `${getFieldValue('Selection')}\n\n`;

  markdown += `#Theme\n`;
  markdown += `${getFieldValue('Theme')}\n\n`;

  markdown += `#Photo Link\n`;
  markdown += `${getImageUrl('Thumbnail Image')}\n\n`;

  markdown += `#Writing Prompt\n`;
  markdown += `${stripHtml(getFieldValue('Writing Prompt'))}\n\n`;

  markdown += `#Category\n`;
  markdown += `${getFieldValue('Category')}\n\n`;

  markdown += `#Genre\n`;
  markdown += `${getFieldValue('Genre')}\n\n`;

  markdown += `#Grade Band\n`;
  markdown += `${getFieldValue('Grade Level')}\n\n`;

  markdown += `#Lexile Level\n`;
  markdown += `${getFieldValue('Lexile Level')}\n\n`;

  markdown += `#Tags\n`;
  markdown += `${getFieldValue('Tags')}\n\n`;

  markdown += `#Subjects\n`;
  const subjects = getFieldValue('Subject(s)');
  if (Array.isArray(subjects) && subjects.length > 0) {
    subjects.forEach(subject => {
      const display = subject === 'English Language Arts' ? 'ELA' : subject;
      markdown += `${display}\n`;
    });
    markdown += '\n';
  } else {
    markdown += '\n';
  }

  markdown += `#Primary Standards\n`;
  markdown += `${getStandardCodes('Primary Standard(s)')}\n\n`;

  markdown += `#Primary Reading\n`;
  markdown += `${getStandardCodes('Primary Reading Standard(s)')}\n\n`;

  markdown += `#Primary Writing Standard\n`;
  markdown += `${getStandardCodes('Primary Writing Standard(s)')}\n\n`;

  markdown += `#Practiced Standards\n`;
  markdown += `${getStandardCodes('Practice Standard(s)')}\n\n`;

  markdown += `#Headline\n`;
  markdown += `${getFieldValue('Headline')}\n\n`;

  markdown += `#Passage\n`;
  const glossedPassage = getFieldValue('Glossed Passage');
  const cleanedPassage = typeof glossedPassage === 'string'
    ? glossedPassage
        .replace(/<\/?em>/gi, '')
        .replace(/<\/(p|div)>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim()
    : glossedPassage;
  markdown += `${cleanedPassage}\n\n`;

  markdown += `#Author\n`;
  markdown += `${getFieldValue('Author')}\n\n`;

  markdown += `#Publication\n`;
  markdown += `${getFieldValue('Publication')}\n\n`;

  markdown += `#Publication date\n`;
  markdown += `${getFieldValue('Publish Date')}\n\n`;

  // --- Builder content ---

  markdown += `#Step Overview\n`;
  markdown += `#Text\n`;
  markdown += `${stripHtml(getFieldValue('Summary'))}\n\n`;

  markdown += `#Cerca Words\n`;
  const cercaWords = getFieldValue('CERCA Words');
  let cercaText = '';
  if (typeof cercaWords === 'string') {
    cercaText = cercaWords
      .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }
  markdown += `${cercaText}\n\n`;

  // Step 1
  markdown += `#Step 1 - Personal Connection\n`;
  markdown += `${stripHtml(getFieldValue('Personal Connection'))}\n\n`;

  // Step 2
  markdown += `#Step 2 - Read\n`;
  markdown += `${stripHtml(getFieldValue('Read'))}\n\n`;

  markdown += `#Step 2 -Comprehension check\n`;
  markdown += `${getMCQs('Comprehension Check')}\n\n`;

  // Step 3
  // There are 4 fields named "Instructions" in order: engage, summarize, build, create
  markdown += `#Step 3 - Engage instructions\n`;
  markdown += `${stripHtml(getNthFieldValue('Instructions', 0))}\n\n`;

  markdown += `#Step 3 - Engage reread\n`;
  markdown += `${stripHtml(getFieldValue('Reread'))}\n\n`;

  // Highlighting Instructions - split into Aqua/Pink if possible
  const highlightingRaw = stripHtml(getFieldValue('Highlighting Instructions'));
  const aquaMatch = highlightingRaw.match(/AQUA:\s*(.*?)(?=\s*PINK:|$)/si);
  const pinkMatch = highlightingRaw.match(/PINK:\s*(.*?)$/si);

  markdown += `#Step 3 - Aqua highlight\n`;
  markdown += `${aquaMatch ? aquaMatch[1].trim() : highlightingRaw}\n\n`;

  markdown += `#Step 3 - Pink highlight\n`;
  markdown += `${pinkMatch ? pinkMatch[1].trim() : ''}\n\n`;

  // Step 4
  markdown += `#Step 4 - Summarize Introduction\n`;
  markdown += `${stripHtml(getNthFieldValue('Instructions', 1))}\n\n`;

  markdown += `#Step 4 - Summarize Help\n`;
  markdown += `${stripHtml(getFieldValue('Sentence Frames'))}\n\n`;

  // Step 5
  markdown += `#Step 5 - Build introduction\n`;
  markdown += `${stripHtml(getNthFieldValue('Instructions', 2))}\n\n`;

  markdown += `#Step 5 - Claim Section\n`;
  markdown += `**Claim**\n`;
  markdown += `${stripHtml(getFieldValue('Claim'))}\n\n`;
  markdown += `**Reasons and Evidence**\n`;
  markdown += `${stripHtml(getFieldValue('Reasons & Evidence'))}\n\n`;
  markdown += `**Reasoning**\n`;
  markdown += `${stripHtml(getFieldValue('Reasoning'))}\n\n`;
  markdown += `**Counterargument**\n`;
  markdown += `${stripHtml(getFieldValue('Counterargument'))}\n\n`;
 

  // Step 6
  markdown += `#Step 6 - Create Introduction\n`;
  markdown += `${stripHtml(getFieldValue('Section Introduction'))}\n\n`;

  markdown += `#Step 6 - Create Instructions\n`;
  markdown += `${stripHtml(getNthFieldValue('Instructions', 3))}\n\n`;

  markdown += `#Step 6 - Create Help\n`;
  markdown += `**Introduction**\n`;
  markdown += `${stripHtml(getFieldValue('Introduction'))}\n\n`;
  markdown += `**Body**\n`;
  markdown += `${stripHtml(getFieldValue('Body'))}\n\n`;
  markdown += `**Conclusion**\n`;
  markdown += `${stripHtml(getFieldValue('Conclusion'))}\n\n`;
  markdown += `**Audience**\n`;
  markdown += `${stripHtml(getFieldValue('Audience'))}\n\n`;
  markdown += `**Academic Language Models**\n`;
  markdown += `${stripHtml(getFieldValue('Academic Language Models'))}\n\n`;

  markdown += `#Additional Notes\n\n`;

  return markdown;
}
