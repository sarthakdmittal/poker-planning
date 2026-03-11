// Card.jsx
import React from 'react';

export default function Card({ value, onClick, selected }) {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Card clicked:", value);
    onClick(value);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick(e);
        }
      }}
      className={`card ${selected ? 'selected' : ''}`}
      style={{
        margin: '8px',
        padding: '16px 24px',
        fontSize: '20px',
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
        minWidth: '60px',
        textAlign: 'center',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = 'white';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
        }
      }}
    >
      {value}
    </div>
  );
}