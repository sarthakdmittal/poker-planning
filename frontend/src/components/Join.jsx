import { socket } from "../socket";
import "../jira-content.css";

export default function Join({ setName }) {
  const join = (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;

    socket.emit("join", { name });
    setName(name);
  };

  return (
    <div className="join-page">
      <div className="join-card">
        <h1 className="join-title">Planning Poker</h1>
        <p className="join-subtitle">Enter your name to join the session</p>

        <form onSubmit={join} className="join-form">
          <input
            name="name"
            placeholder="Your name"
            className="join-input"
            autoComplete="off"
            required
          />

          <button className="join-button">
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}