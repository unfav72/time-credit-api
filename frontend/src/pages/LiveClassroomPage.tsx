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
  PlayCircle,
  Star,
  ExternalLink,
  Copy,
  Check
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
  const [isPeerScreenSharing, setIsPeerScreenSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [reconnectKey, setReconnectKey] = useState(0);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoTransceiverRef = useRef<RTCRtpTransceiver | null>(null);
  const audioTransceiverRef = useRef<RTCRtpTransceiver | null>(null);
  const sendOfferRef = useRef<(() => Promise<void>) | null>(null);
  const lastSignalIdRef = useRef<number>(0);

  const handleManualReconnect = async () => {
    setConnectionStatus('connecting');
    setHasRemoteVideo(false);
    setHasRemoteAudio(false);
    if (!streamRef.current) {
      await initializeMedia(true, true);
    } else {
      syncLocalTracksToPeer(streamRef.current);
    }
    const isHost = activeSession?.teacher_id === currentUser.id || activeSession?.teacher_name === currentUser.full_name;
    if (activeSession) {
      if (isHost) {
        if (pcRef.current) {
          try {
            const offer = await pcRef.current.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pcRef.current.setLocalDescription(offer);
            api.sendSignal(activeSession.id, 'offer', { type: offer.type, sdp: offer.sdp }).catch(console.warn);
          } catch (e) {
            console.warn('Manual reconnect offer error:', e);
          }
        }
      } else {
        api.sendSignal(activeSession.id, 'request-offer', { user_id: currentUser.id }).catch(console.warn);
      }
    }
    setReconnectKey(prev => prev + 1);
  };

  // Settlement modal states
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settledResult, setSettledResult] = useState<{ credits: number; duration: number } | null>(null);

  // Post-Session Review states
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<number | null>(null);
  const learnerJoinedAtRef = useRef<number | null>(null);

  // Real-time automatic TimeCredit streaming and balance status
  const [liveStreamingStatus, setLiveStreamingStatus] = useState<{ delta: number; total: number; timestamp: number } | null>(null);
  const [insufficientCreditsWarning, setInsufficientCreditsWarning] = useState(false);

  // Persistent Session Start Time across page changes, tab switches, and reloads
  const getPersistedSessionStartTime = (sessionId: number, actualStartAt?: string | null): number | null => {
    if (!sessionId) return null;
    const storageKey = `tc_session_start_${sessionId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now()) {
        return parsed;
      }
    }

    if (actualStartAt) {
      const serverTime = new Date(actualStartAt).getTime();
      if (!isNaN(serverTime) && serverTime > 0 && serverTime <= Date.now()) {
        localStorage.setItem(storageKey, String(serverTime));
        return serverTime;
      }
    }

    return null;
  };

  const ensureSessionStartTime = (sessionId: number, actualStartAt?: string | null): number => {
    let startTime = getPersistedSessionStartTime(sessionId, actualStartAt);
    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(`tc_session_start_${sessionId}`, String(startTime));
    }
    return startTime;
  };

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

  // Google Meet integration states
  const [googleMeetInput, setGoogleMeetInput] = useState('');
  const [meetLinkCopied, setMeetLinkCopied] = useState(false);
  const [isSavingMeetLink, setIsSavingMeetLink] = useState(false);

  useEffect(() => {
    loadSession();

    return () => {
      stopAllMediaTracks();
    };
  }, []);

  const loadSession = async () => {
    setLoadingSession(true);
    try {
      const targetedId = sessionStorage.getItem('active_classroom_session_id');
      let current: Session | null = null;

      // 1. If user specifically targeted a session from Browse or Sessions page:
      if (targetedId) {
        try {
          await api.joinSession(Number(targetedId)).catch(console.warn);
          const targetSession = await api.getSession(Number(targetedId)).catch(() => null);
          if (targetSession && (targetSession.status === 'IN_PROGRESS' || targetSession.status === 'SCHEDULED')) {
            current = targetSession;
          }
        } catch (tErr) {
          console.warn('Target session load error:', tErr);
        }
      }

      // 2. If no valid targeted session, query user's personal sessions:
      if (!current) {
        const list = await api.getSessions().catch(() => []);
        current = list.find(s => s.status === 'IN_PROGRESS' || s.status === 'SCHEDULED') || null;
      }

      // 3. Fallback: Check open live sessions across platform:
      if (!current) {
        const liveList = await api.getLiveSessions().catch(() => []);
        if (liveList.length > 0) {
          const liveCandidate = liveList[0];
          if (liveCandidate.status === 'IN_PROGRESS' || liveCandidate.status === 'SCHEDULED') {
            current = liveCandidate;
            api.joinSession(current.id).catch(console.warn);
          }
        }
      }

      // If no active session or if completed, clear storage and show empty classroom:
      if (!current || current.status === 'COMPLETED' || current.status === 'CANCELLED') {
        sessionStorage.removeItem('active_classroom_session_id');
        if (current) {
          localStorage.removeItem(`tc_session_start_${current.id}`);
        }
        setActiveSession(null);
        learnerJoinedAtRef.current = null;
        setIsTimerRunning(false);
        stopAllMediaTracks();
      } else {
        sessionStorage.setItem('active_classroom_session_id', String(current.id));
        setActiveSession(current);

        if (current.status === 'IN_PROGRESS') {
          const isHostUser = current.teacher_id === currentUser.id || current.teacher_name === currentUser.full_name;
          const hasJoinedLearner = Boolean(current.learner_id && current.learner_id !== current.teacher_id);
          const isLearnerPresent = hasJoinedLearner || !isHostUser;

          // Auto-join learner when entering classroom so learner_id is bound in database
          if (!isHostUser) {
            api.joinSession(current.id).catch(console.warn);
          }

          if (isLearnerPresent) {
            const startTs = ensureSessionStartTime(current.id, current.actual_start_at);
            learnerJoinedAtRef.current = startTs;
            const initialElapsed = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
            setElapsedSeconds(initialElapsed);
            setIsTimerRunning(true);
          } else {
            // Solo host waiting for learner; check if previously running
            const existingStart = getPersistedSessionStartTime(current.id, current.actual_start_at);
            if (existingStart) {
              learnerJoinedAtRef.current = existingStart;
              setElapsedSeconds(Math.max(0, Math.floor((Date.now() - existingStart) / 1000)));
              setIsTimerRunning(true);
            } else {
              learnerJoinedAtRef.current = null;
              setElapsedSeconds(0);
              setIsTimerRunning(false);
            }
          }
        } else {
          learnerJoinedAtRef.current = null;
          setIsTimerRunning(false);
          stopAllMediaTracks();
        }
      }
    } catch (err) {
      console.warn('Could not load session:', err);
      sessionStorage.removeItem('active_classroom_session_id');
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

  // Timer runs continuously in the background across tab switches and page navigations
  useEffect(() => {
    let interval: any = null;
    const isHostUser = activeSession?.teacher_id === currentUser.id || activeSession?.teacher_name === currentUser.full_name;
    const hasJoinedLearner = Boolean(activeSession && activeSession.learner_id && activeSession.learner_id !== activeSession.teacher_id);
    const peerConnected = connectionStatus === 'connected' || hasRemoteVideo || hasRemoteAudio;
    const isLearnerPresent = hasJoinedLearner || (!isHostUser) || peerConnected;

    if (activeSession?.status === 'IN_PROGRESS') {
      const persistedStart = getPersistedSessionStartTime(activeSession.id, activeSession.actual_start_at);

      if (isLearnerPresent || persistedStart) {
        const startTs = ensureSessionStartTime(activeSession.id, activeSession.actual_start_at);
        learnerJoinedAtRef.current = startTs;
        setIsTimerRunning(true);

        // Immediate sync
        const currentElapsed = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
        setElapsedSeconds(currentElapsed);

        // Synchronize anchor with peer
        api.sendSignal(activeSession.id, 'session-time-sync', { start_time: startTs }).catch(() => {});

        interval = setInterval(() => {
          const activeStart = getPersistedSessionStartTime(activeSession.id, activeSession.actual_start_at) || startTs;
          const secs = Math.max(0, Math.floor((Date.now() - activeStart) / 1000));
          setElapsedSeconds(secs);
        }, 1000);
      } else {
        setIsTimerRunning(false);
        if (isHostUser && !peerConnected) {
          setElapsedSeconds(0);
        }
      }
    } else {
      setIsTimerRunning(false);
    }

    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.status, activeSession?.learner_id, connectionStatus, hasRemoteVideo, hasRemoteAudio]);

  // Real-time automatic TimeCredit streaming deduction from learner to teacher
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'IN_PROGRESS') return;

    const isHostUser = activeSession.teacher_id === currentUser.id || activeSession.teacher_name === currentUser.full_name;
    const hasJoinedLearner = Boolean(activeSession.learner_id && activeSession.learner_id !== activeSession.teacher_id);
    const peerConnected = connectionStatus === 'connected' || hasRemoteVideo || hasRemoteAudio;
    const isLearnerPresent = hasJoinedLearner || (!isHostUser) || peerConnected;

    // Only stream credits when learner is present and at least 15s elapsed
    if (!isLearnerPresent || elapsedSeconds < 15) return;

    const streamSettlement = async () => {
      try {
        const res = await api.autoSettleSession(activeSession.id, elapsedSeconds);
        if (res.success) {
          if (res.insufficient_credits) {
            setInsufficientCreditsWarning(true);
          } else {
            setInsufficientCreditsWarning(false);
          }

          if (res.delta_settled > 0) {
            setLiveStreamingStatus({
              delta: res.delta_settled,
              total: res.total_settled,
              timestamp: Date.now()
            });

            setActiveSession(prev => prev ? { ...prev, settled_credits: res.total_settled } : null);

            if (isHostUser && res.teacher_balance != null) {
              currentUser.balance = res.teacher_balance;
            } else if (!isHostUser && res.learner_balance != null) {
              currentUser.balance = res.learner_balance;
            }

            api.sendSignal(activeSession.id, 'credit-stream-settled', {
              delta: res.delta_settled,
              total: res.total_settled,
              teacher_balance: res.teacher_balance,
              learner_balance: res.learner_balance,
              insufficient_credits: res.insufficient_credits
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[Classroom] Auto-settle stream error:', err);
      }
    };

    const interval = setInterval(streamSettlement, 25000);
    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.status, activeSession?.learner_id, elapsedSeconds, connectionStatus]);

  // Synchronize local audio/video tracks to active RTCPeerConnection
  const syncLocalTracksToPeer = (stream: MediaStream | null) => {
    if (!pcRef.current || !stream) return;
    try {
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        if (videoTransceiverRef.current?.sender) {
          videoTransceiverRef.current.sender.replaceTrack(vTrack).catch(console.warn);
        } else {
          const senders = pcRef.current.getSenders();
          const sender = senders.find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(vTrack).catch(console.warn);
          else pcRef.current.addTrack(vTrack, stream);
        }
      }
      const aTrack = stream.getAudioTracks()[0];
      if (aTrack) {
        if (audioTransceiverRef.current?.sender) {
          audioTransceiverRef.current.sender.replaceTrack(aTrack).catch(console.warn);
        } else {
          const senders = pcRef.current.getSenders();
          const sender = senders.find(s => s.track?.kind === 'audio');
          if (sender) sender.replaceTrack(aTrack).catch(console.warn);
          else pcRef.current.addTrack(aTrack, stream);
        }
      }
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
  }, [hasRemoteVideo, connectionStatus, isPeerScreenSharing]);

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

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      screenStreamRef.current = null;
    }
    setScreenSharing(false);

    if (activeSession) {
      api.sendSignal(activeSession.id, 'screen-share-stopped', { user_id: currentUser.id }).catch(console.warn);
    }

    // Revert WebRTC peer connection back to camera track so learner sees camera again
    const cameraTrack = streamRef.current?.getVideoTracks()[0] || null;
    if (videoTransceiverRef.current?.sender) {
      try {
        await videoTransceiverRef.current.sender.replaceTrack(cameraTrack);
      } catch (err) {
        console.warn('Reverting track error on stop screen share:', err);
      }
    } else if (pcRef.current) {
      try {
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(cameraTrack);
        }
      } catch (err) {
        console.warn('Reverting track error on stop screen share:', err);
      }
    }

    if (sendOfferRef.current) {
      await sendOfferRef.current().catch(console.warn);
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      await stopScreenShare();
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

      const screenTrack = screenStream.getVideoTracks()[0];

      // Broadcast to peer that screen share started
      if (activeSession) {
        api.sendSignal(activeSession.id, 'screen-share-started', { user_id: currentUser.id }).catch(console.warn);
      }

      // WebRTC Transmission: Replace the outgoing video track on RTCPeerConnection
      // so learner receives the screen share live!
      if (videoTransceiverRef.current?.sender && screenTrack) {
        await videoTransceiverRef.current.sender.replaceTrack(screenTrack);
      } else if (pcRef.current && screenTrack) {
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          pcRef.current.addTrack(screenTrack, screenStream);
        }
      }

      if (sendOfferRef.current) {
        await sendOfferRef.current().catch(console.warn);
      }

      screenTrack.onended = () => {
        stopScreenShare();
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
      const vTrans = pc.addTransceiver('video', { direction: 'sendrecv' });
      const aTrans = pc.addTransceiver('audio', { direction: 'sendrecv' });
      videoTransceiverRef.current = vTrans;
      audioTransceiverRef.current = aTrans;

      if (streamRef.current) {
        const vTrack = streamRef.current.getVideoTracks()[0];
        if (vTrack && vTrans.sender) {
          vTrans.sender.replaceTrack(vTrack).catch(console.warn);
        }
        const aTrack = streamRef.current.getAudioTracks()[0];
        if (aTrack && aTrans.sender) {
          aTrans.sender.replaceTrack(aTrack).catch(console.warn);
        }
      }
    } catch (tErr) {
      console.warn('WebRTC transceiver pre-allocation:', tErr);
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

      if (event.track.kind === 'video') {
        setHasRemoteVideo(true);
      }
      if (event.track.kind === 'audio') {
        setHasRemoteAudio(true);
      }
      setConnectionStatus('connected');

      event.track.onunmute = () => {
        if (event.track.kind === 'video') setHasRemoteVideo(true);
        if (event.track.kind === 'audio') setHasRemoteAudio(true);
        if (remoteVideoRef.current && remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
          remoteVideoRef.current.play().catch(console.warn);
        }
      };

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
    sendOfferRef.current = sendOffer;

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

          if (sig.signal_type === 'join') {
            if (isHost && pcRef.current) {
              await sendOffer();
            } else if (!isHost && pcRef.current) {
              api.sendSignal(activeSession.id, 'request-offer', { user_id: currentUser.id }).catch(() => {});
            }
          } else if (sig.signal_type === 'request-offer') {
            if (isHost && pcRef.current) {
              await sendOffer();
            }
          } else if (sig.signal_type === 'screen-share-started') {
            setIsPeerScreenSharing(true);
            setHasRemoteVideo(true);
          } else if (sig.signal_type === 'screen-share-stopped') {
            setIsPeerScreenSharing(false);
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
          } else if (sig.signal_type === 'session-time-sync') {
            if (payload?.start_time && typeof payload.start_time === 'number') {
              const peerStart = payload.start_time;
              const localStart = getPersistedSessionStartTime(activeSession.id, activeSession.actual_start_at);
              if (!localStart || peerStart < localStart) {
                localStorage.setItem(`tc_session_start_${activeSession.id}`, String(peerStart));
                learnerJoinedAtRef.current = peerStart;
                const secs = Math.max(0, Math.floor((Date.now() - peerStart) / 1000));
                setElapsedSeconds(secs);
              }
            }
          } else if (sig.signal_type === 'credit-stream-settled') {
            if (payload?.total != null) {
              setActiveSession(prev => prev ? { ...prev, settled_credits: payload.total } : null);
            }
            if (payload?.delta != null && payload.delta > 0) {
              setLiveStreamingStatus({
                delta: payload.delta,
                total: payload.total,
                timestamp: Date.now()
              });
            }
            if (isHost && payload?.teacher_balance != null) {
              currentUser.balance = payload.teacher_balance;
            } else if (!isHost && payload?.learner_balance != null) {
              currentUser.balance = payload.learner_balance;
            }
            if (payload?.insufficient_credits) {
              setInsufficientCreditsWarning(true);
            } else {
              setInsufficientCreditsWarning(false);
            }
          } else if (sig.signal_type === 'google-meet-updated') {
            if (payload?.meeting_link) {
              setActiveSession(prev => prev ? { ...prev, meeting_room_id: payload.meeting_link } : null);
            }
          } else if (sig.signal_type === 'session-ended') {
            console.log('[WebRTC] Peer notified that session has completed and settled:', payload);
            sessionStorage.removeItem('active_classroom_session_id');
            localStorage.removeItem(`tc_session_start_${activeSession.id}`);
            const creds = Number(payload?.credits ?? accruedCredits);
            const dur = Number(payload?.duration ?? elapsedMinutes);
            setSettledResult({ credits: creds, duration: dur });
            setCompletedSessionId(activeSession.id);
            setSettleModalOpen(true);
            stopAllMediaTracks();
            setIsTimerRunning(false);
            learnerJoinedAtRef.current = null;
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.6 }
            });
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
      sendOfferRef.current = null;
      setHasRemoteVideo(false);
      setHasRemoteAudio(false);
      setConnectionStatus('idle');
    };
  }, [activeSession?.id, activeSession?.status, reconnectKey]);

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedSecsRemainder = elapsedSeconds % 60;
  const creditRate = Number(activeSession?.credit_rate || 1.0);
  const theoreticalAccrued = Math.round((elapsedSeconds / 3600.0) * creditRate * 100) / 100;
  const settledCredits = Number(activeSession?.settled_credits || 0);
  const accruedCredits = Math.max(settledCredits, theoreticalAccrued);

  // Periodic poll to detect if meeting was ended/completed by peer on the server
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'IN_PROGRESS') return;

    const interval = setInterval(async () => {
      try {
        const s = await api.getSession(activeSession.id).catch(() => null);
        if (s && (s.status === 'COMPLETED' || s.status === 'CANCELLED')) {
          console.log('[Classroom] Server session marked COMPLETED:', s.id);
          sessionStorage.removeItem('active_classroom_session_id');
          localStorage.removeItem(`tc_session_start_${s.id}`);
          stopAllMediaTracks();
          setIsTimerRunning(false);
          learnerJoinedAtRef.current = null;
          setActiveSession(null);
          setSettledResult({ credits: Math.max(Number(s.settled_credits || 0), accruedCredits), duration: elapsedMinutes });
          setCompletedSessionId(s.id);
          setSettleModalOpen(true);
        }
      } catch (err) {
        // Silently handled
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.status, accruedCredits, elapsedMinutes]);

  const handleEndAndSettle = async () => {
    setSettling(true);
    setSettleError(null);
    const sid = activeSession?.id;

    try {
      sessionStorage.removeItem('active_classroom_session_id');
      if (activeSession) {
        localStorage.removeItem(`tc_session_start_${activeSession.id}`);
      }

      if (activeSession) {
        const res = await api.completeSession(activeSession.id, elapsedMinutes);
        setSettledResult({ credits: res.transferredCredits, duration: elapsedMinutes });
        setCompletedSessionId(activeSession.id);

        // Notify peer via WebRTC signal that session ended and credits were settled!
        api.sendSignal(activeSession.id, 'session-ended', {
          ended_by: currentUser.id,
          credits: res.transferredCredits,
          duration: elapsedMinutes
        }).catch(console.warn);
      } else {
        setSettledResult({ credits: accruedCredits, duration: elapsedMinutes });
      }

      stopAllMediaTracks();
      setIsTimerRunning(false);
      learnerJoinedAtRef.current = null;

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e: any) {
      console.warn('Settlement fallback triggered:', e);
      // Resilient fallback: ensure camera/mic stops, classroom storage clears, and modal finishes cleanly
      sessionStorage.removeItem('active_classroom_session_id');
      stopAllMediaTracks();
      setIsTimerRunning(false);
      learnerJoinedAtRef.current = null;
      setSettledResult({ credits: accruedCredits || 0, duration: elapsedMinutes });
      if (activeSession) {
        setCompletedSessionId(activeSession.id);
      }
    } finally {
      setSettling(false);
    }

  };

  const handleSaveMeetLink = async () => {
    if (!activeSession) return;
    const link = googleMeetInput.trim();
    if (!link) {
      alert('Please enter a Google Meet link or code.');
      return;
    }
    setIsSavingMeetLink(true);
    try {
      const res = await api.updateMeetingLink(activeSession.id, link);
      setActiveSession(prev => prev ? { ...prev, meeting_room_id: res.meeting_room_id } : null);
      api.sendSignal(activeSession.id, 'google-meet-updated', { meeting_link: res.meeting_room_id }).catch(console.warn);
      setGoogleMeetInput('');
      alert('Google Meet link saved and synced with student!');
    } catch (err: any) {
      alert('Failed to update Google Meet link: ' + (err?.message || 'Error occurred'));
    } finally {
      setIsSavingMeetLink(false);
    }
  };

  const handleCopyMeetLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setMeetLinkCopied(true);
    setTimeout(() => setMeetLinkCopied(false), 2500);
  };

  const handleSubmitReview = async () => {
    if (!completedSessionId) return;
    setReviewSubmitting(true);
    try {
      await api.submitReview(completedSessionId, reviewRating, reviewComment.trim());
      setReviewSubmitted(true);
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.7 }
      });
      setTimeout(() => {
        handleExitClassroom('classroom');
      }, 1500);
    } catch (err: any) {
      alert('Error submitting review: ' + (err?.message || 'Failed saving review'));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleExitClassroom = (targetPage: string = 'classroom') => {
    sessionStorage.removeItem('active_classroom_session_id');
    if (activeSession) {
      localStorage.removeItem(`tc_session_start_${activeSession.id}`);
    }
    stopAllMediaTracks();
    setIsTimerRunning(false);
    learnerJoinedAtRef.current = null;
    setSettleModalOpen(false);
    setActiveSession(null);
    setSettledResult(null);
    setElapsedSeconds(0);
    setReviewSubmitted(false);
    setReviewComment('');
    setReviewRating(5);
    setCompletedSessionId(null);
    if (targetPage !== 'classroom') {
      onNavigate(targetPage);
    }
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
      learnerJoinedAtRef.current = null;
      setIsTimerRunning(false);
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

  const isLearner = Boolean(activeSession && (
    activeSession.learner_id === currentUser.id ||
    activeSession.learner_name === currentUser.full_name ||
    (!isHost && activeSession.teacher_id !== currentUser.id)
  ));

  const isSoloSession = Boolean(activeSession && (
    !activeSession.learner_id ||
    activeSession.teacher_id === activeSession.learner_id ||
    activeSession.learner_name?.toLowerCase().includes('waiting')
  ));

  const remoteUserName = isHost
    ? (activeSession?.learner_name || 'Student / Peer')
    : (activeSession?.teacher_name || 'Teaching Staff');

  const remoteUserInitial = remoteUserName.charAt(0).toUpperCase();
  const remoteRoleLabel = isHost ? 'Student' : 'Teaching Staff';

  const getCanonicalMeetUrl = (rawLink?: string | null) => {
    if (!rawLink) return 'https://meet.google.com/new';
    const trimmed = rawLink.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('meet.google.com/')) return 'https://' + trimmed;
    if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(trimmed)) return `https://meet.google.com/${trimmed.toLowerCase()}`;
    if (trimmed.startsWith('tc-live-')) return 'https://meet.google.com/new';
    return `https://meet.google.com/${trimmed.replace(/^\/+/, '')}`;
  };

  const canonicalMeetUrl = getCanonicalMeetUrl(activeSession?.meeting_room_id);

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

          {/* Role-Based Credit Accrual Badge */}
          {isHost ? (
            <div
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: '16px',
                background: 'var(--pastel-mint-bg)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontWeight: 800,
                fontSize: '0.95rem',
                boxShadow: 'var(--clay-shadow-btn)'
              }}
              title="Real-time earnings streaming from learner to your wallet. Settled every 25 seconds."
            >
              <Coins size={16} />
              <span>+{Number(accruedCredits || 0).toFixed(2)} TC</span>
            </div>
          ) : (
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
              title="Real-time cost streaming from your balance to instructor according to timer."
            >
              <Coins size={16} />
              <span>-{Number(accruedCredits || 0).toFixed(2)} TC</span>
            </div>
          )}

          {/* Live Streaming Pill */}
          {liveStreamingStatus && (Date.now() - liveStreamingStatus.timestamp < 12000) && (
            <div
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.775rem',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
              }}
              title="Automatic background credit transfer committed to database ledger"
            >
              <Sparkles size={13} />
              <span>Streamed {liveStreamingStatus.delta > 0 ? `+${liveStreamingStatus.delta.toFixed(2)} TC` : 'Active'}</span>
            </div>
          )}

          {/* User Live Balance Pill */}
          <div
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '16px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            title="Your current available wallet balance"
          >
            <span>Balance:</span>
            <strong style={{ color: currentUser.balance < 0.2 ? '#dc2626' : '#0f172a' }}>
              {Number(currentUser.balance || 0).toFixed(2)} TC
            </strong>
          </div>

          {/* Action button based on role: Learner ends & settles, Teacher leaves or closes solo */}
          {isLearner ? (
            <ClayButton
              variant="danger"
              onClick={() => {
                setSettledResult(null);
                setSettleError(null);
                setSettleModalOpen(true);
              }}
              icon={<PhoneOff size={15} />}
            >
              End Session & Settle
            </ClayButton>
          ) : isSoloSession ? (
            <ClayButton
              variant="secondary"
              onClick={() => {
                setSettledResult(null);
                setSettleError(null);
                setSettleModalOpen(true);
              }}
              icon={<PhoneOff size={15} />}
            >
              Close Broadcast
            </ClayButton>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClayBadge variant="lavender">Mentoring Student</ClayBadge>
              <ClayButton
                variant="secondary"
                onClick={() => {
                  if (confirm('Leave classroom? The active session will conclude when the student ends it, and settled TimeCredits will transfer to your wallet.')) {
                    handleExitClassroom('dashboard');
                  }
                }}
                icon={<PhoneOff size={15} />}
              >
                Leave Classroom
              </ClayButton>
            </div>
          )}
        </div>
      </ClayCard>

      {/* Depleted Balance Alert Banner */}
      {insufficientCreditsWarning && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            border: '1.5px solid #f87171',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertCircle size={20} color="#dc2626" />
            <div>
              <strong style={{ fontSize: '0.9rem' }}>TimeCredit Balance Depleted (0.00 TC):</strong>
              <span style={{ fontSize: '0.85rem', marginLeft: '0.4rem' }}>
                The learner's credit balance has reached 0.00 TC. Please top up your wallet to continue learning without disruption.
              </span>
            </div>
          </div>
          <ClayButton
            size="sm"
            variant="primary"
            onClick={() => onNavigate('topup')}
            icon={<Coins size={14} />}
          >
            Top Up Credits
          </ClayButton>
        </div>
      )}

      {/* Main Classroom Workspace Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* Left Column: Real In-Built Video Canvas & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Google Meet Classroom Video Hub */}
          <ClayCard
            variant="inset"
            style={{
              minHeight: '480px',
              position: 'relative',
              borderRadius: '24px',
              overflow: 'hidden',
              background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 75%)',
              border: '2px solid rgba(99, 102, 241, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '1.75rem',
              color: '#ffffff',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)'
            }}
          >
            {/* Top Bar: Google Meet Live Indicator & Participants */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 7V17L19 21V3L12 7Z" fill="#00832d" />
                    <path d="M3 7.5C3 6.67157 3.67157 6 4.5 6H12V18H4.5C3.67157 18 3 17.3284 3 16.5V7.5Z" fill="#00ac47" />
                    <path d="M19 8.5L22.5 5.5V18.5L19 15.5V8.5Z" fill="#ea4335" />
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>Google Meet Video Room</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.5)', color: '#4ade80', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                      READY
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Crystal clear audio, camera & screen sharing powered by Google Meet
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <span>Teacher: <strong style={{ color: '#ffffff' }}>{activeSession.teacher_name}</strong></span>
                <span>•</span>
                <span>Student: <strong style={{ color: '#ffffff' }}>{remoteUserName}</strong></span>
              </div>
            </div>

            {/* Central Meet Hero Action Hub */}
            <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #00832d, #00ac47)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0, 172, 71, 0.4)',
                  color: '#ffffff'
                }}
              >
                <Video size={38} />
              </div>

              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', margin: 0 }}>
                  Enter Live Google Meet Video Call
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', maxWidth: '480px', margin: '0.5rem auto 0', lineHeight: 1.5 }}>
                  Click below to open the dedicated Google Meet call in a new browser tab. Your whiteboard, collaborative notes, and TimeCredit timer continue running right here.
                </p>
              </div>

              {/* Active Meeting Room Link Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontSize: '0.85rem',
                  color: '#e2e8f0',
                  fontFamily: 'monospace'
                }}
              >
                <span>🔗 {canonicalMeetUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopyMeetLink(canonicalMeetUrl)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '3px 8px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {meetLinkCopied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  <span>{meetLinkCopied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* Primary Call Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                <a
                  href={canonicalMeetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.85rem 1.75rem',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #00ac47 0%, #00832d 100%)',
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    boxShadow: '0 6px 20px rgba(0, 172, 71, 0.45)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <Video size={20} />
                  <span>Join Video Call on Google Meet</span>
                  <ExternalLink size={16} />
                </a>

                <button
                  type="button"
                  onClick={() => handleCopyMeetLink(canonicalMeetUrl)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.85rem 1.35rem',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    fontSize: '0.925rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {meetLinkCopied ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
                  <span>{meetLinkCopied ? 'Link Copied to Clipboard!' : 'Copy Meeting Link'}</span>
                </button>
              </div>
            </div>

            {/* Bottom Section: Host Meeting Link Updater */}
            {isHost && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#93c5fd' }}>
                    👑 Host Controls: Set or Change Google Meet Link
                  </div>
                  <a
                    href="https://meet.google.com/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.75rem',
                      color: '#67e8f9',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <span>🚀 Launch New Google Meet Room</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={googleMeetInput}
                    onChange={(e) => setGoogleMeetInput(e.target.value)}
                    placeholder="Paste Google Meet link (e.g. meet.google.com/abc-defg-hij)"
                    style={{
                      flex: 1,
                      padding: '0.55rem 0.85rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(0, 0, 0, 0.35)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                  <ClayButton
                    variant="primary"
                    size="sm"
                    onClick={handleSaveMeetLink}
                    disabled={isSavingMeetLink || !googleMeetInput.trim()}
                  >
                    {isSavingMeetLink ? 'Saving...' : 'Save & Sync'}
                  </ClayButton>
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
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.85rem 1.5rem',
              flexWrap: 'wrap'
            }}
          >
            {/* Quick Link Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <a
                href={canonicalMeetUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #00ac47, #00832d)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(0, 172, 71, 0.3)'
                }}
              >
                <Video size={16} />
                <span>Open Google Meet</span>
                <ExternalLink size={14} />
              </a>

              <button
                type="button"
                onClick={() => handleCopyMeetLink(canonicalMeetUrl)}
                className="clay-button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '14px',
                  background: '#f8fafc',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                {meetLinkCopied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                <span>{meetLinkCopied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Session Action: Learner ends & settles, Teacher leaves or closes solo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isLearner ? (
                <button
                  onClick={() => {
                    setSettledResult(null);
                    setSettleError(null);
                    setSettleModalOpen(true);
                  }}
                  className="clay-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '16px',
                    background: '#fee2e2',
                    color: '#dc2626',
                    fontWeight: 700,
                    fontSize: '0.875rem'
                  }}
                  title="End Call & Settle Session"
                >
                  <PhoneOff size={18} />
                  <span>End Session & Settle</span>
                </button>
              ) : isSoloSession ? (
                <button
                  onClick={() => {
                    setSettledResult(null);
                    setSettleError(null);
                    setSettleModalOpen(true);
                  }}
                  className="clay-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '16px',
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.875rem'
                  }}
                  title="Close Broadcast"
                >
                  <PhoneOff size={18} />
                  <span>Close Broadcast</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (confirm('Leave classroom? The active session will conclude when the student ends it, and settled TimeCredits will transfer to your wallet.')) {
                      handleExitClassroom('dashboard');
                    }
                  }}
                  className="clay-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '16px',
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.875rem'
                  }}
                >
                  <PhoneOff size={18} />
                  <span>Leave Classroom</span>
                </button>
              )}

              <ClayButton variant="secondary" onClick={() => setActiveTab(activeTab === 'whiteboard' ? 'chat' : 'whiteboard')}>
                {activeTab === 'whiteboard' ? 'Classroom Chat' : 'Whiteboard'}
              </ClayButton>
            </div>
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
        title={
          settledResult
            ? (isHost && !isLearner ? "🎉 Class Completed by Student!" : "Session Successfully Ended & Settled!")
            : (isHost && isSoloSession ? "Close Online Broadcast" : (isHost ? "Instructor Classroom View" : "Complete Session & Settle TimeCredits"))
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {settledResult ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--pastel-mint-bg)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8)' }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                {isHost && !isLearner ? "Class Completed by Student!" : "Session Successfully Ended!"}
              </h3>
              <p style={{ color: '#475569', fontSize: '0.875rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
                {isHost && !isLearner
                  ? <>Completed <strong>{settledResult.duration} minutes</strong> • You received <strong>+{Number(settledResult.credits || 0).toFixed(2)} TC</strong> transferred directly to your TimeCredit wallet.</>
                  : <>Completed <strong>{settledResult.duration} minutes</strong> • Settled <strong>{Number(settledResult.credits || 0).toFixed(2)} TC</strong> to instructor <strong>{remoteUserName}</strong> via atomic transaction.</>
                }
              </p>

              {/* POST-SESSION REVIEW OPTION */}
              <div style={{ marginTop: '1.25rem', padding: '1.25rem', borderRadius: '18px', background: '#f8fafc', border: '1.5px solid #e2e8f0', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Star size={18} color="#f59e0b" fill="#f59e0b" />
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Rate Your Peer's Work</strong>
                  </div>
                  <ClayBadge variant="lavender">Post-Session Review</ClayBadge>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.75rem' }}>
                  Rate the work and collaboration of <strong>{remoteUserName}</strong>. Your feedback is stored in PostgreSQL and displayed on their public instructor profile.
                </p>

                {reviewSubmitted ? (
                  <div style={{ padding: '0.85rem', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700 }}>
                    ✓ Thank you! Your review has been saved to the database.
                  </div>
                ) : (
                  <>
                    {/* Star Rating Input */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                      {[1, 2, 3, 4, 5].map(star => {
                        const isFilled = star <= (reviewHoverRating || reviewRating);
                        return (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setReviewHoverRating(star)}
                            onMouseLeave={() => setReviewHoverRating(0)}
                            onClick={() => setReviewRating(star)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: '2px',
                              color: isFilled ? '#f59e0b' : '#cbd5e1',
                              transition: 'transform 0.15s ease'
                            }}
                            title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          >
                            <Star size={30} fill={isFilled ? '#f59e0b' : 'none'} />
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.75rem' }}>
                      {reviewRating === 5 ? '⭐⭐⭐⭐⭐ Exceptional (5 / 5)' :
                       reviewRating === 4 ? '⭐⭐⭐⭐ Very Good (4 / 5)' :
                       reviewRating === 3 ? '⭐⭐⭐ Average (3 / 5)' :
                       reviewRating === 2 ? '⭐⭐ Needs Improvement (2 / 5)' : '⭐ Unsatisfactory (1 / 5)'}
                    </div>

                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your thoughts on the teaching clarity, knowledge depth, problem solving, and patience..."
                      style={{
                        width: '100%',
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        padding: '0.65rem',
                        minHeight: '65px',
                        fontSize: '0.825rem',
                        outline: 'none',
                        background: '#ffffff',
                        fontFamily: 'inherit'
                      }}
                    />

                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <ClayButton
                        size="sm"
                        variant="primary"
                        onClick={handleSubmitReview}
                        disabled={reviewSubmitting}
                        icon={<Sparkles size={14} />}
                      >
                        {reviewSubmitting ? 'Saving Review...' : 'Submit Review'}
                      </ClayButton>
                    </div>
                  </>
                )}
              </div>

              {/* Exit navigation options */}
              <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.65rem' }}>
                <ClayButton variant="primary" onClick={() => handleExitClassroom('wallet')}>
                  View Wallet & Ledger
                </ClayButton>
                <ClayButton variant="secondary" onClick={() => handleExitClassroom('classroom')}>
                  Return to Empty Classroom
                </ClayButton>
                <ClayButton variant="secondary" onClick={() => handleExitClassroom('dashboard')}>
                  Return to Dashboard
                </ClayButton>
              </div>
            </div>
          ) : isHost && !isSoloSession ? (
            /* Teacher view during active class with student */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Active Student:</span>
                  <strong>{remoteUserName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Class Elapsed Duration:</span>
                  <strong>{elapsedMinutes} minutes</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Your Credit Earnings Rate:</span>
                  <strong>{Number(creditRate || 0).toFixed(2)} TC / hr</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', fontSize: '1rem' }}>
                  <span style={{ fontWeight: 700 }}>Accumulated Earnings:</span>
                  <strong style={{ color: '#059669' }}>+{Number(accruedCredits || 0).toFixed(2)} TC</strong>
                </div>
              </div>

              <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                💡 <strong>Instructor Note:</strong> The student will click <strong>End Session</strong> when they are finished to conclude the call and trigger the automated credit settlement into your wallet. You can safely return to the dashboard at any time.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <ClayButton variant="secondary" onClick={() => setSettleModalOpen(false)}>
                  Stay in Class
                </ClayButton>
                <ClayButton variant="primary" onClick={() => handleExitClassroom('dashboard')}>
                  Exit to Dashboard
                </ClayButton>
              </div>
            </div>
          ) : isHost && isSoloSession ? (
            /* Teacher view during solo broadcast */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: '#475569', fontSize: '0.925rem', lineHeight: 1.5, margin: 0 }}>
                No student has joined this broadcast yet. Closing this broadcast will return the classroom to an empty idle state and remove the listing from the browse catalog:
              </p>

              <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Broadcast Duration:</span>
                  <strong>{elapsedMinutes} minutes</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Settlement Amount:</span>
                  <strong>0.00 TC (Solo Broadcast)</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <ClayButton variant="secondary" onClick={() => setSettleModalOpen(false)}>
                  Stay in Broadcast
                </ClayButton>
                <ClayButton variant="danger" onClick={handleEndAndSettle} disabled={settling} icon={<PhoneOff size={16} />}>
                  {settling ? 'Closing...' : 'Confirm & Close Broadcast'}
                </ClayButton>
              </div>
            </div>
          ) : (
            /* Learner settlement view */
            <>
              {settleError && (
                <div style={{ padding: '0.85rem 1rem', borderRadius: '14px', background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Settlement Note:</strong> {settleError}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <ClayButton variant="danger" size="sm" onClick={() => handleExitClassroom('dashboard')}>
                      Force Exit & End Class
                    </ClayButton>
                  </div>
                </div>
              )}


              <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Completing this live classroom session will finish the call and trigger the <strong>ACID credit settlement</strong> transfer to your instructor <strong>{remoteUserName}</strong>:
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
