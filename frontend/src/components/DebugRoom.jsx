// components/DebugRoom.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from 'react-router-dom';

export default function DebugRoom({ name, onLeaveRoom }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("✅ DebugRoom mounted with:", { roomId, name });
    console.log("Current URL:", window.location.href);
  }, [roomId, name]);

  const handleLeave = () => {
    if (onLeaveRoom) onLeaveRoom();
    navigate('/');
  };

  return (
    <div style={{
      padding: '40px',
      fontFamily: 'Arial, sans-serif',
      background: '#f0f2f5',
      minHeight: '100vh'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>🎲 Debug Poker Room</h1>

        <div style={{ marginBottom: '20px', padding: '15px', background: '#e8f4fd', borderRadius: '8px' }}>
          <p><strong>Room ID:</strong> {roomId}</p>
          <p><strong>User Name:</strong> {name || 'No name provided'}</p>
          <p><strong>Counter:</strong> {count}</p>
        </div>

        <button
          onClick={() => setCount(c => c + 1)}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Increment Counter
        </button>

        <button
          onClick={handleLeave}
          style={{
            padding: '10px 20px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Leave Room
        </button>

        <div style={{ marginTop: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
          <h3>Debug Info:</h3>
          <pre style={{ background: '#333', color: '#fff', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
            {JSON.stringify({ roomId, name, count }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}