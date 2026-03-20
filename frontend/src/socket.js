import { io } from "socket.io-client";

export const socket = io("https://poker-planning-1.onrender.com", {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
});