import { useState } from "react";
import Join from "./components/Join.jsx";
import PokerRoom from "./components/PokerRoom.jsx";
import '../jira-content.css';

function App() {
  const [name, setName] = useState("");

  return !name ? <div className="jira-content"><Join setName={setName} /></div> : <div className="jira-content"><PokerRoom name={name} /></div>;
}

export default App;
