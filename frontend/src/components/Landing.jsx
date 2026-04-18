import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MdGroupAdd, MdMeetingRoom } from 'react-icons/md';
import { GiPokerHand } from 'react-icons/gi';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />
      <div className="landing-orb landing-orb-3" />

      <div className="landing-card">
        <div className="landing-logo">
          <GiPokerHand className="landing-logo-icon" />
        </div>
        <h1 className="landing-title">Planning Poker</h1>
        <p className="landing-subtitle">Estimate smarter, together</p>

        <div className="landing-options">
          <button className="landing-option create-option" onClick={() => navigate('/create-room')}>
            <div className="option-icon-wrap create-icon-wrap">
              <MdGroupAdd className="option-icon-svg" />
            </div>
            <h2>Create a Room</h2>
            <p>Start a new planning poker session</p>
            <span className="option-cta">Get started &rarr;</span>
          </button>

          <button className="landing-option join-option" onClick={() => navigate('/join-room')}>
            <div className="option-icon-wrap join-icon-wrap">
              <MdMeetingRoom className="option-icon-svg" />
            </div>
            <h2>Join a Room</h2>
            <p>Join an existing session with a room ID</p>
            <span className="option-cta">Join now &rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
}
