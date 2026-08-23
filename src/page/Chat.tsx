import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CornerUpLeft, Loader, MessageSquare, Paperclip, Plus, Search, Send, Smile, Trash2, UsersRound, X } from 'lucide-react';
import '../styles/Chat.css';

const IMAGEKIT_PUBLIC_KEY = 'public_LB0AyCgim15VO491kDtVm0Fo798=';

interface User { id: string; _id?: string; username: string; name: string; role: string; imageUrl?: string }
interface ChatMessage { id?: string; _id?: string; sender: string; receiver?: string; text: string; mediaUrl?: string; mediaType?: string; isRead?: boolean; createdAt: string; senderUser?: User }
interface GroupMember { userId: string; isAdmin: boolean; user: User }
interface ChatGroup { id: string; name: string; description: string; avatarUrl?: string; members: GroupMember[]; unreadCount: number; lastMessage?: ChatMessage | null }
interface ChatProps { token: string | null; user: User | null; apiBase: string; allStaff: User[]; showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void; onUnreadChange: (counts: Record<string, number>) => void }
type Conversation = { kind: 'direct' | 'group'; id: string };

const userIdOf = (value?: User | null) => value?._id || value?.id || '';
const sameMessages = (a: ChatMessage[], b: ChatMessage[]) => a.length === b.length && a[a.length - 1]?.createdAt === b[b.length - 1]?.createdAt && a[a.length - 1]?.isRead === b[b.length - 1]?.isRead;

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '😊', '🎉', '👌', '💯', '💡', '✅', '❌', '📌', '💬', '🚀', '🤩', '🤝', '📷', '💰', '💪', '✨'];

const parseQuote = (text: string) => {
  if (!text) return { quoteAuthor: null, quoteText: null, bodyText: '' };
  const match = text.match(/^>\s*\[reply:(.*?)\]\s*(.*?)\n+([\s\S]*)$/);
  if (match) {
    return { quoteAuthor: match[1], quoteText: match[2], bodyText: match[3] };
  }
  const altMatch = text.match(/^>\s*(.*?):\s*(.*?)\n+([\s\S]*)$/);
  if (altMatch) {
    return { quoteAuthor: altMatch[1], quoteText: altMatch[2], bodyText: altMatch[3] };
  }
  return { quoteAuthor: null, quoteText: null, bodyText: text };
};

export default function Chat({ token, user, apiBase, allStaff, showToast, onUnreadChange }: ChatProps) {
  const [chatUsers, setChatUsers] = useState<User[]>(allStaff);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [directUnread, setDirectUnread] = useState<Record<string, number>>({});
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; senderName: string; text: string } | null>(null);
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const authHeaders = { Authorization: `Bearer ${token}` };
  const currentUserId = userIdOf(user);
  const activeGroup = active?.kind === 'group' ? groups.find(group => group.id === active.id) : undefined;
  const activeUser = active?.kind === 'direct' ? chatUsers.find(item => userIdOf(item) === active.id) : undefined;

  const loadChatUsers = async () => { if (!token) return; const response = await fetch(`${apiBase}/chat/users`, { headers: authHeaders }); if (response.ok) setChatUsers(await response.json()); };
  const loadGroups = async () => {
    if (!token) return;
    const response = await fetch(`${apiBase}/chat/groups`, { headers: authHeaders });
    if (!response.ok) return;
    const data = await response.json();
    setGroups(data);
    const combined = { ...directUnread };
    data.forEach((group: ChatGroup) => { combined[`group:${group.id}`] = group.unreadCount || 0; });
    onUnreadChange(combined);
  };
  const loadDirectUnread = async () => {
    if (!token) return;
    const response = await fetch(`${apiBase}/messages/unread/count`, { headers: authHeaders });
    if (!response.ok) return;
    const data = await response.json();
    setDirectUnread(data);
    const combined = { ...data };
    groups.forEach(group => { combined[`group:${group.id}`] = group.unreadCount || 0; });
    onUnreadChange(combined);
  };
  const loadMessages = async (conversation = active) => {
    if (!token || !conversation) return;
    const path = conversation.kind === 'group' ? `/chat/groups/${conversation.id}/messages` : `/messages/${conversation.id}`;
    const response = await fetch(`${apiBase}${path}`, { headers: authHeaders });
    if (!response.ok) return;
    const data = await response.json();
    setMessages(previous => sameMessages(previous, data) ? previous : data);
  };

  useEffect(() => { void loadChatUsers(); void loadGroups(); void loadDirectUnread(); }, [token]);
  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => { void loadGroups(); void loadDirectUnread(); void loadMessages(); }, 2000);
    return () => window.clearInterval(timer);
  }, [token, active, groups.length]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const openConversation = (conversation: Conversation) => { 
    setActive(conversation); 
    setMessages([]); 
    setInput(''); 
    setReplyingTo(null);
    setShowEmojiPicker(false);
    void loadMessages(conversation); 
    window.setTimeout(() => inputRef.current?.focus(), 80); 
  };
  const uploadImage = async (upload: File) => {
    const authResponse = await fetch(`${apiBase}/imagekit/auth`, { headers: authHeaders });
    if (!authResponse.ok) throw new Error('Could not prepare upload');
    const auth = await authResponse.json();
    const body = new FormData();
    body.append('file', upload); body.append('fileName', upload.name); body.append('publicKey', IMAGEKIT_PUBLIC_KEY); body.append('signature', auth.signature); body.append('expire', String(auth.expire)); body.append('token', auth.token);
    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body });
    if (!response.ok) throw new Error('Upload failed');
    return (await response.json()).url as string;
  };

  const mentionedIds = useMemo(() => {
    if (!activeGroup) return [];
    const lowerInput = input.toLowerCase();
    return activeGroup.members.filter(member => lowerInput.includes(`@${member.user.username.toLowerCase()}`)).map(member => member.userId);
  }, [input, activeGroup]);
  const mentionQuery = input.match(/(?:^|\s)@([\w.-]*)$/)?.[1]?.toLowerCase();
  const mentionCandidates = mentionQuery === undefined || !activeGroup ? [] : activeGroup.members.filter(member => member.userId !== currentUserId).filter(member => member.user.username.toLowerCase().includes(mentionQuery) || member.user.name.toLowerCase().includes(mentionQuery)).slice(0, 6);
  const addMention = (member: GroupMember) => { setInput(value => value.replace(/@([\w.-]*)$/, `@${member.user.username} `)); inputRef.current?.focus(); };

  const handleStartReply = (msg: ChatMessage) => {
    const senderName = msg.sender === currentUserId 
      ? 'You' 
      : (msg.senderUser?.name || (activeUser ? activeUser.name : 'Team member'));
    const { bodyText } = parseQuote(msg.text);
    const cleanText = bodyText || (msg.mediaUrl ? 'Photo' : 'Message');
    setReplyingTo({
      id: msg.id || msg._id || '',
      senderName,
      text: cleanText.length > 80 ? cleanText.slice(0, 80) + '...' : cleanText
    });
    inputRef.current?.focus();
  };

  const toggleReaction = (msgId: string, emoji: string) => {
    const userName = user?.name || 'You';
    setReactions(prev => {
      const msgReactions = prev[msgId] ? { ...prev[msgId] } : {};
      const users = msgReactions[emoji] ? [...msgReactions[emoji]] : [];
      if (users.includes(userName)) {
        const filtered = users.filter(u => u !== userName);
        if (filtered.length === 0) delete msgReactions[emoji];
        else msgReactions[emoji] = filtered;
      } else {
        msgReactions[emoji] = [...users, userName];
      }
      return { ...prev, [msgId]: msgReactions };
    });
  };

  const insertEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || (!input.trim() && !file) || sending) return;
    setSending(true);
    try {
      const mediaUrl = file ? await uploadImage(file) : '';
      let sendText = input.trim();
      if (replyingTo) {
        const sanitizedQuoteText = replyingTo.text.replace(/\n/g, ' ');
        sendText = `> [reply:${replyingTo.senderName}] ${sanitizedQuoteText}\n\n${sendText}`;
      }
      const path = active.kind === 'group' ? `/chat/groups/${active.id}/messages` : '/messages';
      const payload = active.kind === 'group' ? { text: sendText, mediaUrl, mediaType: mediaUrl ? 'image' : 'none', mentions: mentionedIds } : { receiverId: active.id, text: sendText, mediaUrl, mediaType: mediaUrl ? 'image' : 'none' };
      const response = await fetch(`${apiBase}${path}`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Could not send message');
      const created = await response.json();
      setMessages(previous => [...previous, created]);
      setInput(''); 
      setFile(null); 
      setPreview(''); 
      setReplyingTo(null);
      setShowEmojiPicker(false);
      void loadGroups(); 
      inputRef.current?.focus();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not send message', 'danger'); }
    finally { setSending(false); }
  };

  const createGroup = async () => {
    if (groupName.trim().length < 2 || selectedMembers.length === 0) return;
    setCreatingGroup(true);
    try {
      const response = await fetch(`${apiBase}/chat/groups`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: groupName, memberIds: selectedMembers }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Could not create group');
      const group = await response.json();
      setGroups(previous => [group, ...previous]); setShowGroupModal(false); setGroupName(''); setSelectedMembers([]); openConversation({ kind: 'group', id: group.id }); showToast('Group created successfully', 'success');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not create group', 'danger'); }
    finally { setCreatingGroup(false); }
  };
  const clearDirectChat = async () => { if (!active || active.kind !== 'direct') return; setShowClearConfirm(false); const response = await fetch(`${apiBase}/messages/${active.id}`, { method: 'DELETE', headers: authHeaders }); if (response.ok) setMessages([]); else showToast('Could not clear chat', 'danger'); };

  const filteredUsers = chatUsers.filter(item => `${item.name} ${item.username}`.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = groups.filter(group => group.name.toLowerCase().includes(search.toLowerCase()));
  const renderText = (text: string) => { const usernames = new Set((activeGroup?.members || []).map(member => member.user.username.toLowerCase())); return text.split(/(@[\w.-]+)/g).map((part, index) => usernames.has(part.slice(1).toLowerCase()) ? <strong className="chat-mention" key={`${part}-${index}`}>{part}</strong> : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>); };

  return <div className="wa-page">
    <header className="wa-page-header"><div><span className="wa-kicker"><MessageSquare size={15} /> Team communication</span><h1>Chat Hub</h1><p>Fast direct and group messaging for your office team.</p></div><button className="wa-new-group" onClick={() => setShowGroupModal(true)}><Plus size={18} /> New group</button></header>
    <div className="wa-shell">
      <aside className="wa-sidebar"><div className="wa-sidebar-top"><h2>Chats</h2><button onClick={() => setShowGroupModal(true)} title="Create group"><UsersRound size={20} /></button></div><label className="wa-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search chats" /></label><div className="wa-chat-list">
        {filteredGroups.length > 0 && <div className="wa-section-label">Groups</div>}
        {filteredGroups.map(group => <button key={group.id} className={`wa-chat-row ${active?.kind === 'group' && active.id === group.id ? 'active' : ''}`} onClick={() => openConversation({ kind: 'group', id: group.id })}><span className="wa-avatar group"><UsersRound size={21} /></span><span className="wa-row-copy"><strong>{group.name}</strong><small>{group.lastMessage?.text || `${group.members.length} members`}</small></span>{group.unreadCount > 0 && <b className="wa-unread">{group.unreadCount}</b>}</button>)}
        <div className="wa-section-label">Direct messages</div>
        {filteredUsers.map(person => { const id = userIdOf(person); return <button key={id} className={`wa-chat-row ${active?.kind === 'direct' && active.id === id ? 'active' : ''}`} onClick={() => openConversation({ kind: 'direct', id })}>{person.imageUrl ? <img className="wa-avatar" src={person.imageUrl} alt="" /> : <span className="wa-avatar">{person.name.slice(0, 2).toUpperCase()}</span>}<span className="wa-row-copy"><strong>{person.name}</strong><small>@{person.username}</small></span>{(directUnread[id] || 0) > 0 && <b className="wa-unread">{directUnread[id]}</b>}</button>; })}
      </div></aside>
      <main className="wa-main">{active ? <><div className="wa-active-header"><span className={`wa-avatar ${active.kind === 'group' ? 'group' : ''}`}>{active.kind === 'group' ? <UsersRound size={22} /> : activeUser?.name.slice(0, 2).toUpperCase()}</span><div><strong>{active.kind === 'group' ? activeGroup?.name : activeUser?.name}</strong><small>{active.kind === 'group' ? `${activeGroup?.members.length || 0} members · type @ to mention` : 'Direct message'}</small></div>{active.kind === 'direct' && <button className="wa-icon danger" onClick={() => setShowClearConfirm(true)} title="Clear chat"><Trash2 size={18} /></button>}</div>
        <div className="wa-messages">{messages.length === 0 && <div className="wa-empty"><MessageSquare size={36} /><strong>No messages yet</strong><span>Send the first message to begin.</span></div>}{messages.map((message, index) => { 
          const msgId = message.id || message._id || String(index);
          const mine = message.sender === currentUserId; 
          const { quoteAuthor, quoteText, bodyText } = parseQuote(message.text);
          const msgReactions = reactions[msgId] || {};
          const msgReactionsEntries = Object.entries(msgReactions);

          return <div className={`wa-message-line ${mine ? 'mine' : ''}`} key={msgId} onMouseEnter={() => setHoveredMsgId(msgId)} onMouseLeave={() => setHoveredMsgId(null)}>
            <div className={`wa-bubble ${mine ? 'mine' : ''}`}>
              <div className={`wa-msg-actions ${hoveredMsgId === msgId ? 'visible' : ''}`}>
                <div className="wa-reaction-bar">
                  {QUICK_REACTIONS.map(emoji => (
                    <button type="button" key={emoji} className="wa-reaction-btn" title={`React ${emoji}`} onClick={() => toggleReaction(msgId, emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
                <button type="button" className="wa-reply-btn" title="Reply" onClick={() => handleStartReply(message)}>
                  <CornerUpLeft size={13} />
                </button>
              </div>
              {active.kind === 'group' && !mine && <b className="wa-sender-name">{message.senderUser?.name || 'Team member'}</b>}
              {quoteAuthor && <div className="wa-quoted-box">
                <span className="wa-quoted-author">{quoteAuthor}</span>
                <span className="wa-quoted-text">{quoteText}</span>
              </div>}
              {message.mediaUrl && <a href={message.mediaUrl} target="_blank" rel="noreferrer"><img src={message.mediaUrl} className="wa-attachment" alt="Attachment" /></a>}
              {bodyText && <p>{renderText(bodyText)}</p>}
              <span className="wa-time">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{active.kind === 'direct' && mine ? (message.isRead ? '  ✓✓' : '  ✓') : ''}</span>

              {msgReactionsEntries.length > 0 && <div className="wa-bubble-reactions">
                {msgReactionsEntries.map(([emoji, users]) => (
                  <span key={emoji} className="wa-reaction-badge" title={users.join(', ')} onClick={() => toggleReaction(msgId, emoji)}>
                    {emoji} {users.length > 1 && <small>{users.length}</small>}
                  </span>
                ))}
              </div>}
            </div>
          </div>; 
        })}<div ref={endRef} /></div>
        <form className="wa-composer" onSubmit={sendMessage}>
          {showEmojiPicker && <div className="wa-emoji-picker">
            {EMOJI_LIST.map(emoji => (
              <button type="button" key={emoji} className="wa-emoji-picker-btn" onClick={() => insertEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>}
          {replyingTo && <div className="wa-reply-preview">
            <div className="wa-reply-bar-content">
              <span className="wa-reply-sender">{replyingTo.senderName}</span>
              <span className="wa-reply-text">{replyingTo.text}</span>
            </div>
            <button type="button" className="wa-reply-close" onClick={() => setReplyingTo(null)}><X size={15} /></button>
          </div>}
          {preview && <div className="wa-preview"><img src={preview} alt="" /><span>{file?.name}</span><button type="button" onClick={() => { setFile(null); setPreview(''); }}><X size={15} /></button></div>}
          {mentionCandidates.length > 0 && <div className="wa-mentions">{mentionCandidates.map(member => <button type="button" key={member.userId} onClick={() => addMention(member)}><span className="wa-avatar">{member.user.name.slice(0, 2).toUpperCase()}</span><span><strong>{member.user.name}</strong><small>@{member.user.username}</small></span></button>)}</div>}
          <button type="button" className="wa-icon" title="Emoji" onClick={() => setShowEmojiPicker(prev => !prev)}>
            <Smile size={21} />
          </button>
          <label className="wa-icon"><Paperclip size={21} /><input type="file" accept="image/*" hidden onChange={event => { const selected = event.target.files?.[0]; if (selected) { setFile(selected); setPreview(URL.createObjectURL(selected)); } }} /></label>
          <input ref={inputRef} value={input} onChange={event => setInput(event.target.value)} placeholder={active.kind === 'group' ? 'Message group · use @ to mention' : 'Type a message'} />
          <button className="wa-send" disabled={sending}>{sending ? <Loader className="spinner" size={19} /> : <Send size={19} />}</button>
        </form>
      </> : <div className="wa-empty large"><UsersRound size={54} /><h2>Team conversations</h2><span>Select a chat or create a group to get started.</span></div>}</main>
    </div>
    {showGroupModal && <div className="wa-modal-overlay" onClick={() => setShowGroupModal(false)}><div className="wa-modal" onClick={event => event.stopPropagation()}><div className="wa-modal-title"><div><span>Create team group</span><h2>New group chat</h2></div><button onClick={() => setShowGroupModal(false)}><X size={20} /></button></div><label>Group name<input value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="Example: Amazon Work" autoFocus /></label><p className="wa-select-title">Select members <b>{selectedMembers.length}</b></p><div className="wa-member-list">{chatUsers.map(person => { const id = userIdOf(person); const selected = selectedMembers.includes(id); return <button type="button" key={id} className={selected ? 'selected' : ''} onClick={() => setSelectedMembers(values => selected ? values.filter(value => value !== id) : [...values, id])}><span className="wa-avatar">{person.name.slice(0, 2).toUpperCase()}</span><span><strong>{person.name}</strong><small>@{person.username}</small></span><i>{selected && <Check size={16} />}</i></button>; })}</div><div className="wa-modal-actions"><button className="wa-cancel" onClick={() => setShowGroupModal(false)}>Cancel</button><button className="wa-create" disabled={creatingGroup || groupName.trim().length < 2 || selectedMembers.length === 0} onClick={createGroup}>{creatingGroup ? <Loader className="spinner" size={17} /> : <UsersRound size={17} />} Create group</button></div></div></div>}
    {showClearConfirm && <div className="wa-modal-overlay" onClick={() => setShowClearConfirm(false)}><div className="wa-modal compact" onClick={event => event.stopPropagation()}><AlertTriangle className="wa-danger-icon" size={40} /><h2>Clear this direct chat?</h2><p>All direct messages with this person will be permanently removed.</p><div className="wa-modal-actions"><button className="wa-cancel" onClick={() => setShowClearConfirm(false)}>Cancel</button><button className="wa-delete" onClick={clearDirectChat}>Clear chat</button></div></div></div>}
  </div>;
}
