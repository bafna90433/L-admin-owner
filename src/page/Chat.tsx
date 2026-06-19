import React, { useState, useEffect, useRef } from 'react';
import { Loader, Send, Paperclip, MessageSquare, Trash2, AlertTriangle, X } from 'lucide-react';
import '../styles/Chat.css';

const IMAGEKIT_PUBLIC_KEY = 'public_LB0AyCgim15VO491kDtVm0Fo798=';

interface User {
  id: string;
  _id?: string;
  username: string;
  name: string;
  role: string;
  whatsapp?: string;
  imageUrl?: string;
}

interface ChatMessage {
  _id: string;
  sender: string;
  receiver: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'none' | 'image';
  isRead: boolean;
  createdAt: string;
}

interface ChatProps {
  token: string | null;
  user: User | null;
  apiBase: string;
  allStaff: User[];
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
  onUnreadChange: (counts: Record<string, number>) => void;
}

export default function Chat({
  token,
  user,
  apiBase,
  allStaff,
  showToast,
  onUnreadChange
}: ChatProps) {
  const [activeChatStaffId, setActiveChatStaffId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [chatInputText, setChatInputText] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatFilePreview, setChatFilePreview] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchUnreadCounts = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/messages/unread/count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCounts(data);
        onUnreadChange(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChatMessages = async (userId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/messages/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
        fetchUnreadCounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchUnreadCounts();
    if (activeChatStaffId) fetchChatMessages(activeChatStaffId);
    const interval = setInterval(() => {
      fetchUnreadCounts();
      if (activeChatStaffId) fetchChatMessages(activeChatStaffId);
    }, 4000);
    return () => clearInterval(interval);
  }, [token, activeChatStaffId]);

  const handleImageUpload = async (file: File): Promise<string> => {
    const authRes = await fetch(`${apiBase}/imagekit/auth`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!authRes.ok) throw new Error('Could not fetch ImageKit signature');
    const authParams = await authRes.json();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
    formData.append('signature', authParams.signature);
    formData.append('expire', authParams.expire.toString());
    formData.append('token', authParams.token);
    const upRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
    if (!upRes.ok) throw new Error('Image upload failed');
    const upData = await upRes.json();
    return upData.url;
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatStaffId || (!chatInputText.trim() && !chatFile)) return;
    setChatSending(true);
    try {
      let mediaUrl = '';
      let mediaType: 'none' | 'image' = 'none';
      if (chatFile) {
        try {
          mediaUrl = await handleImageUpload(chatFile);
          mediaType = 'image';
        } catch {
          showToast('Failed to upload attachment', 'danger');
          setChatSending(false);
          return;
        }
      }
      const res = await fetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ receiverId: activeChatStaffId, text: chatInputText, mediaUrl, mediaType })
      });
      if (res.ok) {
        setChatInputText('');
        setChatFile(null);
        setChatFilePreview('');
        fetchChatMessages(activeChatStaffId);
        inputRef.current?.focus();
      } else {
        showToast('Failed to send message', 'danger');
      }
    } catch {
      showToast('Error sending message', 'danger');
    } finally {
      setChatSending(false);
    }
  };

  const executeClearChat = async () => {
    setShowClearConfirm(false);
    if (!activeChatStaffId) return;
    try {
      const res = await fetch(`${apiBase}/messages/${activeChatStaffId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Chat cleared successfully', 'success');
        setChatMessages([]);
      } else {
        showToast('Failed to clear chat', 'danger');
      }
    } catch {
      showToast('Error clearing chat', 'danger');
    }
  };

  const activeStaffMember = allStaff.find(s => s.id === activeChatStaffId || s._id === activeChatStaffId);
  const filteredStaff = allStaff.filter(s => s.name.toLowerCase().includes(sidebarSearch.toLowerCase()));

  // Group messages by date
  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { date: string; msgs: ChatMessage[] }[] = [];
    messages.forEach(msg => {
      const d = new Date(msg.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      let label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      if (d.toDateString() === today.toDateString()) label = 'Today';
      else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      const last = groups[groups.length - 1];
      if (last && last.date === label) last.msgs.push(msg);
      else groups.push({ date: label, msgs: [msg] });
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(chatMessages);

  return (
    <div className="chat-page-container">
      <div className="chat-page-title">
        <div>
          <h1>💬 Chat Hub</h1>
          <p>Communicate with office staff members in real-time, share files and receipts.</p>
        </div>
      </div>

      <div className="chat-grid-container">

        {/* ─── LEFT SIDEBAR ─── */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <MessageSquare size={18} />
            Conversations
          </div>

          <div className="chat-sidebar-search">
            <input
              type="text"
              placeholder="🔍 Search staff..."
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
            />
          </div>

          <div className="chat-user-list">
            {filteredStaff.map(staff => {
              const staffId = staff.id || staff._id || '';
              const isActive = activeChatStaffId === staffId;
              const unreadCount = unreadCounts[staffId] || 0;
              return (
                <button
                  key={staffId}
                  onClick={() => {
                    setActiveChatStaffId(staffId);
                    fetchChatMessages(staffId);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  className={`chat-user-item ${isActive ? 'active' : ''}`}
                >
                  {staff.imageUrl ? (
                    <img
                      src={staff.imageUrl}
                      alt={staff.name}
                      style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div className="chat-user-avatar">
                      {staff.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="chat-user-info">
                    <div className="chat-user-name">{staff.name}</div>
                    <div className="chat-user-role">@{staff.username}</div>
                  </div>
                  {unreadCount > 0 && (
                    <span className="chat-unread-badge">{unreadCount}</span>
                  )}
                </button>
              );
            })}
            {filteredStaff.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                No staff found
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT CHAT WINDOW ─── */}
        <div className="chat-main-window">
          {activeChatStaffId ? (
            <>
              {/* Header */}
              <div className="chat-active-header">
                {activeStaffMember?.imageUrl ? (
                  <img
                    src={activeStaffMember.imageUrl}
                    alt={activeStaffMember.name}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div className="chat-active-avatar">
                    {activeStaffMember?.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {activeStaffMember?.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span className="chat-status-dot"></span>
                    Active Chat
                  </div>
                </div>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="chat-clear-btn"
                  title="Clear Chat"
                >
                  <Trash2 size={17} />
                </button>
              </div>

              {/* Messages */}
              <div className="chat-messages-window">
                {chatMessages.length === 0 ? (
                  <div className="chat-empty-state">
                    <div className="chat-empty-lock">
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>🔒 End-to-End Encrypted</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        No messages yet. Start the conversation!
                      </p>
                    </div>
                  </div>
                ) : (
                  messageGroups.map(group => (
                    <React.Fragment key={group.date}>
                      <div className="chat-date-divider">{group.date}</div>
                      {group.msgs.map((msg, index) => {
                        const isSender = msg.sender === (user?._id || user?.id);
                        return (
                          <div
                            key={msg._id || index}
                            className="chat-message-bubble-wrapper"
                            style={{ alignSelf: isSender ? 'flex-end' : 'flex-start' }}
                          >
                            <div className={`chat-message-bubble ${isSender ? 'sender' : 'receiver'}`}>
                              {msg.mediaUrl && msg.mediaType === 'image' && (
                                <a href={msg.mediaUrl} target="_blank" rel="noreferrer">
                                  <img src={msg.mediaUrl} alt="Attachment" className="chat-message-img" />
                                </a>
                              )}
                              {msg.text && <p className="message-text">{msg.text}</p>}
                              <div className="chat-message-meta">
                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {isSender && (
                                  <span style={{ color: msg.isRead ? '#60a5fa' : 'inherit' }}>
                                    {msg.isRead ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <form onSubmit={handleSendChatMessage} className="chat-input-bar">
                {chatFilePreview && (
                  <div className="chat-file-preview-pill">
                    <img src={chatFilePreview} alt="Preview" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px' }} />
                    <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {chatFile?.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setChatFile(null); setChatFilePreview(''); }}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-danger)', display: 'flex', padding: '2px' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div className="chat-input-controls">
                  <label className="chat-attach-btn" title="Attach Photo">
                    <Paperclip size={18} style={{ color: 'var(--text-secondary)' }} />
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setChatFile(file);
                          setChatFilePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    className="chat-text-input"
                    placeholder="Type a message..."
                    value={chatInputText}
                    onChange={e => setChatInputText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChatMessage(e as any);
                      }
                    }}
                  />
                  <button type="submit" className="chat-send-btn" disabled={chatSending}>
                    {chatSending ? <Loader size={16} className="spinner" /> : <Send size={16} />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="chat-no-select">
              <div className="chat-no-select-icon">
                <MessageSquare size={40} />
              </div>
              <h3 style={{ fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Select a Conversation</h3>
              <p style={{ fontSize: '0.9rem', textAlign: 'center', maxWidth: '260px', lineHeight: 1.6 }}>
                Choose an office staff member from the left panel to start messaging.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── CLEAR CHAT CONFIRM MODAL ─── */}
      {showClearConfirm && (
        <div className="chat-confirm-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="chat-confirm-card" onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: '16px', color: 'var(--color-danger)', display: 'flex', justifyContent: 'center' }}>
              <AlertTriangle size={44} />
            </div>
            <h3 style={{ marginBottom: '10px', fontSize: '1.2rem', fontWeight: 700 }}>Clear Chat?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: 1.6 }}>
              All messages in this chat will be permanently deleted. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
              >
                Cancel
              </button>
              <button
                onClick={executeClearChat}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: 'var(--color-danger)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
