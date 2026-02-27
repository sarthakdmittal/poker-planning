export default function Card({ value, onClick, selected }) {
  return (
    <button
      onClick={() => onClick(value)}
      style={{
        margin: 4,
        padding: '12px 24px',
        fontSize: 18,
        borderRadius: 8,
        border: selected ? '2px solid #1976d2' : '1px solid #ccc',
        background: selected ? '#1976d2' : '#fff',
        color: selected ? '#fff' : '#333',
        fontWeight: selected ? 'bold' : 'normal',
        boxShadow: selected ? '0 2px 8px #1976d2aa' : '0 1px 3px #ccc',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {value}
    </button>
  );
}
