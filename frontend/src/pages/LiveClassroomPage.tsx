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
  Maximize2,
  Pen,
  CalendarCheck,
  Search,
  PlusCircle,
  PlayCircle
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayModal } from '../components/clay/ClayModal';
import { ClayInput } from '../components/clay/ClayInput';
import { api } from '../services/api';
import type { User, Session } from '../types';
import { CollaborativeWhiteboard } from '../components/CollaborativeWhiteboard';

interface LiveClassroomPageProps {
  currentUser: User;
  onNavigate: (page: string) => void;
}

export const LiveClassroomPage: React.FC<LiveClassroomPageProps> = ({ currentUser, onNavigate }) => {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Real WebRTC MediaStream states
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [hasMediaStream, setHasMediaStream] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // WebRTC P2P Two-Way Live Video Streaming states
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [reconnectKey, setReconnectKey] = useState(0);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const lastSignalIdRef = useRef<number>(0);

  const handleManualReconnect = async () => {
    setConnectionStatus('connecting');
    setHasRemoteVideo(false);
    setHasRemoteAudio(false);
    if (!streamRef.current) {
      await initializeMedia(true, true);
    }
    setReconnectKey(prev => prev + 1);
  };

  // Settlement modal states
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settledResult, setSettledResult] = useState<{ credits: number; duration: number } | null>(null);

  // In-meeting interactive whiteboard & chat
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard' | 'notes'>('whiteboard');
  const [sharedNotes, setSharedNotes] = useState(
    '// Collaborative In-Built Teaching Notebook\n// Take notes, share code snippets, and review topics discussed in this live class.\n'
  );
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([]);
  const [messageInput, setMessageInput] = useState('');

  // Host Live Teaching Session modal state directly on classroom
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [hostTitle, setHostTitle] = useState('');
  const [hostSkill, setHostSkill] = useState('');
  const [hostDuration, setHostDuration] = useState(60);
  const [hostRate, setHostRate] = useState(1.0);
  const [hostDesc, setHostDesc] = useState('');
  const [isHosting, setIsHosting] = useState(false);

  useEffect(() => {
    loadSession();

    return () => {
      stopAllMediaTracks();
    };
  }, []);

  const loadSession = async () => {
    setLoadingSession(true);
    try {
      const list = await api.getSessions();
      // Only select an active live session that is IN_PROGRESS or SCHEDULED
      const current = list.find(s => s.status === 'IN_PROGRESS' || s.status === 'SCHEDULED') || null;
      setActiveSession(current);

      if (current && current.status === 'IN_PROGRESS') {
        if (current.actual_start_at) {
          const diff = Math.max(0, Math.floor((Date.now() - new Date(current.actual_start_at).getTime()) / 1000));
          setElapsedSeconds(diff);
        }
        setIsTimerRunning(true);
        initializeMedia();
      } else {
        setIsTimerRunning(false);
        stopAllMediaTracks();
      }
    } catch (err) {
      console.warn('Could not load session:', err);
      setActiveSession(null);
    } finally {
      setLoadingSession(false);
    }
  };

  // Ensure screen sharing video element is attached when screenSharing changes
  useEffect(() => {
    if (screenSharing && screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
      screenVideoRef.current.play().catch(e => console.warn('Screen video play error:', e));
    }
  }, [screenSharing]);

  // Ensure local camera video element is attached when camera state changes
  useEffect(() => {
    if (cameraActive && localVideoRef.current && streamRef.current) {
      if (localVideoRef.current.srcObject !== streamRef.current) {
        localVideoRef.current.srcObject = streamRef.current;
      }
      localVideoRef.current.play().catch(e => console.warn('Local video play error:', e));
    }
  }, [cameraActive, hasMediaStream]);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Synchronize local audio/video tracks to active RTCPeerConnection
  const syncLocalTracksToPeer = (stream: MediaStream | null) => {
    if (!pcRef.current || !stream) return;
    try {
      const senders = pcRef.current.getSenders();
      stream.getTracks().forEach(track => {
        const existingSender = senders.find(s => s.track && s.track.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(err => console.warn('WebRTC replaceTrack error:', err));
        } else {
          pcRef.current?.addTrack(track, stream);
        }
      });
    } catch (e) {
      console.warn('Error syncing tracks to peer connection:', e);
    }
  };

  // Ensure remote video element is attached whenever remote stream updates
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().catch(e => console.warn('Remote video play error:', e));
    }
  }, [hasRemoteVideo, connectionStatus]);

  const stopAllMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      streamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      screenStreamRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      remoteStreamRef.current = null;
    }
    setHasMediaStream(false);
    setCameraActive(false);
    setMicActive(false);
    setScreenSharing(false);
    setHasRemoteVideo(false);
    setHasRemoteAudio(false);
    setConnectionStatus('idle');
  };

  const initializeMedia = async (forceVideo = true, forceAudio = true) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia not supported in this environment');
        setHasMediaStream(false);
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: forceVideo,
          audio: forceAudio
        });
      } catch (bothErr) {
        console.warn('Combined audio/video request failed, trying video only:', bothErr);
        if (forceVideo) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      if (stream) {
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.warn('Local video play error:', e));
        }
        setHasMediaStream(true);
        setCameraActive(true);
        setMicActive(stream.getAudioTracks().length > 0);
        syncLocalTracksToPeer(stream);
      }
    } catch (err: any) {
      console.warn('Camera/Mic permission not granted or device unavailable:', err);
      setHasMediaStream(false);
      setCameraActive(false);
    }
  };

  const toggleCamera = async () => {
    const nextState = !cameraActive;
    if (!streamRef.current || streamRef.current.getVideoTracks().length === 0) {
      if (nextState) {
        await initializeMedia(true, micActive);
      }
      return;
    }

    const videoTracks = streamRef.current.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = nextState;
    });

    if (localVideoRef.current && streamRef.current) {
      localVideoRef.current.srcObject = streamRef.current;
    }

    setCameraActive(nextState);
    syncLocalTracksToPeer(streamRef.current);
  };

  const toggleMic = () => {
    if (!streamRef.current) return;
    const audioTracks = streamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;

    const nextState = !micActive;
    audioTracks.forEach(track => {
      track.enabled = nextState;
    });
    setMicActive(nextState);
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setScreenSharing(false);
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Screen sharing is not supported by your current browser.');
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      screenStreamRef.current = screenStream;
      setScreenSharing(true);

      screenStream.getVideoTracks()[0].onended = () => {
        setScreenSharing(false);
        screenStreamRef.current = null;
      };
    } catch (err: any) {
      console.warn('Screen share canceled or failed:', err);
      setScreenSharing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    const text = messageInput.trim();
    setMessageInput('');

    const newMsg = {
      sender: currentUser.full_name,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, newMsg]);

    if (activeSession) {
      try {
        await api.sendMeetingChat(activeSession.id, text);
      } catch {
        // Silently handled
      }
    }
  };

  // Poll real-time in-meeting chat
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'IN_PROGRESS') return;
    const loadChat = async () => {
      try {
        const msgs = await api.getMeetingChat(activeSession.id);
        if (msgs && msgs.length > 0) {
          setChatMessages(msgs.map(m => ({
            sender: m.sender_name,
            text: m.message,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
        }
      } catch {
        // Silently ignore
      }
    };
    loadChat();
    const interval = setInterval(loadChat, 3500);
    return () => clearInterval(interval);
  }, [activeSession]);

  // WebRTC P2P Two-Way Live Audio & Video Streaming Effect
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'IN_PROGRESS') return;

    let isMounted = true;
    const queuedCandidates: any[] = [];
    lastSignalIdRef.current = 0;

    const isHost = activeSession.teacher_id === currentUser.id || activeSession.teacher_name === currentUser.full_name;

    // 1. Initialize PeerConnection with Google STUN + OpenRelay TURN for guaranteed cross-device NAT traversal
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp'
          ],
          username: 'openrelay',
          credential: 'openrelay'
        }
      ],
      iceCandidatePoolSize: 10
    });
    pcRef.current = pc;
    setConnectionStatus('connecting');

    // Pre-allocate bidirectional audio and video channels so SDP offer/answer always carries video m-lines
    try {
      pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    } catch (tErr) {
      console.warn('WebRTC transceiver pre-allocation:', tErr);
    }

    // Attach local stream tracks to PC if already available
    if (streamRef.current) {
      const senders = pc.getSenders();
      streamRef.current.getTracks().forEach(track => {
        const sender = senders.find(s => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(console.warn);
        } else {
          try { pc.addTrack(track, streamRef.current!); } catch {}
        }
      });
    }

    // Receive remote stream tracks
    pc.ontrack = (event) => {
      if (!isMounted) return;
      console.log('[WebRTC P2P] Inbound track received:', event.track.kind, event.streams);

      let stream: MediaStream | null = null;
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
      } else {
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        remoteStreamRef.current.addTrack(event.track);
        stream = remoteStreamRef.current;
      }
      remoteStreamRef.current = stream;

      if (remoteVideoRef.current && stream) {
        remoteVideoRef.current.srcObject = stream;
        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn('Autoplay blocked with audio, falling back to muted play:', err);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.muted = true;
              remoteVideoRef.current.play().catch(console.warn);
            }
          });
        }
      }

      if (event.track.kind === 'video') {
        setHasRemoteVideo(true);
      }
      if (event.track.kind === 'audio') {
        setHasRemoteAudio(true);
      }
      setConnectionStatus('connected');
    };

    // Send local ICE candidates to peer
    pc.onicecandidate = (event) => {
      if (event.candidate && activeSession) {
        const candData = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment
        };
        api.sendSignal(activeSession.id, 'ice-candidate', candData).catch(console.warn);
      }
    };

    // Connection state tracker
    pc.onconnectionstatechange = () => {
      if (!isMounted) return;
      console.log('[WebRTC P2P] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatus('connecting');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setConnectionStatus('failed');
      }
    };

    const sendOffer = async () => {
      if (!pcRef.current) return;
      try {
        console.log('[WebRTC] Creating and sending offer...');
        const offer = await pcRef.current.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pcRef.current.setLocalDescription(offer);
        const offerData = { type: offer.type, sdp: offer.sdp };
        await api.sendSignal(activeSession.id, 'offer', offerData);
      } catch (err) {
        console.warn('Error creating WebRTC offer:', err);
      }
    };

    // Broadcast presence
    api.sendSignal(activeSession.id, 'join', { user_id: currentUser.id, role: isHost ? 'teacher' : 'learner' }).catch(() => {});

    // Proactive initial negotiation trigger
    let initialTimer: any = null;
    if (isHost) {
      initialTimer = setTimeout(() => {
        if (isMounted) sendOffer();
      }, 700);
    } else {
      initialTimer = setTimeout(() => {
        if (isMounted) {
          api.sendSignal(activeSession.id, 'request-offer', { user_id: currentUser.id }).catch(() => {});
        }
      }, 900);
    }

    // Polling loop for WebRTC signals (Offers, Answers, ICE candidates)
    const pollSignals = async () => {
      if (!isMounted || !pcRef.current) return;
      try {
        const signals = await api.getSignals(activeSession.id, lastSignalIdRef.current);
        if (!isMounted || !signals) return;

        for (const sig of signals) {
          if (sig.id > lastSignalIdRef.current) {
            lastSignalIdRef.current = sig.id;
          }

          if (sig.sender_id === currentUser.id) continue;

          let payload: any = sig.payload;
          while (typeof payload === 'string') {
            try {
              payload = JSON.parse(payload);
            } catch {
              break;
            }
          }

          if (sig.signal_type === 'join' || sig.signal_type === 'request-offer') {
            if (isHost && pcRef.current) {
              await sendOffer();
            }
          } else if (sig.signal_type === 'offer') {
            if (!isHost && pcRef.current && payload?.sdp) {
              console.log('[WebRTC] Received offer from host; setting remote description and answering...');
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));

              while (queuedCandidates.length > 0) {
                const c = queuedCandidates.shift();
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
                } catch (iceErr) {
                  console.warn('ICE drain error:', iceErr);
                }
              }

              const answer = await pcRef.current.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
              });
              await pcRef.current.setLocalDescription(answer);
              const answerData = { type: answer.type, sdp: answer.sdp };
              await api.sendSignal(activeSession.id, 'answer', answerData);
            }
          } else if (sig.signal_type === 'answer') {
            if (isHost && pcRef.current && payload?.sdp) {
              console.log('[WebRTC] Host received answer from learner...');
              if (pcRef.current.signalingState !== 'stable') {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));

                while (queuedCandidates.length > 0) {
                  const c = queuedCandidates.shift();
                  try {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
                  } catch (iceErr) {
                    console.warn('ICE drain error:', iceErr);
                  }
                }
              }
            }
          } else if (sig.signal_type === 'ice-candidate') {
            if (payload && (payload.candidate || typeof payload === 'string')) {
              if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(payload));
                } catch (iceErr) {
                  console.warn('Failed to add received ICE candidate:', iceErr);
                }
              } else {
                queuedCandidates.push(payload);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Signaling poll error:', err);
      }
    };

    const signalInterval = setInterval(pollSignals, 1200);
    pollSignals();

    // Health-check auto-ping if not connected after initial period
    const retryInterval = setInterval(() => {
      if (!isMounted || !pcRef.current) return;
      if (pcRef.current.connectionState !== 'connected' && connectionStatus !== 'connected') {
        if (!isHost) {
          api.sendSignal(activeSession.id, 'request-offer', { user_id: currentUser.id }).catch(() => {});
        } else {
          sendOffer();
        }
      }
    }, 4500);

    return () => {
      isMounted = false;
      if (initialTimer) clearTimeout(initialTimer);
      clearInterval(signalInterval);
      clearInterval(retryInterval);
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
        pcRef.current = null;
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
        remoteStreamRef.current = null;
      }
      setHasRemoteVideo(false);
      setHasRemoteAudio(false);
      setConnectionStatus('idle');
    };
  }, [activeSession?.id, activeSession?.status, reconnectKey]);

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedSecsRemainder = elapsedSeconds % 60;
  const creditRate = activeSession?.credit_rate || 1.0;
  const accruedCredits = Math.round((elapsedMinutes / 60.0) * creditRate * 100) / 100;

  const handleEndAndSettle = async () => {
    setSettling(true);
    setSettleError(null);
    stopAllMediaTracks();
    setIsTimerRunning(false);

    try {
      if (activeSession) {
        const res = await api.completeSession(activeSession.id, elapsedMinutes);
        setSettledResult({ credits: res.transferredCredits, duration: elapsedMinutes });
      } else {
        setSettledResult({ credits: accruedCredits, duration: elapsedMinutes });
      }

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e: any) {
      setSettleError(e?.message || 'Error occurred during credit settlement.');
    } finally {
      setSettling(false);
    }
  };

  const handleExitClassroom = (targetPage: string = 'dashboard') => {
    stopAllMediaTracks();
    setIsTimerRunning(false);
    setSettleModalOpen(false);
    setActiveSession(null);
    onNavigate(targetPage);
  };

  const handleStartHostSession = async () => {
    if (!hostTitle.trim()) {
      alert('Please enter a session title or topic.');
      return;
    }
    setIsHosting(true);
    try {
      const res = await api.createTeachingSession({
        title: hostTitle,
        skill_name: hostSkill || 'Peer Teaching & Mentorship',
        credit_rate: hostRate,
        duration_minutes: hostDuration,
        description: hostDesc || 'Live interactive online teaching and learning session.'
      });
      setHostModalOpen(false);
      setActiveSession({
        ...res.session,
        credit_rate: hostRate,
        status: 'IN_PROGRESS'
      });
      setElapsedSeconds(0);
      setIsTimerRunning(true);
      await initializeMedia();
    } catch (err: any) {
      alert('Error starting live session: ' + err?.message);
    } finally {
      setIsHosting(false);
    }
  };

  const handleStartScheduledClass = async () => {
    if (!activeSession) return;
    try {
      await api.joinSession(activeSession.id);
      setActiveSession({
        ...activeSession,
        status: 'IN_PROGRESS'
      });
      setIsTimerRunning(true);
      await initializeMedia();
    } catch (err: any) {
      alert('Error entering classroom: ' + err?.message);
    }
  };

  // Render Host Live Session Modal
  const renderHostModal = () => (
    <ClayModal
      isOpen={hostModalOpen}
      onClose={() => setHostModalOpen(false)}
      title="Host & Broadcast a Live Teaching Session Online"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Start an instant live online class! Other members across the platform can discover your broadcast and click to join your live video classroom right away.
        </p>

        <ClayInput
          label="Session Title / Topic"
          placeholder="e.g. Advanced SQL Optimization & Indexing Workshop"
          value={hostTitle}
          onChange={(e) => setHostTitle(e.target.value)}
        />

        <ClayInput
          label="Skill / Subject Area"
          placeholder="e.g. PostgreSQL Database Systems"
          value={hostSkill}
          onChange={(e) => setHostSkill(e.target.value)}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <ClayInput
            label="Session Duration (Minutes)"
            type="number"
            value={hostDuration}
            onChange={(e) => setHostDuration(Number(e.target.value))}
          />
          <ClayInput
            label="Credit Rate (TC / hr)"
            type="number"
            step="0.25"
            value={hostRate}
            onChange={(e) => setHostRate(Number(e.target.value))}
          />
        </div>

        <ClayInput
          label="Short Description / Agenda"
          placeholder="What will you teach? Any prerequisites for the student?"
          value={hostDesc}
          onChange={(e) => setHostDesc(e.target.value)}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <ClayButton variant="secondary" onClick={() => setHostModalOpen(false)}>
            Cancel
          </ClayButton>
          <ClayButton
            variant="primary"
            onClick={handleStartHostSession}
            disabled={isHosting}
            icon={<Sparkles size={16} />}
          >
            {isHosting ? 'Broadcasting...' : 'Start Live Class Now'}
          </ClayButton>
        </div>
      </div>
    </ClayModal>
  );

  // 1. Loading State
  if (loadingSession) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Checking classroom status...</span>
      </div>
    );
  }

  // 2. EMPTY STATE: No active class in progress
  if (!activeSession) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', margin: '2rem auto', width: '100%' }}>
        <ClayCard
          variant="raised"
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
          }}
        >
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)'
            }}
          >
            <VideoOff size={38} />
          </div>

          <div>
            <div style={{ display: 'inline-flex', marginBottom: '0.5rem' }}>
              <ClayBadge variant="lavender">Classroom Idle</ClayBadge>
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Classroom is Currently Empty
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '540px', margin: '0.6rem auto 0', lineHeight: 1.6 }}>
              There is no live class running right now. The WebRTC video canvas, live audio, whiteboard, and in-meeting notebook will activate as soon as you host or join an online teaching session.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', justifyContent: 'center', marginTop: '1rem' }}>
            <ClayButton variant="primary" onClick={() => setHostModalOpen(true)} icon={<Video size={16} />}>
              + Host Live Teaching Session
            </ClayButton>
            <ClayButton variant="secondary" onClick={() => onNavigate('browse')} icon={<Search size={16} />}>
              Browse Live Classes & Offers
            </ClayButton>
            <ClayButton variant="secondary" onClick={() => onNavigate('sessions')} icon={<CalendarCheck size={16} />}>
              My Scheduled Sessions
            </ClayButton>
          </div>
        </ClayCard>

        {renderHostModal()}
      </div>
    );
  }

  // 3. SCHEDULED CLASS WAITING ROOM STATE
  if (activeSession.status === 'SCHEDULED') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', margin: '2rem auto', width: '100%' }}>
        <ClayCard
          variant="raised"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
            border: '2px solid rgba(34, 197, 94, 0.3)'
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '22px',
              background: 'var(--pastel-mint-bg)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(34, 197, 94, 0.2)'
            }}
          >
            <PlayCircle size={40} />
          </div>

          <div>
            <div style={{ display: 'inline-flex', marginBottom: '0.5rem' }}>
              <ClayBadge variant="mint">Scheduled Class Ready</ClayBadge>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
              {activeSession.offer_title || 'Upcoming Peer Learning Class'}
            </h2>
            <div style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <span>👨‍🏫 Teacher: <strong>{activeSession.teacher_name || currentUser.full_name}</strong></span>
              <span>👨‍🎓 Learner: <strong>{activeSession.learner_name || 'Open to peer'}</strong></span>
              <span>💰 Rate: <strong>{Number(activeSession.credit_rate || 1.0).toFixed(2)} TC / hr</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', justifyContent: 'center', marginTop: '1rem' }}>
            <ClayButton variant="mint" onClick={handleStartScheduledClass} icon={<Video size={16} />}>
              Start & Enter Live Classroom Now
            </ClayButton>
            <ClayButton variant="secondary" onClick={() => onNavigate('sessions')} icon={<CalendarCheck size={16} />}>
              View All Sessions
            </ClayButton>
          </div>
        </ClayCard>

        {renderHostModal()}
      </div>
    );
  }

  // 4. LIVE IN-PROGRESS CLASSROOM WORKSPACE
  const isHost = Boolean(activeSession && (
    activeSession.teacher_id === currentUser.id ||
    activeSession.teacher_name === currentUser.full_name
  ));

  const remoteUserName = isHost
    ? (activeSession?.learner_name || 'Student / Peer')
    : (activeSession?.teacher_name || 'Teaching Staff');

  const remoteUserInitial = remoteUserName.charAt(0).toUpperCase();
  const remoteRoleLabel = isHost ? 'Student' : 'Teaching Staff';

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
                {activeSession.offer_title || 'Live Interactive Classroom Session'}
              </h1>
              <ClayBadge variant="mint">🔴 LIVE IN-PROGRESS</ClayBadge>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
              <span>Instructor: <strong>{activeSession.teacher_name || currentUser.full_name}</strong></span>
              <span>Learner: <strong>{activeSession.learner_name || 'Open for peer to join'}</strong></span>
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
            <span>+{Number(accruedCredits || 0).toFixed(2)} TC</span>
          </div>

          <ClayButton
            variant="danger"
            onClick={() => setSettleModalOpen(true)}
            icon={<PhoneOff size={15} />}
          >
            End Session
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
                
                {/* Remote WebRTC Peer Video (fills the stage when active) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    position: 'absolute',
                    inset: 0,
                    display: hasRemoteVideo ? 'block' : 'none',
                    zIndex: 1
                  }}
                />

                {/* Remote Video HD Streaming Badge */}
                {hasRemoteVideo && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      left: '1rem',
                      background: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(8px)',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      zIndex: 5
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
                    <span>{remoteUserName} ({remoteRoleLabel})</span>
                  </div>
                )}

                {/* Remote Participant Avatar Placeholder (shown when remote camera is off or connecting) */}
                {!hasRemoteVideo && (
                  <div style={{ textAlign: 'center', color: '#ffffff', zIndex: 1, padding: '1rem' }}>
                    <div
                      style={{
                        width: '104px',
                        height: '104px',
                        borderRadius: '50%',
                        background: isHost
                          ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                          : 'linear-gradient(135deg, #6366f1, #4f46e5)',
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
                      {remoteUserInitial}
                    </div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                      {remoteUserName}
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {remoteRoleLabel} • {activeSession.skill_name ? `${activeSession.skill_name} Instruction` : 'Live Peer Teaching'}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', marginTop: '0.85rem' }}>
                      <ClayBadge
                        variant={connectionStatus === 'connected' ? 'mint' : connectionStatus === 'connecting' ? 'lavender' : 'amber'}
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.65rem' }}
                      >
                        {connectionStatus === 'connected'
                          ? '● WEBRTC P2P CONNECTED • CAMERA OFF'
                          : connectionStatus === 'connecting'
                          ? '⏳ CONNECTING P2P WEBRTC LINK...'
                          : '○ WAITING FOR PEER TO ENTER ROOM'}
                      </ClayBadge>

                      <button
                        onClick={handleManualReconnect}
                        style={{
                          background: 'rgba(99, 102, 241, 0.25)',
                          border: '1px solid rgba(99, 102, 241, 0.6)',
                          color: '#ffffff',
                          borderRadius: '12px',
                          padding: '0.35rem 0.85rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                        title="Click to force re-negotiate video link between devices"
                      >
                        <span>🔄 Connect / Retry Stream</span>
                      </button>
                    </div>
                  </div>
                )}

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
                    zIndex: 10
                  }}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: (hasMediaStream && cameraActive) ? 'block' : 'none'
                    }}
                  />

                  {(!hasMediaStream || !cameraActive) && (
                    <div style={{ textAlign: 'center', color: '#f8fafc', padding: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.35rem', fontWeight: 800 }}>
                        {currentUser.full_name.charAt(0)}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{currentUser.full_name.split(' ')[0]} (You)</span>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>Camera Off</span>
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: '6px', left: '8px', background: 'rgba(0,0,0,0.65)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#ffffff' }}>
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

            {/* End Call / Leave Dock Button */}
            <button
              onClick={() => setSettleModalOpen(true)}
              className="clay-button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.15rem',
                borderRadius: '16px',
                background: '#fee2e2',
                color: '#dc2626',
                fontWeight: 700,
                fontSize: '0.875rem'
              }}
              title="End Call & Settle Session"
            >
              <PhoneOff size={18} />
              <span>End Session</span>
            </button>

            <ClayButton variant="secondary" onClick={() => setActiveTab(activeTab === 'whiteboard' ? 'chat' : 'whiteboard')}>
              {activeTab === 'whiteboard' ? 'Open Classroom Chat' : 'Open Interactive Whiteboard'}
            </ClayButton>
          </ClayCard>
        </div>

        {/* Right Column: In-Built Meeting Chat & Shared Notes */}
        <ClayCard variant="raised" style={{ height: '620px', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
          {/* Tabs Header */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '14px', marginBottom: '1rem', gap: '0.25rem' }}>
            <button
              onClick={() => setActiveTab('whiteboard')}
              style={{
                flex: 1,
                border: 'none',
                padding: '0.45rem',
                borderRadius: '10px',
                background: activeTab === 'whiteboard' ? '#ffffff' : 'transparent',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: activeTab === 'whiteboard' ? '#4338ca' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <Pen size={14} /> Whiteboard
            </button>
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
              <MessageSquare size={14} /> Chat ({chatMessages.length})
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
              <BookOpen size={14} /> Notes
            </button>
          </div>

          {/* Whiteboard Tab */}
          {activeTab === 'whiteboard' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <CollaborativeWhiteboard
                sessionId={activeSession.id}
                currentUserId={currentUser.id}
              />
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  paddingRight: '0.25rem',
                  marginBottom: '0.75rem'
                }}
              >
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', marginTop: '2rem' }}>
                    No messages yet. Send a message to chat with your peer!
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => {
                    const isMe = msg.sender === currentUser.full_name;
                    return (
                      <div
                        key={idx}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          background: isMe ? 'var(--pastel-lavender-bg)' : '#f8fafc',
                          padding: '0.55rem 0.85rem',
                          borderRadius: '14px',
                          border: '1px solid',
                          borderColor: isMe ? 'rgba(99, 102, 241, 0.2)' : '#e2e8f0',
                          fontSize: '0.825rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.15rem' }}>
                          <span style={{ fontWeight: 700, color: isMe ? '#4338ca' : '#0f172a', fontSize: '0.75rem' }}>
                            {msg.sender}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                            {msg.time}
                          </span>
                        </div>
                        <div style={{ color: '#334155', lineHeight: 1.4 }}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Type in-meeting message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  style={{
                    flex: 1,
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '0.5rem 0.85rem',
                    fontSize: '0.825rem',
                    outline: 'none',
                    background: '#f8fafc'
                  }}
                />
                <ClayButton variant="primary" size="sm" onClick={handleSendMessage} icon={<Send size={14} />}>
                  Send
                </ClayButton>
              </div>
            </div>
          )}

          {/* Collaborative Notes Tab */}
          {activeTab === 'notes' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Markdown & Code Supported</span>
                <ClayBadge variant="sky">Session Notebook</ClayBadge>
              </div>
              <textarea
                value={sharedNotes}
                onChange={(e) => setSharedNotes(e.target.value)}
                style={{
                  flex: 1,
                  width: '100%',
                  border: '1px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  background: '#f8fafc',
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
                Session Successfully Ended!
              </h3>
              <p style={{ color: '#475569', fontSize: '0.95rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
                Completed <strong>{settledResult.duration} minutes</strong> of live instruction.
                <br />
                Settled <strong>{Number(settledResult.credits || 0).toFixed(2)} TimeCredits</strong> via atomic database transaction.
              </p>

              <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem' }}>
                <ClayButton variant="primary" onClick={() => handleExitClassroom('wallet')}>
                  View Wallet & Ledger
                </ClayButton>
                <ClayButton variant="secondary" onClick={() => handleExitClassroom('dashboard')}>
                  Return to Dashboard
                </ClayButton>
                <ClayButton variant="secondary" onClick={() => handleExitClassroom('sessions')}>
                  View Sessions
                </ClayButton>
              </div>
            </div>
          ) : (
            <>
              {settleError && (
                <div style={{ padding: '0.85rem 1rem', borderRadius: '14px', background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', fontSize: '0.875rem' }}>
                  <strong>Settlement Note:</strong> {settleError}
                </div>
              )}

              <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Completing this live classroom session will finish the call and trigger the <strong>ACID credit settlement</strong>:
              </p>

              <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Verified Elapsed Duration:</span>
                  <strong>{elapsedMinutes} minutes</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Session Credit Rate:</span>
                  <strong>{Number(creditRate || 0).toFixed(2)} TC / hr</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', fontSize: '1rem' }}>
                  <span style={{ fontWeight: 700 }}>Settlement Amount:</span>
                  <strong style={{ color: '#059669' }}>+{Number(accruedCredits || 0).toFixed(2)} TC</strong>
                </div>
              </div>

              <div style={{ fontSize: '0.775rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={16} color="#6366f1" />
                <span>Idempotent row-locked settlement ensures exact, non-duplicated credit transfers.</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                <ClayButton variant="secondary" size="sm" onClick={() => handleExitClassroom('dashboard')}>
                  Exit Without Settling
                </ClayButton>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <ClayButton variant="secondary" onClick={() => setSettleModalOpen(false)}>
                    Stay in Class
                  </ClayButton>
                  <ClayButton
                    variant="danger"
                    onClick={handleEndAndSettle}
                    disabled={settling}
                    icon={<PhoneOff size={16} />}
                  >
                    {settling ? 'Settling Credits...' : 'Confirm & End Session'}
                  </ClayButton>
                </div>
              </div>
            </>
          )}
        </div>
      </ClayModal>

      {renderHostModal()}
    </div>
  );
};
