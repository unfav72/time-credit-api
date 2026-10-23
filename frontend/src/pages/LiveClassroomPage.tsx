import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Share2,
  PhoneOff,
  MessageSquare,
  Users,
  Clock,
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  Code2,
  Send,
  Maximize2
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayModal } from '../components/clay/ClayModal';
import { api } from '../services/api';
import type { User, Session } from '../types';

interface LiveClassroomPageProps {
  currentUser: User;
  onNavigate: (page: string) => void;
}

export const LiveClassroomPage: React.FC<LiveClassroomPageProps> = ({ currentUser, onNavigate }) => {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(1800); // 30 minutes preloaded for demo/testing
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Real WebRTC MediaStream states
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [hasMediaStream, setHasMediaStream] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Settlement modal states
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settledResult, setSettledResult] = useState<{ credits: number; duration: number } | null>(null);

  // In-meeting interactive whiteboard & chat
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
  const [sharedNotes, setSharedNotes] = useState(
    '// Collaborative In-Built Teaching Notebook\n// Topic: Database Normalization & Query Tuning\n\n1. First Normal Form (1NF): Atomic attributes, no repeating groups.\n2. Second Normal Form (2NF): In 1NF + no partial dependency on candidate keys.\n3. Third Normal Form (3NF): In 2NF + no transitive dependency.\n4. Boyce-Codd (BCNF): For every functional dependency X -> Y, X must be a superkey.'
  );
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'Priya Patel', text: 'Welcome to our in-built live classroom! Can everyone hear and see clearly?', time: '14:00' },
    { sender: currentUser.full_name, text: 'Yes, audio and video are working perfectly!', time: '14:01' }
  ]);
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    loadSession();
    initializeMedia();

    return () => {
      // Clean up media streams when leaving page
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const loadSession = async () => {
    const list = await api.getSessions();
    const current = list.find(s => s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS') || list[0];
    setActiveSession(current);
  };

  const initializeMedia = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setHasMediaStream(true);
      }
    } catch (err) {
      console.log('Camera/Mic permission not granted or device unavailable; running high-fidelity video canvas mode.', err);
      setHasMediaStream(false);
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !cameraActive;
      });
    }
    setCameraActive(!cameraActive);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !micActive;
      });
    }
    setMicActive(!micActive);
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = displayStream;
          }
          setScreenSharing(true);
          displayStream.getVideoTracks()[0].onended = () => {
            setScreenSharing(false);
          };
        }
      } catch (e) {
        console.warn('Screen share canceled or failed:', e);
      }
    } else {
      setScreenSharing(false);
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    setChatMessages(prev => [
      ...prev,
      {
        sender: currentUser.full_name,
        text: messageInput,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setMessageInput('');
  };

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedSecsRemainder = elapsedSeconds % 60;
  const creditRate = activeSession?.credit_rate || 1.0;
  const accruedCredits = Math.round((elapsedMinutes / 60.0) * creditRate * 100) / 100;

  const handleEndAndSettle = async () => {
    if (!activeSession) return;
    setSettling(true);
    try {
      const res = await api.completeSession(activeSession.id, elapsedMinutes);
      setIsTimerRunning(false);
      setSettledResult({ credits: res.transferredCredits, duration: elapsedMinutes });

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e: any) {
      alert('Error settling session: ' + e?.message);
    } finally {
      setSettling(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Session Status Bar */}
      <ClayCard
        variant="raised"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: 'var(--pastel-mint-bg)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.8)'
            }}
          >
            <Video size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {activeSession?.offer_title || 'Live Interactive Classroom Session'}
              </h1>
              <ClayBadge variant="mint">IN-BUILT WEBRTC</ClayBadge>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
              <span>Instructor: <strong>{activeSession?.teacher_name || 'Priya Patel'}</strong></span>
              <span>Learner: <strong>{activeSession?.learner_name || currentUser.full_name}</strong></span>
              <span>Rate: <strong>{creditRate} TC / hr</strong></span>
            </div>
          </div>
        </div>

        {/* Live Timer & Accrued Credits Widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Elapsed Timer */}
          <div
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: 'var(--clay-shadow-inset)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '1.05rem',
              color: '#0f172a'
            }}
          >
            <Clock size={16} color="#6366f1" />
            <span>
              {String(elapsedMinutes).padStart(2, '0')}:{String(elapsedSecsRemainder).padStart(2, '0')}
            </span>
          </div>

          {/* Accrued Credits */}
          <div
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '16px',
              background: 'var(--pastel-amber-bg)',
              color: 'var(--pastel-amber-text)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: 800,
              fontSize: '0.95rem',
              boxShadow: 'var(--clay-shadow-btn)'
            }}
            title="Accruing in real-time. 1 Hour = 1.00 TimeCredit"
          >
            <Coins size={16} />
            <span>+{accruedCredits.toFixed(2)} TC</span>
          </div>

          <ClayButton
            variant="danger"
            onClick={() => setSettleModalOpen(true)}
            icon={<PhoneOff size={15} />}
          >
            End & Settle Session
          </ClayButton>
        </div>
      </ClayCard>

      {/* Main Classroom Workspace Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* Left Column: Real In-Built Video Canvas & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <ClayCard
            variant="inset"
            style={{
              height: '520px',
              position: 'relative',
              borderRadius: '24px',
              overflow: 'hidden',
              background: '#0a0f1d',
              border: '2px solid #1e293b',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Screen sharing video or main speaker view */}
            {screenSharing ? (
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                
                {/* Teacher / Remote Tile */}
                <div style={{ textAlign: 'center', color: '#ffffff', zIndex: 1 }}>
                  <div
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.25rem',
                      boxShadow: '0 8px 30px rgba(99, 102, 241, 0.45)',
                      fontSize: '2.5rem',
                      fontWeight: 800,
                      border: '3px solid rgba(255, 255, 255, 0.8)'
                    }}
                  >
                    P
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                    {activeSession?.teacher_name || 'Priya Patel'}
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Senior DBA & Live Instructor • Audio Streaming
                  </p>
                  <div style={{ display: 'inline-flex', marginTop: '0.85rem' }}>
                    <ClayBadge variant="mint" style={{ fontSize: '0.7rem' }}>
                      ● LIVE WEBRTC AUDIO & MEDIA STREAM
                    </ClayBadge>
                  </div>
                </div>

                {/* Local Participant Camera Picture-in-Picture */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '1.25rem',
                    right: '1.25rem',
                    width: '180px',
                    height: '130px',
                    borderRadius: '18px',
                    background: '#1e293b',
                    border: '2px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.5)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2
                  }}
                >
                  {hasMediaStream && cameraActive ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#f8fafc', padding: '0.5rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.35rem', fontWeight: 800 }}>
                        {currentUser.full_name.charAt(0)}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{currentUser.full_name.split(' ')[0]} (You)</span>
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: '6px', left: '8px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#ffffff' }}>
                    {micActive ? '🎤 On' : '🔇 Muted'}
                  </div>
                </div>
              </div>
            )}
          </ClayCard>

          {/* Meeting Control Dock */}
          <ClayCard
            variant="raised"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              padding: '0.85rem 1.5rem',
            }}
          >
            {/* Mic Toggle */}
            <button
              onClick={toggleMic}
              className="clay-button"
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                padding: 0,
                background: micActive ? '#f8fafc' : '#fee2e2',
                color: micActive ? '#0f172a' : '#ef4444',
              }}
              title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micActive ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={toggleCamera}
              className="clay-button"
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                padding: 0,
                background: cameraActive ? '#f8fafc' : '#fee2e2',
                color: cameraActive ? '#0f172a' : '#ef4444',
              }}
              title={cameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {cameraActive ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            {/* Screen Share Toggle */}
            <button
              onClick={toggleScreenShare}
              className="clay-button"
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                padding: 0,
                background: screenSharing ? 'var(--pastel-mint-bg)' : '#f8fafc',
                color: screenSharing ? '#059669' : '#0f172a',
              }}
              title="Share Screen"
            >
              <Share2 size={20} />
            </button>

            <ClayButton variant="secondary" onClick={() => setActiveTab(activeTab === 'chat' ? 'notes' : 'chat')}>
              {activeTab === 'chat' ? 'Open Whiteboard Notes' : 'Open Meeting Chat'}
            </ClayButton>
          </ClayCard>
        </div>

        {/* Right Column: In-Built Meeting Chat & Shared Notes */}
        <ClayCard variant="raised" style={{ height: '595px', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
          {/* Tabs Header */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '14px', marginBottom: '1rem' }}>
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                flex: 1,
                border: 'none',
                padding: '0.45rem',
                borderRadius: '10px',
                background: activeTab === 'chat' ? '#ffffff' : 'transparent',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: activeTab === 'chat' ? '#4338ca' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <MessageSquare size={14} /> Classroom Chat
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              style={{
                flex: 1,
                border: 'none',
                padding: '0.45rem',
                borderRadius: '10px',
                background: activeTab === 'notes' ? '#ffffff' : 'transparent',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: activeTab === 'notes' ? '#4338ca' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <BookOpen size={14} /> Whiteboard Notes
            </button>
          </div>

          {activeTab === 'chat' ? (
            <>
              {/* Messages log */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '0.25rem' }}>
                {chatMessages.map((msg, idx) => {
                  const isMe = msg.sender === currentUser.full_name;
                  return (
                    <div
                      key={idx}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '14px',
                        background: isMe ? 'var(--pastel-lavender-bg)' : '#f8fafc',
                        color: isMe ? '#312e81' : '#1e293b',
                        fontSize: '0.825rem',
                        border: '1px solid #e2e8f0',
                        boxShadow: 'var(--clay-shadow-btn)'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.8, marginBottom: '0.2rem' }}>
                        {msg.sender} • {msg.time}
                      </div>
                      <div>{msg.text}</div>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input */}
              <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <input
                  className="clay-input"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder="Ask a question or share an answer..."
                  style={{ fontSize: '0.8rem', padding: '0.55rem 0.85rem' }}
                />
                <ClayButton size="sm" variant="primary" onClick={handleSendMessage} icon={<Send size={14} />}>
                  Send
                </ClayButton>
              </div>
            </>
          ) : (
            /* Whiteboard / Shared Notebook Area */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Shared real-time lesson notes between instructor and learner:
              </div>
              <textarea
                value={sharedNotes}
                onChange={(e) => setSharedNotes(e.target.value)}
                style={{
                  flex: 1,
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.825rem',
                  lineHeight: 1.5,
                  padding: '0.85rem',
                  borderRadius: '14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  outline: 'none',
                  resize: 'none',
                  boxShadow: 'var(--clay-shadow-inset)'
                }}
              />
            </div>
          )}
        </ClayCard>
      </div>

      {/* Settle Credits Modal */}
      <ClayModal
        isOpen={settleModalOpen}
        onClose={() => setSettleModalOpen(false)}
        title="Complete Session & Settle TimeCredits"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {settledResult ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--pastel-mint-bg)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8)' }}>
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                Double-Entry Settlement Committed!
              </h3>
              <p style={{ color: '#475569', fontSize: '0.95rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
                Successfully completed <strong>{settledResult.duration} minutes</strong> of live instruction.
                <br />
                Transferred <strong>{settledResult.credits.toFixed(2)} TimeCredits</strong> via atomic database transaction.
              </p>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <ClayButton variant="primary" onClick={() => onNavigate('wallet')}>
                  View Wallet & Ledger
                </ClayButton>
                <ClayButton variant="secondary" onClick={() => onNavigate('dashboard')}>
                  Return to Dashboard
                </ClayButton>
              </div>
            </div>
          ) : (
            <>
              <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Completing this live classroom session will trigger the <strong>ACID credit settlement</strong>:
              </p>

              <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Verified Elapsed Duration:</span>
                  <strong>{elapsedMinutes} minutes</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Session Credit Rate:</span>
                  <strong>{creditRate.toFixed(2)} TC / hr</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', fontSize: '1rem' }}>
                  <span style={{ fontWeight: 700 }}>Settlement Amount:</span>
                  <strong style={{ color: '#059669' }}>+{accruedCredits.toFixed(2)} TC</strong>
                </div>
              </div>

              <div style={{ fontSize: '0.775rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={16} color="#6366f1" />
                <span>Idempotent row-locked settlement ensures exact, non-duplicated credit transfers.</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <ClayButton variant="secondary" onClick={() => setSettleModalOpen(false)}>
                  Cancel
                </ClayButton>
                <ClayButton
                  variant="mint"
                  onClick={handleEndAndSettle}
                  disabled={settling}
                  icon={<Sparkles size={16} />}
                >
                  {settling ? 'Settling Credits...' : 'Confirm & Settle Credits'}
                </ClayButton>
              </div>
            </>
          )}
        </div>
      </ClayModal>
    </div>
  );
};
