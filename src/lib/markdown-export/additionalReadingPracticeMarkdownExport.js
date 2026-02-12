/**
 * Markdown Export for Additional Reading Practice Lesson Template
 * Custom export function for ARP content
 */

export function generateMarkdown(templateData, fields, fieldValues) {
  let markdown = '';
  
  // Helper function to find field value by name
  const getFieldValue = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    return fieldValues[field.id] || '';
  };
  
  // Helper function to get thumbnail URL from image field
  const getThumbnailUrl = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    const imageData = fieldValues[field.id];
    return imageData?.url || '';
  };
  
  // Helper to get array values as semicolon-separated string
  const getArrayAsSemicolonList = (fieldName) => {
    const value = getFieldValue(fieldName);
    if (Array.isArray(value) && value.length > 0) {
      return value.join('; ');
    }
    return '';
  };
  
  // Helper to get standard codes from objects
  const getStandardCodes = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    const value = fieldValues[field.id];
    if (Array.isArray(value) && value.length > 0) {
      const codes = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return item.fullCode || item.code || '';
        }
        return String(item);
      }).filter(code => code !== '');
      return codes.length > 0 ? codes.join('; ') : '';
    }
    return '';
  };
  
  // Helper to get MCQs as formatted text
  const getMCQs = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    const value = fieldValues[field.id];
    if (value?.questions && Array.isArray(value.questions)) {
      return value.questions
        .filter(q => q)
        .map((q, idx) => {
          let cleanQuestion = '';
          if (typeof q === 'string') {
            // Replace closing block tags with single newlines
            cleanQuestion = q
              .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<[^>]*>/g, '')  // Remove remaining HTML tags
              .replace(/\n\s*\n+/g, '\n')  // Collapse multiple newlines to single
              .trim();
          } else {
            cleanQuestion = q;
          }
          return `${cleanQuestion}`;
        })
        .join('\n\n');
    }
    return '';
  };
  
  // Content ID
  markdown += `#Content ID\n`;
  markdown += `${getFieldValue('Content ID')}\n\n`;
  
  // Selection
  markdown += `#Selection\n`;
  const selection = getFieldValue('Selection');
  const selectionText = typeof selection === 'string' ? selection.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : selection;
  markdown += `${selectionText}\n\n`;
  
  // Photo Link
  markdown += `#Photo Link\n`;
  markdown += `${getThumbnailUrl('Thumbnail Image')}\n\n`;
  
  // Theme
  markdown += `#Theme\n`;
  markdown += `${getFieldValue('Theme')}\n\n`;
  
  // CERCA Question
  markdown += `#CERCA Question\n`;
  const cercaQuestion = getFieldValue('CERCA Question');
  const cercaText = typeof cercaQuestion === 'string' ? cercaQuestion.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : cercaQuestion;
  markdown += `${cercaText}\n\n`;
  
  // Grade Band
  markdown += `#Grade Band\n`;
  markdown += `${getFieldValue('Grade Band')}\n\n`;
  
  // Subjects
  markdown += `#Subjects\n`;
  const subjects = getFieldValue('Subjects');
  if (Array.isArray(subjects) && subjects.length > 0) {
    subjects.forEach(subject => {
      const displaySubject = subject === 'English Language Arts' ? 'ELA' : subject;
      markdown += `${displaySubject}\n`;
    });
    markdown += `\n`;
  } else {
    markdown += `\n`;
  }
  
  // Tags
  markdown += `#Tags\n`;
  markdown += `${getFieldValue('Tags')}\n\n`;
  
  // Primary Standard
  markdown += `#Primary Standard\n`;
  markdown += `${getStandardCodes('Primary Standard(s)')}\n\n`;
  
  // Primary Reading
  markdown += `#Primary Reading\n`;
  markdown += `${getStandardCodes('Primary Reading Standard(s)')}\n\n`;
  
  // Just-in Time Words
  markdown += `#Just-in-Time Words\n`;
  const glossary = getFieldValue('Glossary');
  let glossaryText = '';
  if (typeof glossary === 'string') {
    // Replace closing block tags with double newlines to separate definitions
    glossaryText = glossary
      .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')  // Remove remaining HTML tags
      .replace(/\n\s*\n\s*\n/g, '\n\n')  // Collapse multiple newlines to max 2
      .trim();
  } else {
    glossaryText = glossary;
  }
  markdown += `${glossaryText}\n\n`;
  
  // Close Reading Questions
  markdown += `#Close Reading Questions\n`;
  markdown += `${getMCQs('Multiple Choice Questions')}\n\n`;
  
  // Headline
  markdown += `#Headline\n`;
  markdown += `${getFieldValue('Headline')}\n\n`;
  
  // Passage
  markdown += `#Passage\n`;
  const glossedPassage = getFieldValue('Glossed Passage');
  // Strip <em> tags but keep asterisks and other content
  const cleanedPassage = typeof glossedPassage === 'string' 
    ? glossedPassage.replace(/<\/?em>/gi, '') 
    : glossedPassage;
  markdown += `${cleanedPassage}\n\n`;
  markdown += `#Lexile Level\n`;
  markdown += `${getFieldValue('Lexile Level')}\n\n`;
  
  // Author
  markdown += `#Author\n`;
  markdown += `${getFieldValue('Author')}\n\n`;
  
  // Publisher
  markdown += `#Publisher\n`;
  markdown += `${getFieldValue('Publisher')}\n\n`;
  
  // Additional Notes
  markdown += `#Additional Notes\n`;
  markdown += `\n`;
  
  return markdown;
}
