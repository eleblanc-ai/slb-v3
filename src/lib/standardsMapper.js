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
      
      // Parse row: A=CCSS Code, B=CCSS Standard, C=Mapped Framework, D=Mapped Code, E=Mapped Standard
      if (values.length >= 5) {
        data.push({
          ccssCode: values[0],
          ccssStatement: values[1],
          mappedFramework: values[2],
          mappedCode: values[3],
          mappedStatement: values[4]
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
  // TEKS.ELAR.E3.5(J) -> 3
  // TEKS.ELAR.E4.7(D) -> 4
  
  // For codes starting with just a number (GSE format like "11.T.T.2")
  const gseMatch = code.match(/^(\d+)\./);
  if (gseMatch) return parseInt(gseMatch[1]);
  
  // For BEST format: BEST.ELA.11.R.2.1
  const bestMatch = code.match(/BEST\.ELA\.(\d+)\./);
  if (bestMatch) return parseInt(bestMatch[1]);
  
  // For TEKS format: TEKS.ELAR.E3.5 or TEKS.ELAR.E4.7
  const teksMatch = code.match(/TEKS\.ELAR\.E(\d+)\./);
  if (teksMatch) return parseInt(teksMatch[1]);
  
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
 * Get formatted standards string for a CCSS code
 * @param {string} ccssCode - The CCSS code to look up
 * @param {number|string} gradeLevel - Optional grade level to filter results
 * @returns {string} - Formatted standards string
 */
export async function getFormattedMappedStandards(ccssCode, gradeLevel = null) {
  const mapped = await getMappedStandards(ccssCode, gradeLevel);
  return formatMappedStandards(mapped);
}
