import React, { useState, useEffect, useRef } from 'react';
import { Loader, Send, Paperclip, MessageSquare } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat message auto scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Fetch unread count
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

  // Fetch chat messages for active chat
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

  // Chat messages polling loop
  useEffect(() => {
    if (!token) return;
    fetchUnreadCounts();
    if (activeChatStaffId) {
      fetchChatMessages(activeChatStaffId);
    }
    const interval = setInterval(() => {
      fetchUnreadCounts();
      if (activeChatStaffId) {
        fetchChatMessages(activeChatStaffId);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [token, activeChatStaffId]);

  const handleImageUpload = async (file: File): Promise<string> => {
    const authRes = await fetch(`${apiBase}/imagekit/auth`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!authRes.ok) {
      throw new Error('Could not fetch ImageKit signature');
    }
    const authParams = await authRes.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
    formData.append('signature', authParams.signature);
    formData.append('expire', authParams.expire.toString());
    formData.append('token', authParams.token);

    const upRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: formData
    });

    if (!upRes.ok) {
      throw new Error('Image upload failed');
    }
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
        } catch (err) {
          showToast('Failed to upload attachment', 'danger');
          setChatSending(false);
          return;
        }
      }
      const res = await fetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: activeChatStaffId,
          text: chatInputText,
          mediaUrl,
          mediaType
        })
      });
      if (res.ok) {
        setChatInputText('');
        setChatFile(null);
        setChatFilePreview('');
        fetchChatMessages(activeChatStaffId);
      } else {
        showToast('Failed to send message', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Error sending message', 'danger');
    } finally {
      setChatSending(false);
    }
  };

  const activeStaffMember = allStaff.find(s => s.id === activeChatStaffId || s._id === activeChatStaffId);

  return (
    <div className="chat-page-container">
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '4px' }}>Chat Hub</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Communicate with office staff members in real-time, share files and receipts.</p>
      </div>

      <div className="glass-panel chat-grid-container">
        
        {/* Left pane: User List */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            💬 Office Staff List
          </div>
          <div className="chat-user-list">
            {allStaff.map(staff => {
              const staffId = staff.id || staff._id || '';
              const isActive = activeChatStaffId === staffId;
              const unreadCount = unreadCounts[staffId] || 0;
              return (
                <button
                  key={staffId}
                  onClick={() => {
                    setActiveChatStaffId(staffId);
                    fetchChatMessages(staffId);
                  }}
                  className={`chat-user-item ${isActive ? 'active' : ''}`}
                >
                  {staff.imageUrl ? (
                    <img 
                      src={staff.imageUrl} 
                      alt={staff.name} 
                      style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '50%', 
                        objectFit: 'cover', 
                        border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)' 
                      }} 
                    />
                  ) : (
                    <div className="chat-user-avatar">
                      {staff.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flexGrow: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{staff.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{staff.username}</div>
                  </div>
                  {unreadCount > 0 && (
                    <span className="badge badge-danger" style={{ padding: '4px 8px', borderRadius: '50%', fontSize: '0.75rem' }}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
            {allStaff.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No staff users registered.
              </div>
            )}
          </div>
        </div>

        {/* Right pane: Chat Area */}
        <div className="chat-main-window">
          {activeChatStaffId ? (
            <>
              {/* Chat Header */}
              <div className="chat-active-header">
                {activeStaffMember?.imageUrl ? (
                  <img 
                    src={activeStaffMember.imageUrl} 
                    alt={activeStaffMember.name} 
                    style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '50%', 
                      objectFit: 'cover', 
                      border: '1px solid var(--glass-border)' 
                    }} 
                  />
                ) : (
                  <div className="chat-active-avatar">
                    {activeStaffMember?.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 700 }}>{activeStaffMember?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="chat-status-dot"></span> Online / Active Chat
                  </div>
                </div>
              </div>

              {/* Messages Window */}
              <div className="chat-messages-window">
                {chatMessages.map((msg, index) => {
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
                            <img
                              src={msg.mediaUrl}
                              alt="Attachment"
                              className="chat-message-img"
                            />
                          </a>
                        )}
                        <p className="message-text">
                          {msg.text}
                        </p>
                        <div className="chat-message-meta">
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isSender && (
                            <span style={{ color: msg.isRead ? '#3b82f6' : 'var(--text-secondary)' }}>
                              {msg.isRead ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {chatMessages.length === 0 && (
                  <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)', padding: '48px', textAlign: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '2rem' }}>💬</span>
                    <span>No messages in this chat yet. Start the conversation!</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Field */}
              <form onSubmit={handleSendChatMessage} className="chat-input-bar">
                {chatFilePreview && (
                  <div className="chat-file-preview-pill">
                    <img src={chatFilePreview} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    <span style={{ fontSize: '0.8rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatFile?.name}</span>
                    <button type="button" onClick={() => { setChatFile(null); setChatFilePreview(''); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-danger)' }}>✕</button>
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
                    type="text"
                    className="form-input"
                    placeholder="Type your message here..."
                    value={chatInputText}
                    onChange={e => setChatInputText(e.target.value)}
                    style={{ flexGrow: 1 }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }} disabled={chatSending}>
                    {chatSending ? <Loader className="spinner" size={16} /> : <Send size={18} />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)' }}>
              <MessageSquare size={48} style={{ opacity: 0.3 }} />
              <h3 style={{ fontWeight: 600 }}>No Chat Selected</h3>
              <p style={{ fontSize: '0.9rem' }}>Select an office staff member from the list to start messaging.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
