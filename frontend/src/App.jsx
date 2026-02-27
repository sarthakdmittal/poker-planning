import { useState } from "react";
import Join from "./components/Join.jsx";
import PokerRoom from "./components/PokerRoom.jsx";

function App() {
  const [name, setName] = useState("");

  return !name ? <Join setName={setName} /> : <PokerRoom name={name} />;
}

export default App;
