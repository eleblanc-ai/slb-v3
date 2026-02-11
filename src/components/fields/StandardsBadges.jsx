import { useState, useEffect } from 'react';

/**
 * StandardsBadges - Extracts and displays standards from MCQ HTML content with tooltips
 * Parses standards like [CCSS.RI.11-12.3; BEST.ELA.12.R.2.1] from HTML
 * Also displays the source standard used to generate the question
 * Shows overlay when a new standard is pending (selected but not yet regenerated)
 * Can optionally show filtered-out standards with a toggle
 */
export default function StandardsBadges({ htmlContent, onChange, sourceStandard, pendingStandard, filteredOutStandards = [], onRestoreStandard }) {
  const [standards, setStandards] = useState([]);
  const [standardsData, setStandardsData] = useState({});
  const [hoveredStandard, setHoveredStandard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastDeleted, setLastDeleted] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const [showFilteredOut, setShowFilteredOut] = useState(false);
  
  // Check if there's a pending standard that differs from the source
  const hasPendingStandard = pendingStandard && 
    (!sourceStandard || pendingStandard.fullCode !== sourceStandard.code);

  // Load all standards data from CSV
  useEffect(() => {
    const loadStandardsData = async () => {
      try {
        // Load both standards.csv and MOAC CSV for complete coverage
        const [standardsResponse, moacResponse] = await Promise.all([
          fetch(new URL('../../assets/standards.csv', import.meta.url).href),
          fetch(new URL('../../assets/MOAC SLB – No Letter CCSS.csv', import.meta.url).href)
        ]);
        
        const [standardsText, moacText] = await Promise.all([
          standardsResponse.text(),
          moacResponse.text()
        ]);
        
        const dataMap = {};
        
        // Helper function to parse CSV line properly
        const parseCSVLine = (line) => {
          const values = [];
          let current = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
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
          
          // Clean up all values by removing quotes
          return values.map(v => {
            // Remove all quote characters (handles "", """, etc.)
            return v.replace(/^"+|"+$/g, '').trim();
          });
        };
        
        // Parse standards.csv (column 7 = code, column 5 = description)
        const standardsLines = standardsText.split('\n');
        for (let i = 1; i < standardsLines.length; i++) {
          const line = standardsLines[i];
          if (!line.trim()) continue;
          
          const values = parseCSVLine(line);
          const fullCode = values[7];
          const statement = values[5];
          
          if (fullCode && statement) {
            dataMap[fullCode] = statement;
          }
        }
        
        // Parse MOAC CSV (column 3 = framework code, column 4 = framework description)
        const moacLines = moacText.split('\n');
        for (let i = 1; i < moacLines.length; i++) {
          const line = moacLines[i];
          if (!line.trim()) continue;
          
          const values = parseCSVLine(line);
          const frameworkCode = values[3]; // Column D (0-indexed column 3)
          const frameworkStatement = values[4]; // Column E (0-indexed column 4)
          
          if (frameworkCode && frameworkStatement) {
            dataMap[frameworkCode] = frameworkStatement;
          }
        }
        
        setStandardsData(dataMap);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading standards data:', err);
        setIsLoading(false);
      }
    };
    
    loadStandardsData();
  }, []);

  // Extract standards from HTML content
  useEffect(() => {
    if (!htmlContent) {
      setStandards([]);
      return;
    }

    // Look for standards in brackets like [CCSS.RI.11-12.3; BEST.ELA.12.R.2.1; ...]
    const standardsRegex = /\[([^\]]+)\]/g;
    const matches = [...htmlContent.matchAll(standardsRegex)];
    
    if (matches.length > 0) {
      // Get the last match (standards are typically at the end before the KEY)
      const lastMatch = matches[matches.length - 1];
      const standardsText = lastMatch[1];
      
      // Split by semicolon or comma
      const standardCodes = standardsText
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(s => s && s !== 'KEY:' && !s.startsWith('KEY'));
      
      setStandards(standardCodes);
    } else {
      setStandards([]);
    }
  }, [htmlContent]);

  const handleDeleteStandard = (codeToDelete) => {
    if (!onChange || !htmlContent) return;

    // Store the deleted standard and original content for undo
    setLastDeleted({ code: codeToDelete, originalContent: htmlContent });
    setShowUndo(true);

    // Remove the standard from the HTML content
    const standardsRegex = /\[([^\]]+)\]/g;
    const updatedContent = htmlContent.replace(standardsRegex, (match, standardsText) => {
      // Split by semicolon or comma
      const codes = standardsText
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(s => s && s !== codeToDelete);
      
      // If no standards left, remove the entire bracket
      if (codes.length === 0) {
        return '';
      }
      
      // Return the updated standards list
      return `[${codes.join('; ')}]`;
    });

    onChange(updatedContent);

    // Hide undo after 5 seconds
    setTimeout(() => {
      setShowUndo(false);
      setLastDeleted(null);
    }, 5000);
  };

  const handleUndo = () => {
    if (!lastDeleted || !onChange) return;
    
    // Restore the original content
    onChange(lastDeleted.originalContent);
    setLastDeleted(null);
    setShowUndo(false);
  };

  if (standards.length === 0 && !sourceStandard) {
    if (isLoading) return null;
    return null;
  }

  return (
    <div style={{
      marginTop: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }}>
      {/* Source Standard Section - shows which standard was used to generate the question */}
      {sourceStandard && sourceStandard.code && (
        <div style={{
          padding: '8px 12px',
          background: '#fefce8',
          border: '1px solid #fde047',
          borderRadius: 6,
          position: 'relative'
        }}>
          {/* Overlay when there's a pending standard */}
          {hasPendingStandard && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(251, 191, 36, 0.15)',
              backdropFilter: 'blur(1px)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}>
              <div style={{
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 500,
                color: '#92400e',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                Regenerate the question to update
              </div>
            </div>
          )}
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#a16207',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 6
          }}>
            Source Standard
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8
          }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 8px',
              background: '#fef08a',
              border: '1px solid #facc15',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              color: '#854d0e',
              whiteSpace: 'nowrap'
            }}>
              {sourceStandard.code}
            </span>
            <span style={{
              fontSize: 12,
              color: '#713f12',
              lineHeight: 1.5
            }}>
              {sourceStandard.statement}
            </span>
          </div>
        </div>
      )}
      
      {/* Aligned Standards Section */}
      {standards.length > 0 && !isLoading && (
        <div style={{
          padding: '8px 12px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          position: 'relative'
        }}>
          {/* Overlay when there's a pending standard */}
          {hasPendingStandard && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(251, 191, 36, 0.15)',
              backdropFilter: 'blur(1px)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}>
              <div style={{
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 500,
                color: '#92400e',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                Regenerate the question to update alignments
              </div>
            </div>
          )}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
        }}>
          Aligned Standards
        </div>
        {showUndo && lastDeleted && (
          <button
            type="button"
            onClick={handleUndo}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fcd34d',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fde68a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fef3c7';
            }}
          >
            ↶ Undo delete {lastDeleted.code}
          </button>
        )}
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6
      }}>
        {standards
          // Filter out the source standard from aligned standards (no need to show it twice)
          .filter(code => !sourceStandard || code !== sourceStandard.code)
          .map((code, index) => {
          // Try multiple lookup strategies for the description
          let description = standardsData[code];
          
          // If not found, try with "GSE." prefix for ELAGSE codes
          if (!description && code.startsWith('ELAGSE')) {
            description = standardsData[code];
          }
          
          // If not found, try removing any quotes
          if (!description) {
            const cleanCode = code.replace(/"/g, '');
            description = standardsData[cleanCode];
          }
          
          // Fallback
          if (!description) {
            description = '(Description not available)';
          }
          
          const isHovered = hoveredStandard === index;
          
          return (
            <div
              key={index}
              style={{
                position: 'relative',
                display: 'inline-block'
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#1e40af',
                  transition: 'all 0.15s',
                  ...(isHovered && {
                    background: '#dbeafe',
                    borderColor: '#93c5fd'
                  })
                }}
              >
                <span
                  style={{ cursor: 'help' }}
                  onMouseEnter={() => setHoveredStandard(index)}
                  onMouseLeave={() => setHoveredStandard(null)}
                  title={description}
                >
                  {code}
                </span>
                {onChange && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStandard(code);
                    }}
                    style={{
                      padding: 0,
                      background: 'transparent',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#bfdbfe';
                      e.currentTarget.style.color = '#1e40af';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#3b82f6';
                    }}
                    title="Remove standard"
                  >
                    ✕
                  </button>
                )}
              </span>
              
              {/* Tooltip */}
              {isHovered && description !== '(Description not available)' && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 8,
                  padding: '8px 12px',
                  background: '#1e293b',
                  color: '#fff',
                  fontSize: 11,
                  lineHeight: 1.5,
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  zIndex: 1001,
                  pointerEvents: 'none',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  minWidth: 200,
                  maxWidth: 400
                }}>
                  {description}
                  {/* Arrow */}
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid #1e293b'
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
        </div>
      )}
      
      {/* Filtered Out Standards Section - shows standards that were removed by AI filtering */}
      {filteredOutStandards && filteredOutStandards.length > 0 && !isLoading && (
        <div style={{
          padding: '8px 12px',
          background: showFilteredOut ? '#fef2f2' : '#fafafa',
          border: `1px solid ${showFilteredOut ? '#fecaca' : '#e5e5e5'}`,
          borderRadius: 6,
          transition: 'all 0.2s'
        }}>
          <button
            type="button"
            onClick={() => setShowFilteredOut(!showFilteredOut)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#71717a',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {showFilteredOut ? '▼' : '▶'} {filteredOutStandards.length} AI Identified as Less Relevant
            </span>
          </button>
          
          {showFilteredOut && (
            <div style={{
              marginTop: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{
                fontSize: 10,
                color: '#a1a1aa',
                fontStyle: 'italic'
              }}>
                Click + to re-add a standard to the aligned set
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6
              }}>
              {filteredOutStandards.map((code, index) => {
                let description = standardsData[code];
                if (!description) {
                  const cleanCode = code.replace(/"/g, '');
                  description = standardsData[cleanCode];
                }
                if (!description) {
                  description = '(Description not available)';
                }
                
                const isFilteredHovered = hoveredStandard === `filtered-${index}`;
                
                return (
                  <div
                    key={index}
                    style={{
                      position: 'relative',
                      display: 'inline-block'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        background: '#f5f5f5',
                        border: '1px solid #d4d4d4',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#737373',
                        transition: 'all 0.15s',
                        ...(isFilteredHovered && {
                          background: '#e5e5e5',
                          borderColor: '#a3a3a3'
                        })
                      }}
                    >
                      <span
                        style={{ cursor: 'help' }}
                        onMouseEnter={() => setHoveredStandard(`filtered-${index}`)}
                        onMouseLeave={() => setHoveredStandard(null)}
                        title={description}
                      >
                        {code}
                      </span>
                      {(onChange || onRestoreStandard) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Restore this standard to the aligned standards in correct order
                            if (!htmlContent) return;
                            
                            // Define framework order for sorting
                            const frameworkOrder = ['CCSS', 'TEKS', 'BEST', 'BLOOM', 'ELAGSE', 'GSE'];
                            const getFrameworkIndex = (stdCode) => {
                              for (let i = 0; i < frameworkOrder.length; i++) {
                                if (stdCode.startsWith(frameworkOrder[i])) return i;
                              }
                              // Check for numeric codes like "12.T.T.2.a" which are GSE
                              if (/^\d+\./.test(stdCode)) return frameworkOrder.indexOf('GSE');
                              return frameworkOrder.length; // Unknown frameworks go last
                            };
                            
                            const standardsRegex = /\[([^\]]+)\]/;
                            const match = htmlContent.match(standardsRegex);
                            
                            let updatedContent = htmlContent;
                            if (match) {
                              // Parse existing standards and add the new one
                              const existingStandards = match[1]
                                .split(/[;,]/)
                                .map(s => s.trim())
                                .filter(s => s);
                              
                              // Add the restored standard
                              existingStandards.push(code);
                              
                              // Sort by framework order
                              existingStandards.sort((a, b) => {
                                const indexA = getFrameworkIndex(a);
                                const indexB = getFrameworkIndex(b);
                                if (indexA !== indexB) return indexA - indexB;
                                // Within same framework, sort alphabetically
                                return a.localeCompare(b);
                              });
                              
                              const updatedStandards = existingStandards.join('; ');
                              updatedContent = htmlContent.replace(standardsRegex, `[${updatedStandards}]`);
                            } else {
                              // No standards bracket found, add one before KEY
                              const keyRegex = /KEY:/;
                              if (keyRegex.test(htmlContent)) {
                                updatedContent = htmlContent.replace(keyRegex, `[${code}]\nKEY:`);
                              }
                            }
                            
                            // Use onRestoreStandard if available (updates both content AND filteredOutStandards)
                            if (onRestoreStandard) {
                              onRestoreStandard(code, updatedContent);
                            } else if (onChange) {
                              onChange(updatedContent);
                            }
                          }}
                          style={{
                            padding: 0,
                            background: 'transparent',
                            border: 'none',
                            color: '#059669',
                            cursor: 'pointer',
                            fontSize: 14,
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#d1fae5';
                            e.currentTarget.style.color = '#047857';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#059669';
                          }}
                          title="Restore to aligned standards"
                        >
                          +
                        </button>
                      )}
                    </span>
                    
                    {/* Tooltip */}
                    {isFilteredHovered && description !== '(Description not available)' && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: 8,
                        padding: '8px 12px',
                        background: '#1e293b',
                        color: '#fff',
                        fontSize: 11,
                        lineHeight: 1.5,
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        zIndex: 1001,
                        pointerEvents: 'none',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        minWidth: 200,
                        maxWidth: 400
                      }}>
                        {description}
                        {/* Arrow */}
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 0,
                          height: 0,
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderTop: '6px solid #1e293b'
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
