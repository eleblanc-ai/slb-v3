/**
 * Utility to generate markdown export files for lesson templates
 */

// Convert template name to camelCase for file naming
export function templateNameToCamelCase(name) {
  return name
    .split(' ')
    .map((word, index) => {
      // Remove special characters
      const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
      if (index === 0) {
        return cleanWord.toLowerCase();
      }
      return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
    })
    .join('');
}

// Generate the markdown export file content
export function generateMarkdownExportFileContent(templateName) {
  return `/**
 * Markdown Export for ${templateName} Lesson Template
 * Auto-generated export function for lesson content
 */

export function generateMarkdown(templateData, fields, fieldValues) {
  let markdown = \`# \${templateData?.name || 'Lesson'}\\n\\n\`;
  
  // Add designer fields
  const designerFields = fields.filter(f => f.fieldFor === 'designer');
  if (designerFields.length > 0) {
    markdown += \`## Designer Fields\\n\\n\`;
    designerFields.forEach(field => {
      const value = fieldValues[field.id];
      markdown += \`### \${field.name}\${field.required ? ' *' : ''}\\n\\n\`;
      
      if (field.type === 'checklist' && Array.isArray(value)) {
        value.forEach(item => {
          markdown += \`- \${item}\\n\`;
        });
        markdown += \`\\n\`;
      } else if (field.type === 'mcqs' && value?.questions) {
        value.questions.forEach((q, idx) => {
          if (q) {
            // Strip HTML tags for cleaner markdown
            const cleanQuestion = q.replace(/<[^>]*>/g, '\\n').trim();
            markdown += \`**Question \${idx + 1}:**\\n\${cleanQuestion}\\n\\n\`;
          }
        });
      } else if (field.type === 'rich_text' || field.type === 'text') {
        // Strip HTML for rich text, keep plain text as is
        const textValue = typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim() : '';
        markdown += \`\${textValue || '_No content_'}\\n\\n\`;
      } else if (field.type === 'image' && value?.url) {
        markdown += \`![\${field.name}](\${value.url})\\n\\n\`;
        if (value.altText) {
          markdown += \`_\${value.altText}_\\n\\n\`;
        }
      } else {
        markdown += \`\${value || '_No content_'}\\n\\n\`;
      }
    });
  }
  
  // Add builder fields
  const builderFields = fields.filter(f => f.fieldFor === 'builder');
  if (builderFields.length > 0) {
    markdown += \`## Builder Fields\\n\\n\`;
    builderFields.forEach(field => {
      const value = fieldValues[field.id];
      markdown += \`### \${field.name}\${field.required ? ' *' : ''}\\n\\n\`;
      
      if (field.type === 'checklist' && Array.isArray(value)) {
        value.forEach(item => {
          markdown += \`- \${item}\\n\`;
        });
        markdown += \`\\n\`;
      } else if (field.type === 'mcqs' && value?.questions) {
        value.questions.forEach((q, idx) => {
          if (q) {
            // Strip HTML tags for cleaner markdown
            const cleanQuestion = q.replace(/<[^>]*>/g, '\\n').trim();
            markdown += \`**Question \${idx + 1}:**\\n\${cleanQuestion}\\n\\n\`;
          }
        });
      } else if (field.type === 'rich_text' || field.type === 'text') {
        // Strip HTML for rich text, keep plain text as is
        const textValue = typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim() : '';
        markdown += \`\${textValue || '_No content_'}\\n\\n\`;
      } else if (field.type === 'image' && value?.url) {
        markdown += \`![\${field.name}](\${value.url})\\n\\n\`;
        if (value.altText) {
          markdown += \`_\${value.altText}_\\n\\n\`;
        }
      } else {
        markdown += \`\${value || '_No content_'}\\n\\n\`;
      }
    });
  }
  
  return markdown;
}
`;
}

// Generate import statement for CreateNewLesson.jsx
export function generateImportStatement(templateName) {
  const camelCaseName = templateNameToCamelCase(templateName);
  return `import { generateMarkdown as generate${camelCaseName.charAt(0).toUpperCase() + camelCaseName.slice(1)}Markdown } from '../../export/templates/${camelCaseName}MarkdownExport';`;
}

// Generate map entry for CreateNewLesson.jsx
export function generateMapEntry(templateName) {
  const camelCaseName = templateNameToCamelCase(templateName);
  const functionName = `generate${camelCaseName.charAt(0).toUpperCase() + camelCaseName.slice(1)}Markdown`;
  return `      '${templateName}': ${functionName},`;
}
