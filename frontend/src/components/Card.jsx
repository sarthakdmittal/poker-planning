export default function Card({ value, onClick }) {
  return (
    <button
      onClick={() => onClick(value)}
      style={{ margin: 5, padding: 15, fontSize: 18 }}
    >
      {value}
    </button>
  );
}
