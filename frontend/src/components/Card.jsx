// Card.jsx
import React from 'react';

export default function Card({ value, onClick, selected }) {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Card clicked:", value);
    onClick(value);
  };

  // Format the display value - handle both numbers and strings
  const displayValue = value?.toString() || '?';

  // Determine if this is a text-based card (like T-shirt sizes)
  const isTextCard = typeof value === 'string' && isNaN(Number(value));

  // Adjust font size based on content length
  const getFontSize = () => {
    if (isTextCard) {
      const length = displayValue.length;
      if (length > 4) return '18px';
      if (length > 2) return '22px';
      return '26px';
    }
    return '24px';
  };

  // Base styles
  const baseStyles = {
    margin: '8px',
    padding: isTextCard ? '16px 20px' : '16px 24px',
    fontSize: getFontSize(),
    fontWeight: 'bold',
    borderRadius: '12px',
    border: selected ? '3px solid #4CAF50' : '2px solid #ddd',
    backgroundColor: selected ? '#4CAF50' : 'white',
    color: selected ? 'white' : '#333',
    boxShadow: selected
      ? '0 4px 12px rgba(76, 175, 80, 0.3)'
      : '0 2px 6px rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: isTextCard ? '80px' : '60px',
    minHeight: '60px',
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    outline: 'none',
  };

  // Add special styling for text cards
  if (isTextCard && !selected) {
    baseStyles.background = 'linear-gradient(135deg, #f8f9fa, #ffffff)';
    baseStyles.borderColor = '#c0c0c0';
  }

  // Add special styling for very long text
  if (displayValue.length > 6) {
    baseStyles.fontSize = '14px';
    baseStyles.padding = '12px 16px';
  }

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { // Changed from onKeyPress to onKeyDown (better support)
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e);
        }
      }}
      className={`card ${selected ? 'selected' : ''} ${isTextCard ? 'text-card' : 'number-card'}`}
      style={baseStyles}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';

          // Special hover for text cards
          if (isTextCard) {
            e.currentTarget.style.background = '#f0f0f0';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = 'white';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';

          // Restore special background for text cards
          if (isTextCard) {
            e.currentTarget.style.background = 'linear-gradient(135deg, #f8f9fa, #ffffff)';
          }
        }
      }}
      title={isTextCard ? `T-shirt size: ${displayValue}` : `Points: ${displayValue}`}
    >
      {displayValue}
    </div>
  );
}