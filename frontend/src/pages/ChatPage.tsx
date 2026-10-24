import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  UserPlus,
  Send,
  Search,
  Check,
  X,
  Clock,
  Sparkles,
  Video,
  ShieldCheck,
  UserCheck,
  Mail,
  User,
  CheckCheck,
  Inbox
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayInput } from '../components/clay/ClayInput';
import { ClayModal } from '../components/clay/ClayModal';
import { api } from '../services/api';
import type {
  User as CurrentUserType,
  Conversation,
  DirectMessage,
  FriendUser,
  FriendRequest
} from '../types';

interface ChatPageProps {
  currentUser: CurrentUserType;
  onNavigate: (page: string) => void;
  initialPeerId?: number;
}

export const ChatPage: React.FC<ChatPageProps> = ({ currentUser, onNavigate, initialPeerId }) => {
  // Navigation tabs in left sidebar
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'requests'>('chats');
  const [searchFilter, setSearchFilter] = useState('');

  // Conversations, friends, and requests state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friendsList, setFriendsList] = useState<FriendUser[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Active chat state
  const [activePeer, setActivePeer] = useState<{
    id: number;
    full_name: string;
    email: string;
    bio?: string;
    role?: string;
    is_friend?: boolean;
  } | null>(null);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Add friend search modal
  const [addFriendModalOpen, setAddFriendModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; full_name: string; email: string; bio?: string; role: string }>>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [requestStatus, setRequestStatus] = useState<{ [userId: number]: string }>({});

  // Live database search results for left sidebar search input
  const [dbSearchResults, setDbSearchResults] = useState<Array<{
    id: number;
    full_name: string;
    email: string;
    bio?: string;
    role: string;
    is_friend?: boolean;
    friendship_status?: string | null;
    is_pending_sent?: boolean;
  }>>([]);
  const [searchingDb, setSearchingDb] = useState(false);

  // Live search from PostgreSQL Neon database when user types in searchFilter
  useEffect(() => {
    const trimmed = searchFilter.trim();
    if (!trimmed) {
      setDbSearchResults([]);
      setSearchingDb(false);
      return;
    }

    setSearchingDb(true);
    const timer = setTimeout(async () => {
      try {
        const users = await api.searchUsersDirectory(trimmed);
        setDbSearchResults(users);
      } catch (err) {
        console.warn('Live database directory search failed:', err);
      } finally {
        setSearchingDb(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchFilter]);

  // 1. Initial Load of Conversations, Friends, and Requests
  useEffect(() => {
    loadAllChatData();
    const interval = setInterval(loadAllChatData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAllChatData = async () => {
    try {
      const [convs, friendsData] = await Promise.all([
        api.getConversations(),
        api.getFriends()
      ]);

      setConversations(convs);
      setFriendsList(friendsData.friends || []);
      setPendingReceived(friendsData.pending_received || []);
      setPendingSent(friendsData.pending_sent || []);

      // If initialPeerId was provided and no active peer yet, select it
      if (initialPeerId && !activePeer) {
        const matchingConv = convs.find(c => c.peer_id === initialPeerId);
        if (matchingConv) {
          selectPeer({
            id: matchingConv.peer_id,
            full_name: matchingConv.full_name,
            email: matchingConv.email,
            bio: matchingConv.bio,
            role: matchingConv.role,
            is_friend: matchingConv.is_friend
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load chat data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // 2. Load Messages when Active Peer changes
  useEffect(() => {
    if (!activePeer) return;

    let isMounted = true;
    const fetchMessages = async () => {
      try {
        const msgs = await api.getDirectMessages(activePeer.id);
        if (isMounted) {
          setMessages(msgs);
        }
      } catch (err) {
        console.warn('Error fetching messages:', err);
      }
    };

    fetchMessages();
    const pollInterval = setInterval(fetchMessages, 2500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [activePeer?.id]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectPeer = (peer: {
    id: number;
    full_name: string;
    email: string;
    bio?: string;
    role?: string;
    is_friend?: boolean;
  }) => {
    setActivePeer(peer);
    setMessages([]);
  };

  // Handle Send Direct Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activePeer || !messageText.trim() || sendingMessage) return;

    const text = messageText.trim();
    setMessageText('');
    setSendingMessage(true);

    // Optimistic message append
    const tempMsg: DirectMessage = {
      id: Date.now(),
      sender_id: currentUser.id,
      receiver_id: activePeer.id,
      sender_name: currentUser.full_name,
      message: text,
      is_read: false,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await api.sendDirectMessage(activePeer.id, text);
      // Refresh messages and conversations list
      const updatedMsgs = await api.getDirectMessages(activePeer.id);
      setMessages(updatedMsgs);
      loadAllChatData();
    } catch (err: any) {
      alert('Failed to send message: ' + (err?.message || 'Network error'));
    } finally {
      setSendingMessage(false);
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (requestId: number) => {
    try {
      await api.acceptFriendRequest(requestId);
      loadAllChatData();
    } catch (err: any) {
      alert('Error accepting friend request: ' + (err?.message || 'Unknown error'));
    }
  };

  // Decline Friend Request
  const handleDeclineRequest = async (requestId: number) => {
    try {
      await api.declineFriendRequest(requestId);
      loadAllChatData();
    } catch (err: any) {
      alert('Error declining request: ' + (err?.message || 'Unknown error'));
    }
  };

  // Search User Directory for Adding Friends
  const handleSearchDirectory = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const results = await api.searchUsersDirectory(query);
      setSearchResults(results);
    } catch (err) {
      console.warn('Search directory error:', err);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Send Friend Request
  const handleSendFriendRequest = async (targetUserId: number) => {
    setRequestStatus(prev => ({ ...prev, [targetUserId]: 'sending' }));
    try {
      const res = await api.sendFriendRequest(targetUserId);
      setRequestStatus(prev => ({ ...prev, [targetUserId]: 'sent' }));
      loadAllChatData();
      alert(res.message || 'Friend request sent!');
    } catch (err: any) {
      alert('Could not send friend request: ' + (err?.message || 'Already connected or pending'));
      setRequestStatus(prev => ({ ...prev, [targetUserId]: 'error' }));
    }
  };

  // Filtered lists based on searchFilter
  const filteredConversations = useMemo(() => {
    return conversations.filter(c =>
      c.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.last_message && c.last_message.toLowerCase().includes(searchFilter.toLowerCase()))
    );
  }, [conversations, searchFilter]);

  const displayedConversations = useMemo(() => {
    const list = [...filteredConversations];
    if (activePeer && !list.some(c => c.peer_id === activePeer.id)) {
      list.unshift({
        peer_id: activePeer.id,
        full_name: activePeer.full_name,
        email: activePeer.email,
        bio: activePeer.bio,
        role: activePeer.role || 'member',
        last_message: 'Drafting new message...',
        last_message_time: new Date().toISOString(),
        unread_count: 0,
        is_friend: !!activePeer.is_friend
      });
    }
    return list;
  }, [filteredConversations, activePeer]);

  const filteredFriends = useMemo(() => {
    return friendsList.filter(f =>
      f.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.email.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [friendsList, searchFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <MessageSquare color="#6366f1" size={28} />
            Peer Chat & Community
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Direct messaging, collaborative learning partners, and peer friendship requests.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ClayButton
            variant="primary"
            onClick={() => {
              setAddFriendModalOpen(true);
              handleSearchDirectory('');
            }}
            icon={<UserPlus size={16} />}
          >
            + Add / Find Friends
          </ClayButton>

          <ClayButton
            variant="secondary"
            onClick={() => onNavigate('classroom')}
            icon={<Video size={16} />}
          >
            Live Classroom
          </ClayButton>
        </div>
      </div>

      {/* Main Split Layout: Left Navigation / Contact List, Right Message Thread */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.25rem', minHeight: '680px', alignItems: 'stretch' }}>
        
        {/* ================================================================= */}
        {/* LEFT PANEL: CONVERSATIONS, FRIENDS, REQUESTS                      */}
        {/* ================================================================= */}
        <ClayCard variant="raised" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '1rem' }}>
          
          {/* 3 Sub-tabs */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '14px', gap: '0.25rem' }}>
            <button
              onClick={() => setActiveTab('chats')}
              style={{
                flex: 1,
                border: 'none',
                padding: '0.5rem 0.25rem',
                borderRadius: '10px',
                background: activeTab === 'chats' ? '#ffffff' : 'transparent',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: activeTab === 'chats' ? '#4338ca' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                boxShadow: activeTab === 'chats' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <MessageSquare size={14} />
              <span>Chats</span>
              {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0) > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '999px', fontWeight: 800 }}>
                  {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('friends')}
              style={{
                flex: 1,
                border: 'none',
                padding: '0.5rem 0.25rem',
                borderRadius: '10px',
                background: activeTab === 'friends' ? '#ffffff' : 'transparent',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: activeTab === 'friends' ? '#4338ca' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                boxShadow: activeTab === 'friends' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Users size={14} />
              <span>Friends</span>
              {friendsList.length > 0 && (
                <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '999px', fontWeight: 800 }}>
                  {friendsList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              style={{
                flex: 1,
                border: 'none',
                padding: '0.5rem 0.25rem',
                borderRadius: '10px',
                background: activeTab === 'requests' ? '#ffffff' : 'transparent',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: activeTab === 'requests' ? '#4338ca' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                boxShadow: activeTab === 'requests' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Inbox size={14} />
              <span>Requests</span>
              {pendingReceived.length > 0 && (
                <span style={{ background: '#22c55e', color: '#fff', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '999px', fontWeight: 800 }}>
                  {pendingReceived.length}
                </span>
              )}
            </button>
          </div>

          {/* Search box for finding friends directly from database */}
          <div style={{ position: 'relative' }}>
            <ClayInput
              placeholder="Search friend name or email (e.g. Rocky)..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
            />
            <Search
              size={15}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
          </div>

          {/* List Body */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '520px' }}>
            
            {/* LIVE DATABASE SEARCH RESULTS (When user searches any name/email) */}
            {searchFilter.trim().length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.25rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {searchingDb ? 'Searching Neon Database...' : `Database Members Found (${dbSearchResults.length})`}
                  </span>
                  <button
                    onClick={() => setSearchFilter('')}
                    style={{ border: 'none', background: 'transparent', color: '#6366f1', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                </div>

                {searchingDb ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    Fetching "{searchFilter}" from database...
                  </div>
                ) : dbSearchResults.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                    <User size={30} style={{ margin: '0 auto 0.4rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>No member named "{searchFilter}" found in database</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Check spelling or try searching by email address.</p>
                  </div>
                ) : (
                  dbSearchResults.map(dbUser => {
                    const isSelected = activePeer?.id === dbUser.id;
                    const isFriend = dbUser.is_friend || friendsList.some(f => f.user_id === dbUser.id);
                    const isPending = dbUser.is_pending_sent || pendingSent.some(p => p.receiver_id === dbUser.id) || requestStatus[dbUser.id] === 'sent';
                    const isSending = requestStatus[dbUser.id] === 'sending';

                    return (
                      <div
                        key={dbUser.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.65rem',
                          padding: '0.65rem 0.75rem',
                          borderRadius: '16px',
                          background: isSelected ? 'var(--pastel-lavender-bg)' : '#ffffff',
                          border: isSelected ? '1.5px solid #6366f1' : '1px solid #f1f5f9',
                          boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.12)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Avatar & User Details */}
                        <div
                          onClick={() => selectPeer({
                            id: dbUser.id,
                            full_name: dbUser.full_name,
                            email: dbUser.email,
                            bio: dbUser.bio,
                            role: dbUser.role,
                            is_friend: isFriend
                          })}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, cursor: 'pointer', minWidth: 0 }}
                          title={`Click to open chat with ${dbUser.full_name}`}
                        >
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '13px',
                              background: isFriend ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '1rem',
                              flexShrink: 0
                            }}
                          >
                            {dbUser.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {dbUser.full_name}
                              </span>
                              {isFriend && (
                                <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 800 }}>✓ Friend</span>
                              )}
                            </div>
                            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {dbUser.email}
                            </p>
                          </div>
                        </div>

                        {/* Actions: Chat & Add Friend */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                          <ClayButton
                            size="sm"
                            variant="primary"
                            onClick={() => selectPeer({
                              id: dbUser.id,
                              full_name: dbUser.full_name,
                              email: dbUser.email,
                              bio: dbUser.bio,
                              role: dbUser.role,
                              is_friend: isFriend
                            })}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          >
                            Chat
                          </ClayButton>

                          {!isFriend && !isPending && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendFriendRequest(dbUser.id);
                              }}
                              disabled={isSending}
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #86efac',
                                color: '#16a34a',
                                borderRadius: '10px',
                                padding: '0.35rem 0.6rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title="Send Friend Request"
                            >
                              <UserPlus size={12} />
                              <span>{isSending ? '...' : '+ Add'}</span>
                            </button>
                          )}

                          {isPending && (
                            <ClayBadge variant="lavender" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                              Pending
                            </ClayBadge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Also display any active matching conversations not already in dbSearchResults */}
                {(() => {
                  const otherActiveChats = filteredConversations.filter(
                    conv => !dbSearchResults.some(dbU => dbU.id === conv.peer_id)
                  );
                  if (otherActiveChats.length === 0) return null;
                  return (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Active Chats ({otherActiveChats.length})
                      </div>
                      {otherActiveChats.map(conv => {
                        const isSelected = activePeer?.id === conv.peer_id;
                        return (
                          <div
                            key={conv.peer_id}
                            onClick={() => selectPeer({
                              id: conv.peer_id,
                              full_name: conv.full_name,
                              email: conv.email,
                              bio: conv.bio,
                              role: conv.role,
                              is_friend: conv.is_friend
                            })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.65rem',
                              padding: '0.6rem 0.75rem',
                              borderRadius: '14px',
                              cursor: 'pointer',
                              background: isSelected ? 'var(--pastel-lavender-bg)' : '#ffffff',
                              border: isSelected ? '1.5px solid #6366f1' : '1px solid #f1f5f9',
                              marginBottom: '0.35rem'
                            }}
                          >
                            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#e2e8f0', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                              {conv.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{conv.full_name}</div>
                              <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {conv.last_message || 'Active conversation'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
                {/* 1. CHATS TAB */}
                {activeTab === 'chats' && (
                  <>
                    {displayedConversations.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                        <MessageSquare size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No conversations yet</p>
                        <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          Type a friend's name in the search box above to find them in the database!
                        </p>
                      </div>
                    ) : (
                      displayedConversations.map(conv => {
                        const isSelected = activePeer?.id === conv.peer_id;
                        return (
                          <div
                            key={conv.peer_id}
                            onClick={() => selectPeer({
                              id: conv.peer_id,
                              full_name: conv.full_name,
                              email: conv.email,
                              bio: conv.bio,
                              role: conv.role,
                              is_friend: conv.is_friend
                            })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.65rem 0.75rem',
                              borderRadius: '16px',
                              cursor: 'pointer',
                              background: isSelected ? 'var(--pastel-lavender-bg)' : '#ffffff',
                              border: isSelected ? '1.5px solid #6366f1' : '1px solid #f1f5f9',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.12)' : 'none'
                            }}
                          >
                            {/* Avatar */}
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '14px',
                                background: isSelected
                                  ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                                  : 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
                                color: isSelected ? '#ffffff' : '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '1rem',
                                flexShrink: 0
                              }}
                            >
                              {conv.full_name.charAt(0).toUpperCase()}
                            </div>

                            {/* Name and preview */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {conv.full_name}
                                </span>
                                {conv.last_message_time && (
                                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                    {new Date(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                                {conv.last_message || 'Start a conversation...'}
                              </p>
                            </div>

                            {/* Unread badge */}
                            {conv.unread_count > 0 && (
                              <div style={{ background: '#6366f1', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '999px' }}>
                                {conv.unread_count}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}

                {/* 2. FRIENDS TAB */}
                {activeTab === 'friends' && (
                  <>
                    {filteredFriends.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                        <Users size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No friends connected yet</p>
                        <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          Type your friend's name in the search box to find them in the database!
                        </p>
                      </div>
                    ) : (
                      filteredFriends.map(friend => (
                        <div
                          key={friend.friendship_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem',
                            borderRadius: '16px',
                            background: '#ffffff',
                            border: '1px solid #f1f5f9'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.9rem'
                              }}
                            >
                              {friend.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                {friend.full_name}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                {friend.email}
                              </div>
                            </div>
                          </div>

                          <ClayButton
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              selectPeer({
                                id: friend.user_id,
                                full_name: friend.full_name,
                                email: friend.email,
                                bio: friend.bio,
                                role: friend.role,
                                is_friend: true
                              });
                            }}
                          >
                            Chat
                          </ClayButton>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 3. REQUESTS TAB */}
                {activeTab === 'requests' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Incoming Requests */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                        Received Requests ({pendingReceived.length})
                      </div>
                      {pendingReceived.length === 0 ? (
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No pending incoming friend requests.</p>
                      ) : (
                        pendingReceived.map(req => (
                          <div
                            key={req.request_id}
                            style={{
                              padding: '0.75rem',
                              borderRadius: '16px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              marginBottom: '0.5rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                                {req.sender_name?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                  {req.sender_name}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  {req.sender_email}
                                </div>
                              </div>
                            </div>

                            {req.sender_bio && (
                              <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 0.5rem', fontStyle: 'italic' }}>
                                "{req.sender_bio}"
                              </p>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <ClayButton
                                size="sm"
                                variant="mint"
                                onClick={() => handleAcceptRequest(req.request_id)}
                                icon={<Check size={13} />}
                                style={{ flex: 1, padding: '0.35rem' }}
                              >
                                Accept
                              </ClayButton>
                              <ClayButton
                                size="sm"
                                variant="secondary"
                                onClick={() => handleDeclineRequest(req.request_id)}
                                icon={<X size={13} />}
                                style={{ flex: 1, padding: '0.35rem' }}
                              >
                                Decline
                              </ClayButton>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Sent Requests */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                        Outgoing Pending Requests ({pendingSent.length})
                      </div>
                      {pendingSent.length === 0 ? (
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No pending requests sent by you.</p>
                      ) : (
                        pendingSent.map(req => (
                          <div
                            key={req.request_id}
                            style={{
                              padding: '0.65rem 0.75rem',
                              borderRadius: '14px',
                              background: '#ffffff',
                              border: '1px solid #f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '0.35rem'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                {req.receiver_name || req.receiver_email}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                Sent on {new Date(req.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <ClayBadge variant="lavender" style={{ fontSize: '0.65rem' }}>
                              Pending
                            </ClayBadge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ClayCard>

        {/* ================================================================= */}
        {/* RIGHT PANEL: LIVE DIRECT CHAT CONVERSATION VIEW                   */}
        {/* ================================================================= */}
        <ClayCard variant="inset" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff', overflow: 'hidden', padding: 0 }}>
          
          {activePeer ? (
            <>
              {/* Conversation Header */}
              <div
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid #f1f5f9',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                    }}
                  >
                    {activePeer.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        {activePeer.full_name}
                      </h2>
                      {activePeer.is_friend && (
                        <ClayBadge variant="mint" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                          ✓ Friends
                        </ClayBadge>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.6rem', marginTop: '2px' }}>
                      <span>{activePeer.email}</span>
                      {activePeer.bio && <span>• {activePeer.bio}</span>}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  {!activePeer.is_friend && (
                    <ClayButton
                      size="sm"
                      variant="primary"
                      onClick={() => handleSendFriendRequest(activePeer.id)}
                      icon={<UserPlus size={14} />}
                    >
                      Add Friend
                    </ClayButton>
                  )}

                  <ClayButton
                    size="sm"
                    variant="secondary"
                    onClick={() => onNavigate('classroom')}
                    icon={<Video size={14} />}
                  >
                    Host Class with {activePeer.full_name.split(' ')[0]}
                  </ClayButton>
                </div>
              </div>

              {/* Message History Thread */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  background: '#f8fafc'
                }}
              >
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', margin: 'auto', padding: '2rem', color: '#94a3b8' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#e0e7ff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                      <Sparkles size={28} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      Start conversation with {activePeer.full_name}
                    </h3>
                    <p style={{ fontSize: '0.85rem', maxWidth: '380px', margin: '0.4rem auto 0', lineHeight: 1.5 }}>
                      Say hello, schedule a peer instruction lesson, or exchange study notes!
                    </p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_id === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          alignSelf: isMe ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div
                          style={{
                            padding: '0.75rem 1.15rem',
                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            background: isMe ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#ffffff',
                            color: isMe ? '#ffffff' : '#0f172a',
                            boxShadow: isMe ? '0 4px 12px rgba(99, 102, 241, 0.25)' : '0 2px 8px rgba(0,0,0,0.04)',
                            border: isMe ? 'none' : '1px solid #e2e8f0',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            wordBreak: 'break-word'
                          }}
                        >
                          {msg.message}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 4px' }}>
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && <CheckCheck size={12} color="#6366f1" />}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Dock */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: '1rem 1.25rem',
                  borderTop: '1px solid #f1f5f9',
                  background: '#ffffff',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center'
                }}
              >
                <input
                  type="text"
                  placeholder={`Write a message to ${activePeer.full_name}... (Press Enter to send)`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    borderRadius: '14px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />

                <ClayButton
                  variant="primary"
                  type="submit"
                  disabled={!messageText.trim() || sendingMessage}
                  icon={<Send size={16} />}
                >
                  Send
                </ClayButton>
              </form>
            </>
          ) : (
            /* Empty state when no peer is selected */
            <div style={{ textAlign: 'center', margin: 'auto', padding: '3rem 1.5rem', color: '#64748b' }}>
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '24px',
                  background: 'var(--pastel-lavender-bg)',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.15)'
                }}
              >
                <MessageSquare size={38} />
              </div>

              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Select a Peer or Friend to Chat
              </h2>
              <p style={{ fontSize: '0.9rem', maxWidth: '440px', margin: '0.5rem auto 1.5rem', lineHeight: 1.6 }}>
                Pick an existing conversation from the list on the left, or connect with peers across the platform using the button below.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <ClayButton
                  variant="primary"
                  onClick={() => {
                    setAddFriendModalOpen(true);
                    handleSearchDirectory('');
                  }}
                  icon={<UserPlus size={16} />}
                >
                  + Add / Find Friends
                </ClayButton>
                <ClayButton
                  variant="secondary"
                  onClick={() => onNavigate('browse')}
                  icon={<Search size={16} />}
                >
                  Browse Skill Catalog
                </ClayButton>
              </div>
            </div>
          )}
        </ClayCard>
      </div>

      {/* =================================================================== */}
      {/* ADD FRIEND / SEARCH USERS DIRECTORY MODAL                           */}
      {/* =================================================================== */}
      <ClayModal
        isOpen={addFriendModalOpen}
        onClose={() => setAddFriendModalOpen(false)}
        title="Find & Connect with Platform Members"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
            Search learners and teachers across TimeCredit Live by their name or email address to send a friend request.
          </p>

          <div style={{ position: 'relative' }}>
            <ClayInput
              placeholder="Search by name, email, or skill..."
              value={searchQuery}
              onChange={(e) => handleSearchDirectory(e.target.value)}
              style={{ paddingLeft: '2.4rem' }}
            />
            <Search
              size={18}
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
          </div>

          {/* Results List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '360px', overflowY: 'auto' }}>
            {searchingUsers ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>Searching members...</p>
            ) : searchResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                <User size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.875rem' }}>No members found matching "{searchQuery}"</p>
              </div>
            ) : (
              searchResults.map(user => {
                const isAlreadyFriend = friendsList.some(f => f.user_id === user.id);
                const isPendingSent = pendingSent.some(p => p.receiver_id === user.id);
                const isPendingReceived = pendingReceived.some(p => p.sender_id === user.id);
                const currentStatus = requestStatus[user.id];

                return (
                  <div
                    key={user.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      borderRadius: '16px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '14px',
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1.05rem'
                        }}
                      >
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                          {user.full_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {user.email} {user.bio ? `• ${user.bio}` : ''}
                        </div>
                      </div>
                    </div>

                    <div>
                      {isAlreadyFriend ? (
                        <ClayBadge variant="mint">Friends</ClayBadge>
                      ) : isPendingSent || currentStatus === 'sent' ? (
                        <ClayBadge variant="lavender">Request Pending</ClayBadge>
                      ) : isPendingReceived ? (
                        <ClayButton
                          size="sm"
                          variant="mint"
                          onClick={() => {
                            const req = pendingReceived.find(p => p.sender_id === user.id);
                            if (req) handleAcceptRequest(req.request_id);
                          }}
                        >
                          Accept Request
                        </ClayButton>
                      ) : (
                        <ClayButton
                          size="sm"
                          variant="primary"
                          disabled={currentStatus === 'sending'}
                          onClick={() => handleSendFriendRequest(user.id)}
                          icon={<UserPlus size={14} />}
                        >
                          {currentStatus === 'sending' ? 'Sending...' : 'Add Friend'}
                        </ClayButton>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <ClayButton variant="secondary" onClick={() => setAddFriendModalOpen(false)}>
              Close
            </ClayButton>
          </div>
        </div>
      </ClayModal>
    </div>
  );
};
