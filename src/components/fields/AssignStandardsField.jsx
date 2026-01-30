import { useState, useEffect, useRef } from 'react';
import BaseField from './BaseField';

/**
 * AssignStandardsField - A field that allows designers to assign educational standards
 * Users can input a standard code with autocomplete, which is looked up in the standards-mapping.csv file
 * Up to 10 standards can be added
 */
export default function AssignStandardsField({
  field,
  value = [],
  onChange,
  onEdit,
  onDelete,
  onGenerateAI,
  onAIConfig,
  isGenerating,
  hasGenerated
}) {
  const [standardsData, setStandardsData] = useState([]);
  const [frameworks, setFrameworks] = useState([]);
  const [selectedFramework, setSelectedFramework] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Framework display names
  const frameworkDisplayNames = {
    'CCSS': 'CCSS',
    'BEST': 'B.E.S.T.',
    'TEKS': 'TEKS',
    'BLOOM': 'BLOOM'
  };

  // Filter out category headers (codes ending with ':' or looking like headers)
  const isValidStandardCode = (code) => {
    if (!code) return false;
    // Exclude codes that end with ':'
    if (code.endsWith(':')) return false;
    // Exclude codes that are just category names without proper formatting
    if (code.includes('Acquisition') || code.includes('Knowledge of Language') || 
        code.includes('Text Types') || code.includes('Comprehension and') ||
        code.includes('Conventions of') || code.includes('Integration of') ||
        code.includes('Key Ideas') || code.includes('Craft and Structure') ||
        code.includes('Speaking and Listening') || code.includes('Presentation of')) {
      return false;
    }
    return true;
  };

  // Load standards from both CSV files on mount
  useEffect(() => {
    const loadStandards = async () => {
      try {
        const parsed = [];
        const frameworkSet = new Set();
        const seen = new Set(); // Track unique codes to avoid duplicates
        
        // Load CCSS, BEST, TEKS from standards.csv
        const standardsResponse = await fetch(new URL('../../assets/standards.csv', import.meta.url).href);
        const standardsText = await standardsResponse.text();
        const standardsLines = standardsText.split('\n');
        const standardsHeaders = standardsLines[0].split(',').map(h => h.trim());
        
        const initiativeNameIndex = standardsHeaders.findIndex(h => h.includes('initiative_name'));
        const fullCodeIndex = standardsHeaders.findIndex(h => h.includes('full_code'));
        const statementIndex = standardsHeaders.findIndex(h => h.includes('standard_statement'));
        
        for (let i = 1; i < standardsLines.length; i++) {
          const line = standardsLines[i];
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
          
          const initiativeName = values[initiativeNameIndex] || '';
          const fullCode = values[fullCodeIndex] || '';
          const statement = values[statementIndex] || '';
          
          // Map framework names to our standardized names
          let normalizedFramework = '';
          if (initiativeName === 'CCSS') {
            normalizedFramework = 'CCSS';
          } else if (initiativeName === 'Florida BEST' || initiativeName.includes('BEST')) {
            normalizedFramework = 'BEST';
          } else if (initiativeName === 'Texas Education Agency' || initiativeName.includes('TEKS')) {
            normalizedFramework = 'TEKS';
          }
          
          if (!normalizedFramework) continue;
          
          frameworkSet.add(normalizedFramework);
          
          if (fullCode && isValidStandardCode(fullCode) && !seen.has(fullCode)) {
            parsed.push({ 
              initiativeName: normalizedFramework,
              fullCode, 
              statement: statement || '(No description available)' 
            });
            seen.add(fullCode);
          }
        }
        
        // Load BLOOM from standards-mapping.csv
        const mappingResponse = await fetch(new URL('../../assets/standards-mapping.csv', import.meta.url).href);
        const mappingText = await mappingResponse.text();
        const mappingLines = mappingText.split('\n');
        const mappingHeaders = mappingLines[0].split(',').map(h => h.trim());
        
        const frameworkIndex = mappingHeaders.indexOf('framework');
        const frameworkCodeIndex = mappingHeaders.indexOf('framework_code');
        const frameworkDescIndex = mappingHeaders.indexOf('framework_description');
        
        for (let i = 1; i < mappingLines.length; i++) {
          const line = mappingLines[i];
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
          
          const framework = values[frameworkIndex] || '';
          const frameworkCode = values[frameworkCodeIndex] || '';
          const frameworkDesc = values[frameworkDescIndex] || '';
          
          if (framework !== 'BLOOM') continue;
          
          frameworkSet.add('BLOOM');
          
          if (frameworkCode && isValidStandardCode(frameworkCode) && !seen.has(frameworkCode)) {
            parsed.push({ 
              initiativeName: 'BLOOM',
              fullCode: frameworkCode, 
              statement: frameworkDesc || '(No description available)' 
            });
            seen.add(frameworkCode);
          }
        }
        
        // Sort frameworks with CCSS first
        const sortedFrameworks = Array.from(frameworkSet).sort((a, b) => {
          if (a === 'CCSS') return -1;
          if (b === 'CCSS') return 1;
          return a.localeCompare(b);
        });
        
        setStandardsData(parsed);
        setFrameworks(sortedFrameworks);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading standards:', err);
        setError('Failed to load standards data');
        setIsLoading(false);
      }
    };
    
    loadStandards();
  }, []);

  // Handle input change and filter suggestions
  const handleInputChange = (e) => {
    const input = e.target.value;
    setInputCode(input);
    setError('');
    
    if (input.trim().length > 0) {
      // Filter standards by full_code (case-insensitive, contains match)
      let filtered = standardsData;
      
      // Filter by selected framework if one is chosen
      if (selectedFramework) {
        filtered = filtered.filter(s => s.initiativeName === selectedFramework);
      }
      
      // Filter by search input
      filtered = filtered
        .filter(s => s.fullCode.toLowerCase().includes(input.toLowerCase()))
        .slice(0, 100); // Limit to 100 suggestions
      
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle clicking outside to close suggestions
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

  const handleSelectSuggestion = (standard) => {
    setInputCode(standard.fullCode);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    // Auto-add after selection
    addStandard(standard);
  };

  const addStandard = (standard) => {
    setError('');
    
    if (value.length >= 10) {
      setError('Maximum of 10 standards allowed');
      return;
    }
    
    // Check if already added
    if (value.some(s => s.fullCode === standard.fullCode)) {
      setError('This standard has already been added');
      setInputCode('');
      return;
    }
    
    // Add the standard
    onChange([...value, standard]);
    setInputCode('');
  };

  const handleAddStandard = () => {
    setError('');
    
    if (!inputCode.trim()) {
      setError('Please enter a standard code');
      return;
    }
    
    if (value.length >= 10) {
      setError('Maximum of 10 standards allowed');
      return;
    }
    
    // Look up the standard in the loaded data (exact match)
    let found = standardsData.find(s => 
      s.fullCode.toLowerCase() === inputCode.trim().toLowerCase()
    );
    
    // If a framework is selected, only match within that framework
    if (selectedFramework && found) {
      if (found.initiativeName !== selectedFramework) {
        found = null;
      }
    }
    
    if (!found) {
      setError(`Standard "${inputCode}" not found${selectedFramework ? ` in ${selectedFramework}` : ''}`);
      return;
    }
    
    addStandard(found);
  };

  const handleRemoveStandard = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        handleAddStandard();
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
      if (showSuggestions) {
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <BaseField
      field={field}
      onEdit={onEdit}
      onDelete={onDelete}
      onGenerateAI={onGenerateAI}
      onAIConfig={onAIConfig}
      isGenerating={isGenerating}
      hasGenerated={hasGenerated}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Input section with framework dropdown and autocomplete */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', position: 'relative' }}>
          {/* Framework Dropdown */}
          <select
            value={selectedFramework}
            onChange={(e) => {
              setSelectedFramework(e.target.value);
              // Clear suggestions when framework changes
              setSuggestions([]);
              setShowSuggestions(false);
            }}
            disabled={isLoading}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--gray-300)',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              cursor: 'pointer',
              minWidth: '150px'
            }}
          >
            <option value="">All Frameworks</option>
            {frameworks.map(fw => (
              <option key={fw} value={fw}>{frameworkDisplayNames[fw] || fw}</option>
            ))}
          </select>
          
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              className="field-input"
              placeholder={field.placeholder || "Type to search standard codes (e.g., CCSS.CCRA.R.1)"}
              value={inputCode}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              disabled={isLoading || value.length >= 10}
              style={{
                opacity: value.length >= 10 ? 0.5 : 1,
                height: '40px',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              autoComplete="off"
            />
            
            {/* Autocomplete suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  marginTop: '4px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  zIndex: 10000
                }}
              >
                {suggestions.map((standard, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectSuggestion(standard)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: selectedIndex === index ? '#eff6ff' : 'white',
                      borderBottom: index < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div style={{ 
                      fontWeight: 600, 
                      fontSize: 13, 
                      color: '#1e293b',
                      marginBottom: 2
                    }}>
                      {standard.fullCode}
                    </div>
                    <div style={{ 
                      fontSize: 12, 
                      color: '#64748b',
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
            
            {error && (
              <p style={{ 
                color: '#dc2626', 
                fontSize: 12, 
                marginTop: 4,
                marginBottom: 0 
              }}>
                {error}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddStandard}
            disabled={isLoading || value.length >= 10}
            style={{
              padding: '0 16px',
              height: '40px',
              background: value.length >= 10 ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: value.length >= 10 ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}
          >
            Add
          </button>
        </div>

        {/* Standards list */}
        {value.length > 0 && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 8,
            marginTop: 4
          }}>
            {value.map((standard, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    marginBottom: 4
                  }}>
                    <span style={{ 
                      fontWeight: 600, 
                      fontSize: 13, 
                      color: '#1e293b'
                    }}>
                      {standard.fullCode}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: 13, 
                    color: '#475569',
                    lineHeight: 1.5
                  }}>
                    {standard.statement}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveStandard(index)}
                  style={{
                    padding: '4px 8px',
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    flexShrink: 0
                  }}
                  title="Remove standard"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Counter */}
        <div style={{ 
          fontSize: 12, 
          color: '#64748b',
          textAlign: 'right'
        }}>
          {value.length} / 10 standards
        </div>
      </div>
    </BaseField>
  );
}
