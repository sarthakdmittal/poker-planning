import { socket } from "../socket";
import '../jira-content.css';

export default function Join({ setName }) {
  const join = (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    socket.emit("join", { name });
    setName(name);
  };

  return (
    <div className="center-join-container">
      <form onSubmit={join}>
        <h2>Join Planning Poker</h2>
        <input name="name" placeholder="Your name" required />
        <button>Join</button>
      </form>
    </div>
  );
}
