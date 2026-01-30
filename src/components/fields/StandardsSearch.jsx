import { useState, useEffect, useRef } from 'react';

/**
 * StandardsSearch - A compact standards search component for single standard selection
 * Used in MCQ fields for per-question standard assignment
 */
export default function StandardsSearch({
  selectedStandard,
  onStandardChange
}) {
  const [framework, setFramework] = useState('CCSS');
  const [standardsData, setStandardsData] = useState([]);
  const [mappingData, setMappingData] = useState([]);
  const [inputCode, setInputCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  
  // Available frameworks
  const frameworks = ['CCSS', 'TEKS', 'BEST', 'BLOOM'];

  // Filter out category headers
  const isValidStandardCode = (code) => {
    if (!code) return false;
    if (code.endsWith(':')) return false;
    if (code.includes('Acquisition') || code.includes('Knowledge of Language') || 
        code.includes('Text Types') || code.includes('Comprehension and') ||
        code.includes('Conventions of') || code.includes('Integration of') ||
        code.includes('Key Ideas') || code.includes('Craft and Structure') ||
        code.includes('Speaking and Listening') || code.includes('Presentation of')) {
      return false;
    }
    return true;
  };

  // Load standards-mapping.csv on mount
  useEffect(() => {
    const loadStandards = async () => {
      try {
        const response = await fetch(new URL('../../assets/standards-mapping.csv', import.meta.url).href);
        const text = await response.text();
        
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const ccssCodeIndex = headers.indexOf('ccss_code');
        const ccssDescIndex = headers.indexOf('ccss_description');
        const frameworkIndex = headers.indexOf('framework');
        const frameworkCodeIndex = headers.indexOf('framework_code');
        const frameworkDescIndex = headers.indexOf('framework_description');
        
        const parsed = [];
        const seen = new Set();
        const mappings = [];
        
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
          
          const ccssCode = values[ccssCodeIndex];
          const frameworkCode = values[frameworkCodeIndex];
          if (ccssCode || frameworkCode) {
            mappings.push({
              ccssCode: ccssCode || '',
              ccssDesc: values[ccssDescIndex] || '',
              framework: values[frameworkIndex] || '',
              frameworkCode: frameworkCode || '',
              frameworkDesc: values[frameworkDescIndex] || ''
            });
          }
          
          const ccssDesc = values[ccssDescIndex];
          if (framework === 'CCSS' && ccssCode && isValidStandardCode(ccssCode) && !seen.has(ccssCode)) {
            parsed.push({ 
              fullCode: ccssCode, 
              statement: ccssDesc || '(No description available)' 
            });
            seen.add(ccssCode);
          }
          
          const frameworkValue = values[frameworkIndex];
          const frameworkDesc = values[frameworkDescIndex];
          if (framework !== 'CCSS' && frameworkValue === framework && frameworkCode && isValidStandardCode(frameworkCode) && !seen.has(frameworkCode)) {
            parsed.push({ 
              fullCode: frameworkCode, 
              statement: frameworkDesc || '(No description available)' 
            });
            seen.add(frameworkCode);
          }
        }
        
        setStandardsData(parsed);
        setMappingData(mappings);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading standards:', err);
        setIsLoading(false);
      }
    };
    
    loadStandards();
  }, [framework]);

  const handleInputChange = (e) => {
    const input = e.target.value;
    setInputCode(input);
    
    if (input.trim().length > 0) {
      const filtered = standardsData
        .filter(s => s.fullCode.toLowerCase().includes(input.toLowerCase()))
        .slice(0, 50);
      
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        suggestionsRef.current && !suggestionsRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRelatedStandards = (code) => {
    const related = new Set();
    const isCCSS = code.startsWith('CCSS.');
    
    if (isCCSS) {
      const matchingRows = mappingData.filter(row => row.ccssCode === code);
      matchingRows.forEach(row => {
        if (row.frameworkCode && isValidStandardCode(row.frameworkCode)) {
          related.add(row.frameworkCode);
        }
      });
    } else {
      const rowsWithThisCode = mappingData.filter(row => row.frameworkCode === code);
      const ccssCodes = new Set();
      
      rowsWithThisCode.forEach(row => {
        if (row.ccssCode && isValidStandardCode(row.ccssCode)) {
          ccssCodes.add(row.ccssCode);
        }
      });
      
      ccssCodes.forEach(ccssCode => {
        related.add(ccssCode);
        
        const allMappings = mappingData.filter(row => row.ccssCode === ccssCode);
        allMappings.forEach(row => {
          if (row.frameworkCode && isValidStandardCode(row.frameworkCode) && row.frameworkCode !== code) {
            related.add(row.frameworkCode);
          }
        });
      });
    }
    
    return Array.from(related).sort();
  };

  const handleSelectSuggestion = (standard) => {
    const relatedStandards = getRelatedStandards(standard.fullCode);
    onStandardChange({
      ...standard,
      relatedStandards
    });
    setInputCode('');
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    onStandardChange(null);
    setInputCode('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions && selectedIndex > 0) {
        setSelectedIndex(prev => prev - 1);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <select
          value={framework}
          onChange={(e) => {
            setFramework(e.target.value);
            setInputCode('');
            setSuggestions([]);
            setShowSuggestions(false);
          }}
          disabled={isLoading}
          style={{
            padding: '6px 8px',
            fontSize: 13,
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            outline: 'none',
            background: '#fff',
            cursor: 'pointer',
            minWidth: 80
          }}
        >
          {frameworks.map(fw => (
            <option key={fw} value={fw}>{fw}</option>
          ))}
        </select>
        
      {selectedStandard ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 6,
          fontSize: 13
        }}>
          <span style={{ 
            fontWeight: 600, 
            color: '#1e40af',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {selectedStandard.fullCode}
          </span>
          <button
            type="button"
            onClick={handleClear}
            style={{
              marginLeft: 'auto',
              padding: '2px 6px',
              background: 'transparent',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
            title="Clear standard"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="text"
            value={inputCode}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputCode.trim() && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder="Search standard (optional)..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: 13,
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                maxHeight: 200,
                overflowY: 'auto',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 1000
              }}
            >
              {suggestions.map((standard, index) => (
                <div
                  key={standard.fullCode}
                  onClick={() => handleSelectSuggestion(standard)}
                  style={{
                    padding: '8px 10px',
                    cursor: 'pointer',
                    background: index === selectedIndex ? '#eff6ff' : 'transparent',
                    borderBottom: index < suggestions.length - 1 ? '1px solid #e2e8f0' : 'none',
                    fontSize: 12
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
                    {standard.fullCode}
                  </div>
                  <div style={{ 
                    color: '#64748b',
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {standard.statement}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
      
      {/* Show description below the search/selected standard */}
      {selectedStandard && (
        <div style={{
          marginTop: 4,
          padding: '6px 8px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          fontSize: 11,
          color: '#475569',
          lineHeight: 1.4
        }}>
          {selectedStandard.statement}
        </div>
      )}
    </div>
  );
}
