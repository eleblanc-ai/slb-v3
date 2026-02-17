/**
 * Standards Mapper - Maps CCSS codes to other framework standards using MOAC CSV
 */

let cachedStandardsData = null;

/**
 * Load and parse the MOAC CSV file
 */
async function loadMOACData() {
  if (cachedStandardsData) {
    return cachedStandardsData;
  }

  try {
    const response = await fetch(new URL('../assets/MOAC SLB – No Letter CCSS.csv', import.meta.url).href);
    const text = await response.text();
    
    const lines = text.split('\n');
    const data = [];
    
    // Skip header row, read data starting from line 1
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      // Clean up values by removing leading/trailing quotes
      const cleanValues = values.map(v => v.replace(/^"+|"+$/g, '').trim());
      
      // Parse row: A=CCSS Code, B=CCSS Standard, C=Mapped Framework, D=Mapped Code, E=Mapped Standard
      if (cleanValues.length >= 5) {
        data.push({
          ccssCode: cleanValues[0],
          ccssStatement: cleanValues[1],
          mappedFramework: cleanValues[2],
          mappedCode: cleanValues[3],
          mappedStatement: cleanValues[4]
        });
      }
    }
    
    cachedStandardsData = data;
    return data;
  } catch (error) {
    console.error('Error loading MOAC CSV:', error);
    return [];
  }
}

/**
 * Extract grade number from a standard code
 * @param {string} code - Standard code
 * @returns {number|null} - Grade number or null if not found
 */
function extractGrade(code) {
  // Match patterns like:
  // BEST.ELA.11.R.2.1 -> 11
  // 11.T.T.2 -> 11
  // TEKS.ELAR.E3.5(J) -> 11 (E3 = English 3 = 11th grade)
  // TEKS.ELAR.E4.7(D) -> 12 (E4 = English 4 = 12th grade)
  
  // For codes starting with just a number (GSE format like "11.T.T.2")
  const gseMatch = code.match(/^(\d+)\./);
  if (gseMatch) return parseInt(gseMatch[1]);
  
  // For BEST format: BEST.ELA.11.R.2.1
  const bestMatch = code.match(/BEST\.ELA\.(\d+)\./);
  if (bestMatch) return parseInt(bestMatch[1]);
  
  // For TEKS format: TEKS.ELAR.E3.5 or TEKS.ELAR.E4.7
  // E1=9th, E2=10th, E3=11th, E4=12th grade
  const teksMatch = code.match(/TEKS\.ELAR\.E(\d+)\./);
  if (teksMatch) {
    const englishLevel = parseInt(teksMatch[1]);
    return englishLevel + 8; // E1->9, E2->10, E3->11, E4->12
  }
  
  return null;
}

/**
 * Extract grade level from grade band selector value
 * @param {string} gradeValue - Grade value from grade_band_selector (e.g., "11–12", "12", "9-10")
 * @returns {number|null} - Highest grade number in the range
 */
export function extractGradeFromBand(gradeValue) {
  if (!gradeValue) return null;
  
  // Handle ranges like "11–12" or "9-10"
  const rangeMatch = gradeValue.match(/(\d+)[–-](\d+)/);
  if (rangeMatch) {
    // Return the highest grade in the range
    return parseInt(rangeMatch[2]);
  }
  
  // Handle single grades like "12"
  const singleMatch = gradeValue.match(/^(\d+)$/);
  if (singleMatch) {
    return parseInt(singleMatch[1]);
  }
  
  return null;
}

/**
 * Get CCSS vocabulary standards for a grade (L.4 and L.6), with range fallback
 * @param {number|string} gradeLevel - Grade level (e.g., 8)
 * @returns {Promise<string[]>} - Matching CCSS codes
 */
export async function getCcssVocabularyStandardsForGrade(gradeLevel) {
  if (gradeLevel === null || gradeLevel === undefined) return [];

  const numericGrade = parseInt(gradeLevel.toString(), 10);
  if (Number.isNaN(numericGrade)) return [];

  const data = await loadMOACData();
  const codeSet = new Set(
    data.map(row => row.ccssCode).filter(Boolean)
  );

  const suffixes = ['4', '6'];
  const exactCodes = [];
  suffixes.forEach(level => {
    const rCode = `CCSS.R.${numericGrade}.L.${level}`;
    const lCode = `CCSS.L.${numericGrade}.${level}`;
    if (codeSet.has(rCode)) exactCodes.push(rCode);
    if (codeSet.has(lCode)) exactCodes.push(lCode);
  });

  if (exactCodes.length > 0) {
    return exactCodes;
  }

  const rangeEntries = [];
  for (const code of codeSet) {
    let match = code.match(/^CCSS\.R\.(\d+)-(\d+)\.L\.(4|6)$/i);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        rangeEntries.push({ code, start, end, level: match[3] });
      }
      continue;
    }

    match = code.match(/^CCSS\.L\.(\d+)-(\d+)\.(4|6)$/i);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        rangeEntries.push({ code, start, end, level: match[3] });
      }
    }
  }

  if (rangeEntries.length === 0) return [];

  const inclusive = rangeEntries.filter(entry => numericGrade >= entry.start && numericGrade <= entry.end);
  const candidates = inclusive.length > 0 ? inclusive : rangeEntries;

  // If no inclusive match, choose nearest ranges by distance to grade
  let filteredCandidates = candidates;
  if (inclusive.length === 0) {
    let bestDistance = Infinity;
    for (const entry of candidates) {
      const distance = Math.min(Math.abs(numericGrade - entry.start), Math.abs(numericGrade - entry.end));
      if (distance < bestDistance) {
        bestDistance = distance;
      }
    }
    filteredCandidates = candidates.filter(entry => {
      const distance = Math.min(Math.abs(numericGrade - entry.start), Math.abs(numericGrade - entry.end));
      return distance === bestDistance;
    });
  }

  const order = { '4': 0, '6': 1 };
  return filteredCandidates
    .map(entry => entry.code)
    .sort((a, b) => {
      const aMatch = a.match(/\.L\.(4|6)$/i);
      const bMatch = b.match(/\.L\.(4|6)$/i);
      const aOrder = aMatch ? order[aMatch[1]] : 99;
      const bOrder = bMatch ? order[bMatch[1]] : 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b);
    });
}

/**
 * Get framework-specific mapped vocab standards for a grade (mapped from CCSS L.4/L.6)
 * @param {number|string} gradeLevel - Grade level (e.g., 8)
 * @param {string} framework - Target framework (e.g., 'TEKS', 'BEST', 'BLOOM', 'GSE')
 * @returns {Promise<string[]>} - Matching mapped codes for the framework
 */
export async function getMappedVocabularyStandardsForGrade(gradeLevel, framework) {
  if (!framework || framework.toUpperCase() === 'CCSS') return [];
  if (gradeLevel === null || gradeLevel === undefined) return [];

  const numericGrade = parseInt(gradeLevel.toString(), 10);
  if (Number.isNaN(numericGrade)) return [];

  const data = await loadMOACData();
  const normalizedFramework = framework.toUpperCase();

  const suffixes = ['4', '6'];
  const exactCcssCodes = [];
  suffixes.forEach(level => {
    exactCcssCodes.push(`CCSS.L.${numericGrade}.${level}`);
    exactCcssCodes.push(`CCSS.R.${numericGrade}.L.${level}`);
  });

  let matchingRows = data.filter(row =>
    exactCcssCodes.includes(row.ccssCode) && row.mappedFramework === normalizedFramework
  );

  if (matchingRows.length === 0) {
    const rangeMatches = [];
    for (const row of data) {
      if (row.mappedFramework !== normalizedFramework) continue;
      let match = row.ccssCode?.match(/^CCSS\.L\.(\d+)-(\d+)\.(4|6)$/i);
      if (!match) {
        match = row.ccssCode?.match(/^CCSS\.R\.(\d+)-(\d+)\.L\.(4|6)$/i);
      }
      if (!match) continue;
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      rangeMatches.push({ row, start, end, level: match[3] });
    }

    const inclusive = rangeMatches.filter(entry => numericGrade >= entry.start && numericGrade <= entry.end);
    const candidates = inclusive.length > 0 ? inclusive : rangeMatches;

    if (candidates.length > 0) {
      let filtered = candidates;
      if (inclusive.length === 0) {
        let bestDistance = Infinity;
        for (const entry of candidates) {
          const distance = Math.min(Math.abs(numericGrade - entry.start), Math.abs(numericGrade - entry.end));
          if (distance < bestDistance) bestDistance = distance;
        }
        filtered = candidates.filter(entry => {
          const distance = Math.min(Math.abs(numericGrade - entry.start), Math.abs(numericGrade - entry.end));
          return distance === bestDistance;
        });
      }
      matchingRows = filtered.map(entry => entry.row);
    }
  }

  const codes = matchingRows
    .map(row => row.mappedCode)
    .filter(Boolean);

  return [...new Set(codes)].sort((a, b) => a.localeCompare(b));
}

/**
 * Get all framework mappings for a CCSS code
 * @param {string} ccssCode - The CCSS code to look up (e.g., "CCSS.L.3.1")
 * @param {number|string} gradeLevel - Optional grade level to filter results (e.g., 11 or 12)
 * @returns {Object} - Object with arrays for each framework: { CCSS: [...], TEKS: [...], BEST: [...], BLOOM: [...], GSE: [...] }
 */
export async function getMappedStandards(ccssCode, gradeLevel = null) {
  const data = await loadMOACData();
  
  // Parse grade level if provided as string
  const targetGrade = gradeLevel ? parseInt(gradeLevel.toString()) : null;
  
  // Initialize result with the CCSS code
  const result = {
    CCSS: [ccssCode],
    TEKS: [],
    BEST: [],
    BLOOM: [],
    GSE: []
  };
  
  // Find all rows with this CCSS code
  const matchingRows = data.filter(row => row.ccssCode === ccssCode);
  
  // Extract mapped standards by framework
  for (const row of matchingRows) {
    const framework = row.mappedFramework;
    const code = row.mappedCode;
    
    if (framework && code) {
      // If grade level is specified, filter by grade
      if (targetGrade) {
        const codeGrade = extractGrade(code);
        if (codeGrade && codeGrade !== targetGrade) {
          continue; // Skip standards that don't match the target grade
        }
      }
      
      if (framework === 'TEKS' && !result.TEKS.includes(code)) {
        result.TEKS.push(code);
      } else if (framework === 'BEST' && !result.BEST.includes(code)) {
        result.BEST.push(code);
      } else if (framework === 'BLOOM' && !result.BLOOM.includes(code)) {
        result.BLOOM.push(code);
      } else if (framework === 'GSE' && !result.GSE.includes(code)) {
        result.GSE.push(code);
      }
    }
  }
  
  return result;
}

/**
 * Format mapped standards as a string in the order: CCSS; TEKS; BEST; BLOOM; GSE
 * @param {Object} mappedStandards - Object returned by getMappedStandards
 * @returns {string} - Formatted string like "CCSS.L.3.1; TEKS.ELAR.3.11(D); BEST.ELA.3.C.3.1"
 */
export function formatMappedStandards(mappedStandards) {
  const parts = [];
  
  // Order: CCSS, TEKS, BEST, BLOOM, GSE
  const order = ['CCSS', 'TEKS', 'BEST', 'BLOOM', 'GSE'];
  
  for (const framework of order) {
    if (mappedStandards[framework] && mappedStandards[framework].length > 0) {
      parts.push(...mappedStandards[framework]);
    }
  }
  
  return parts.join('; ');
}

/**
 * Insert a standard code into a standards string, maintaining framework order: CCSS; TEKS; BEST; BLOOM; GSE
 * @param {string} standardsString - Semicolon-separated standards string
 * @param {string} standardToInsert - Standard code to insert
 * @returns {string} - Updated standards string with the standard inserted in correct position
 */
export function insertStandardInOrder(standardsString, standardToInsert) {
  if (!standardToInsert) return standardsString;
  if (!standardsString) return standardToInsert;
  
  const order = ['CCSS', 'TEKS', 'BEST', 'BLOOM', 'GSE'];
  const insertFramework = detectFramework(standardToInsert);
  const insertIndex = order.indexOf(insertFramework);
  
  // Parse existing standards into ordered buckets
  const existingStandards = standardsString.split(';').map(s => s.trim()).filter(s => s);
  
  // Check if it's already in the list
  if (existingStandards.includes(standardToInsert)) {
    return standardsString;
  }
  
  // Build ordered result
  const buckets = { CCSS: [], TEKS: [], BEST: [], BLOOM: [], GSE: [] };
  
  for (const std of existingStandards) {
    const fw = detectFramework(std);
    if (fw && buckets[fw]) {
      buckets[fw].push(std);
    }
  }
  
  // Insert the new standard at the beginning of its framework bucket
  if (insertFramework && buckets[insertFramework]) {
    buckets[insertFramework].unshift(standardToInsert);
  }
  
  // Rebuild the string in order
  const result = [];
  for (const fw of order) {
    result.push(...buckets[fw]);
  }
  
  return result.join('; ');
}

/**
 * Get formatted standards string for a CCSS code
 * @param {string} ccssCode - The CCSS code to look up
 * @param {number|string} gradeLevel - Optional grade level to filter results
 * @returns {string} - Formatted standards string
 */
export async function getFormattedMappedStandards(ccssCode, gradeLevel = null) {
  const mapped = await getMappedStandards(ccssCode, gradeLevel);
  return formatMappedStandards(mapped);
}

/**
 * Detect which framework a standard code belongs to
 * @param {string} code - Standard code to identify
 * @returns {string|null} - Framework name ('CCSS', 'TEKS', 'BEST', 'BLOOM', 'GSE') or null if unknown
 */
export function detectFramework(code) {
  if (!code) return null;
  
  if (code.startsWith('CCSS.')) return 'CCSS';
  if (code.startsWith('TEKS.')) return 'TEKS';
  if (code.startsWith('BEST.')) return 'BEST';
  if (code.startsWith('BLOOM.')) return 'BLOOM';
  // GSE codes often start with a grade number like "3.L.V.1"
  if (/^\d+\./.test(code)) return 'GSE';
  
  return null;
}

/**
 * Reverse lookup: Find CCSS codes that map to a given non-CCSS standard code
 * @param {string} standardCode - The non-CCSS standard code to look up (e.g., "TEKS.ELAR.3.11(D)")
 * @returns {string[]} - Array of CCSS codes that map to this standard
 */
export async function getCCSSFromMappedCode(standardCode) {
  const data = await loadMOACData();
  
  // Find all rows where mappedCode matches exactly
  const matchingRows = data.filter(row => row.mappedCode === standardCode);
  
  // Extract unique CCSS codes
  const ccssCodes = [...new Set(matchingRows.map(row => row.ccssCode))];
  
  return ccssCodes;
}

/**
 * Get all framework mappings starting from ANY standard code (CCSS or non-CCSS)
 * If starting from non-CCSS, first finds matching CCSS code(s), then pulls all mappings
 * @param {string} standardCode - Any standard code (CCSS, TEKS, BEST, BLOOM, or GSE)
 * @param {number|string} gradeLevel - Optional grade level to filter results
 * @returns {Object} - Object with arrays for each framework: { CCSS: [...], TEKS: [...], BEST: [...], BLOOM: [...], GSE: [...] }
 */
export async function getMappedStandardsFromAny(standardCode, gradeLevel = null) {
  const framework = detectFramework(standardCode);
  
  // Initialize result object
  const result = {
    CCSS: [],
    TEKS: [],
    BEST: [],
    BLOOM: [],
    GSE: []
  };
  
  // If it's already CCSS, use the existing function
  if (framework === 'CCSS') {
    return getMappedStandards(standardCode, gradeLevel);
  }
  
  // For non-CCSS codes, first find the CCSS code(s) that map to it
  const ccssCodes = await getCCSSFromMappedCode(standardCode);
  
  if (ccssCodes.length === 0) {
    // No CCSS mapping found - just return the original code in its framework
    if (framework && result[framework]) {
      result[framework].push(standardCode);
    }
    return result;
  }
  
  // For each CCSS code, get all mappings and merge (with deduplication)
  for (const ccssCode of ccssCodes) {
    const mappings = await getMappedStandards(ccssCode, gradeLevel);
    
    // Merge each framework's codes, deduplicating
    for (const fw of ['CCSS', 'TEKS', 'BEST', 'BLOOM', 'GSE']) {
      for (const code of mappings[fw]) {
        if (!result[fw].includes(code)) {
          result[fw].push(code);
        }
      }
    }
  }
  
  return result;
}

/**
 * Get formatted standards string starting from ANY standard code
 * @param {string} standardCode - Any standard code (CCSS, TEKS, BEST, BLOOM, or GSE)
 * @param {number|string} gradeLevel - Optional grade level to filter results
 * @returns {string} - Formatted standards string in order: CCSS; TEKS; BEST; BLOOM; GSE
 */
export async function getFormattedMappedStandardsFromAny(standardCode, gradeLevel = null) {
  const mapped = await getMappedStandardsFromAny(standardCode, gradeLevel);
  return formatMappedStandards(mapped);
}

/**
 * Get the statement/definition for a standard code
 * @param {string} standardCode - Any standard code
 * @returns {string|null} - The statement text or null if not found
 */
export async function getStandardStatement(standardCode) {
  const data = await loadMOACData();
  const framework = detectFramework(standardCode);
  
  if (framework === 'CCSS') {
    // Look for the CCSS statement directly
    const row = data.find(r => r.ccssCode === standardCode);
    return row?.ccssStatement || null;
  } else {
    // Look for the mapped code statement
    const row = data.find(r => r.mappedCode === standardCode);
    return row?.mappedStatement || null;
  }
}

/**
 * Get mapped standards WITH source standard info (code + statement)
 * @param {string} standardCode - Any standard code (CCSS, TEKS, BEST, BLOOM, or GSE)
 * @param {number|string} gradeLevel - Optional grade level to filter results
 * @returns {Object} - { mappedStandards: string, sourceStandard: { code: string, statement: string } }
 */
export async function getMappedStandardsWithSource(standardCode, gradeLevel = null) {
  const mappedStandards = await getFormattedMappedStandardsFromAny(standardCode, gradeLevel);
  const statement = await getStandardStatement(standardCode);
  
  return {
    mappedStandards,
    sourceStandard: {
      code: standardCode,
      statement: statement || '(Statement not available)'
    }
  };
}

/**
 * Filter aligned standards using AI to only include those that actually apply
 * to the question and reading passage. Ensures at least one standard per framework is kept.
 * @param {string} questionText - The MCQ question with choices
 * @param {string} contextText - The reading passage or other context
 * @param {string[]} candidateStandards - Array of standard codes to filter
 * @param {Function} callAIFunc - The AI calling function to use
 * @param {string} model - The AI model to use
 * @returns {Promise<string[]>} - Filtered array of standard codes
 */
export async function filterAlignedStandardsWithAI(questionText, contextText, candidateStandards, callAIFunc, model) {
  // Load statements for each standard to give AI context
  const standardsWithStatements = await Promise.all(
    candidateStandards.map(async (code) => {
      const statement = await getStandardStatement(code);
      return {
        code,
        statement: statement || '(No description available)',
        framework: detectFramework(code)
      };
    })
  );
  
  // Build the prompt
  const prompt = `You are an educational standards alignment expert. Analyze the following multiple choice question and reading passage, then determine which of the candidate standards actually align with the question content.

READING PASSAGE/CONTEXT:
${contextText || '(No reading passage provided)'}

QUESTION:
${questionText}

CANDIDATE STANDARDS TO EVALUATE:
${standardsWithStatements.map(s => `- ${s.code}: ${s.statement}`).join('\n')}

INSTRUCTIONS:
1. For each standard, determine if it genuinely aligns with what the question is testing
2. A standard aligns if the question directly tests the skill or knowledge described by that standard
3. Be somewhat selective - only include standards that clearly match the question's focus
4. IMPORTANT: Ensure you include AT LEAST ONE standard from each framework present (CCSS, TEKS, BEST, BLOOM, GSE)
5. If multiple standards from a framework could apply, include the most relevant ones

Return ONLY the standard codes that align, separated by semicolons. No explanations.
Example response: CCSS.RI.3.1; TEKS.ELAR.3.6(B); BEST.ELA.3.R.2.2; BLOOM.2.5; 3.T.RA.2.a`;

  try {
    const response = await callAIFunc(prompt, model, 500);
    
    // Parse the response to extract standard codes
    const filteredCodes = response
      .split(/[;\n,]/)
      .map(code => code.trim())
      .filter(code => code && candidateStandards.includes(code));
    
    // Ensure at least one standard per framework is kept
    const frameworksPresent = new Set(candidateStandards.map(code => detectFramework(code)));
    const frameworksCovered = new Set(filteredCodes.map(code => detectFramework(code)));
    
    // Add one standard from any framework that's missing
    for (const fw of frameworksPresent) {
      if (!frameworksCovered.has(fw)) {
        const missingFwStandard = candidateStandards.find(code => detectFramework(code) === fw);
        if (missingFwStandard) {
          filteredCodes.push(missingFwStandard);
        }
      }
    }
    
    // If filtering returned nothing, keep at least one per framework
    if (filteredCodes.length === 0) {
      for (const fw of frameworksPresent) {
        const fwStandard = candidateStandards.find(code => detectFramework(code) === fw);
        if (fwStandard) {
          filteredCodes.push(fwStandard);
        }
      }
    }
    
    return filteredCodes;
  } catch (error) {
    console.error('Error filtering standards with AI:', error);
    // On error, return original list
    return candidateStandards;
  }
}
