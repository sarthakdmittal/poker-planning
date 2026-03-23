import { useEffect, useState } from "react";
import { useParams } from 'react-router-dom';
import { socket } from "../socket";
import PokerRoom from "./PokerRoom";
import SimplePokerRoom from "./SimplePokerRoom";

export default function RoomRouter({ name, onLeaveRoom }) {
  const { roomId } = useParams();
  const [jiraConnected, setJiraConnected] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (roomId) {
      // Request room info to check Jira connection status
      socket.emit("getRoomInfo", { roomId });

      const handleRoomInfo = (data) => {
        if (data && data.jiraConnected !== undefined) {
          setJiraConnected(data.jiraConnected);
          setIsLoading(false);
        }
      };

      socket.on("roomInfo", handleRoomInfo);

      return () => {
        socket.off("roomInfo", handleRoomInfo);
      };
    }
  }, [roomId]);

  if (isLoading) {
    return <div className="loading-indicator"><div className="spinner"></div><p>Loading room...</p></div>;
  }

  // Render appropriate component based on Jira connection status
  if (jiraConnected) {
    return <PokerRoom name={name} onLeaveRoom={onLeaveRoom} />;
  } else {
    return <SimplePokerRoom name={name} onLeaveRoom={onLeaveRoom} />;
  }
}