import React, { useState, useEffect, useRef } from 'react';
import radheSound from '../assets/jennie_mantra.mp3';

const STORAGE_KEY      = 'tasknova_reminders';
const CUSTOM_SONG_KEY  = 'tasknova_custom_songs'; // stores user uploaded songs

const loadR    = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))     || []; } catch { return []; } };
const saveR    = d  => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
const loadSongs= () => { try { return JSON.parse(localStorage.getItem(CUSTOM_SONG_KEY)) || []; } catch { return []; } };
const saveSongs= d  => localStorage.setItem(CUSTOM_SONG_KEY, JSON.stringify(d));

let currentAudio = null;

function playAlarm(ctx, type = 'alert', customSongs = []) {
  // ── Stop any currently playing audio ──
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }

  // ── Play built-in MP3 ──
  if (type === 'mantra') {
    currentAudio = new Audio(radheSound);
    currentAudio.volume = 0.85;
    currentAudio.play().catch(e => console.log('Audio error:', e));
    return;
  }

  // ── Play user custom song ──
  if (type.startsWith('custom_')) {
    const songId = type.replace('custom_', '');
    const song   = customSongs.find(s => s.id === songId);
    if (song) {
      currentAudio = new Audio(song.dataUrl);
      currentAudio.volume = 0.85;
      currentAudio.play().catch(e => console.log('Audio error:', e));
    }
    return;
  }

  // ── Built-in beep tones ──
  if (!ctx) return;
  const P = {
    alert:  [{f:880,t:0,d:.2},{f:1100,t:.25,d:.2},{f:880,t:.5,d:.2},{f:1100,t:.75,d:.3}],
    gentle: [{f:523,t:0,d:.4},{f:659,t:.45,d:.4},{f:784,t:.9,d:.6}],
    urgent: [{f:1200,t:0,d:.1},{f:1200,t:.13,d:.1},{f:1200,t:.26,d:.1},{f:800,t:.42,d:.3},{f:1200,t:.82,d:.1}],
    radhe:  [{f:392,t:0,d:.25},{f:440,t:.27,d:.25},{f:493,t:.54,d:.3},{f:523,t:.9,d:.35},{f:493,t:1.3,d:.2},{f:440,t:1.55,d:.3},{f:523,t:2,d:.3},{f:587,t:2.35,d:.35},{f:659,t:2.8,d:.3},{f:587,t:3.15,d:.25},{f:523,t:3.45,d:.5},{f:440,t:4.1,d:.4},{f:392,t:4.6,d:.6}],
  };
  (P[type] || P.alert).forEach(({ f, t, d }) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = f; o.type = 'sine';
    const s = ctx.currentTime + t;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.45, s + .04);
    g.gain.linearRampToValueAtTime(0, s + d);
    o.start(s); o.stop(s + d + .05);
  });
}

function stopAlarm() {
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }
}

export default function ReminderAlarm({ tasks = [] }) {
  const [reminders,  setReminders ] = useState(loadR);
  const [customSongs,setCustomSongs] = useState(loadSongs);
  const [firing,     setFiring    ] = useState(null);
  const [showForm,   setShowForm  ] = useState(false);
  const [showSongs,  setShowSongs ] = useState(false);
  const [filterTab,  setFilterTab ] = useState('upcoming');
  const [uploading,  setUploading ] = useState(false);
  const [form, setForm] = useState({ title:'', datetime:'', taskId:'', repeat:'none', sound:'alert', note:'' });

  const audioCtx  = useRef(null);
  const fileInput = useRef(null);

  const getAudio = () => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx.current;
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default')
      Notification.requestPermission();
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      setReminders(prev => {
        let hit = false;
        const upd = prev.map(r => {
          if (r.dismissed || r.fired) return r;
          if (new Date(r.datetime).getTime() <= now) {
            hit = true;
            playAlarm(getAudio(), r.sound || 'alert', customSongs);
            if ('Notification' in window && Notification.permission === 'granted')
              new Notification(`⏰ ${r.title}`, { body: r.note || 'TaskNova Reminder' });
            setFiring(r);
            if (r.repeat !== 'none') {
              const nx = new Date(r.datetime);
              r.repeat === 'daily' ? nx.setDate(nx.getDate() + 1) : nx.setDate(nx.getDate() + 7);
              return { ...r, fired: true, datetime: nx.toISOString() };
            }
            return { ...r, fired: true };
          }
          return r;
        });
        if (hit) saveR(upd);
        return hit ? upd : prev;
      });
    }, 10000);
    return () => clearInterval(tick);
  }, [customSongs]);

  // ── Upload custom song ──
  const handleSongUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file (MP3, WAV, etc.)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Please use a file under 10MB.');
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newSong = {
        id:      Date.now().toString(),
        name:    file.name.replace(/\.[^/.]+$/, ''), // remove extension
        dataUrl: ev.target.result,
        size:    (file.size / 1024).toFixed(0) + ' KB',
      };
      setCustomSongs(prev => {
        const updated = [...prev, newSong];
        saveSongs(updated);
        return updated;
      });
      setUploading(false);
      // Auto-select this song in the form
      setForm(f => ({ ...f, sound: `custom_${newSong.id}` }));
    };
    reader.onerror = () => { alert('Failed to read file.'); setUploading(false); };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset input
  };

  const deleteSong = (id) => {
    setCustomSongs(prev => {
      const updated = prev.filter(s => s.id !== id);
      saveSongs(updated);
      return updated;
    });
    // Reset form sound if deleted song was selected
    if (form.sound === `custom_${id}`) setForm(f => ({ ...f, sound: 'alert' }));
  };

  const getSoundLabel = (sound) => {
    if (!sound || sound === 'alert')  return '🔔 Alert Beep';
    if (sound === 'gentle')           return '🎵 Gentle Chime';
    if (sound === 'urgent')           return '🚨 Urgent Alarm';
    if (sound === 'radhe')            return '🪔 Radhe Radhe';
    if (sound === 'mantra')           return '🎵 Jennie Mantra';
    if (sound.startsWith('custom_')) {
      const s = customSongs.find(s => s.id === sound.replace('custom_', ''));
      return s ? `🎶 ${s.name}` : '🎶 Custom Song';
    }
    return '🔔 Alert Beep';
  };

  const fld = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const addReminder = () => {
    if (!form.title.trim() || !form.datetime) return;
    const r = { id: Date.now().toString(), ...form, fired: false, dismissed: false, createdAt: new Date().toISOString() };
    setReminders(p => { const n = [r, ...p]; saveR(n); return n; });
    setForm({ title: '', datetime: '', taskId: '', repeat: 'none', sound: 'alert', note: '' });
    setShowForm(false);
  };

  const dismiss = id => {
    stopAlarm();
    setReminders(p => { const n = p.map(r => r.id === id ? { ...r, dismissed: true, fired: true } : r); saveR(n); return n; });
    if (firing?.id === id) setFiring(null);
  };

  const snooze = (id, m) => {
    stopAlarm();
    const dt = new Date(Date.now() + m * 60000).toISOString();
    setReminders(p => { const n = p.map(r => r.id === id ? { ...r, fired: false, dismissed: false, datetime: dt } : r); saveR(n); return n; });
    if (firing?.id === id) setFiring(null);
  };

  const del = id => setReminders(p => { const n = p.filter(r => r.id !== id); saveR(n); return n; });

  const tLeft = dt => {
    const d = new Date(dt) - Date.now();
    if (d < 0) return { label: 'Overdue', color: '#ff6a6a' };
    const m = Math.floor(d / 60000), h = Math.floor(m / 60), dy = Math.floor(h / 24);
    if (dy > 0) return { label: `in ${dy}d ${h % 24}h`, color: '#6affd4' };
    if (h > 0)  return { label: `in ${h}h ${m % 60}m`, color: '#6affd4' };
    if (m > 0)  return { label: `in ${m}m`, color: m < 30 ? '#ffd96a' : '#6affd4' };
    return { label: 'Due now!', color: '#ff6a9f' };
  };

  const upcoming = reminders.filter(r => !r.dismissed && !r.fired).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const firedList = reminders.filter(r => !r.dismissed && r.fired);
  const shown     = filterTab === 'upcoming' ? upcoming : filterTab === 'fired' ? firedList : reminders.filter(r => !r.dismissed);

  const CARD = { background: '#0d0d1f', border: '1px solid #ffffff18', borderRadius: 16 };
  const BTN  = { background: 'linear-gradient(135deg,#7c6aff,#ff6a9f)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: '.83rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s' };
  const INP  = { width: '100%', background: '#13132a', border: '1px solid #ffffff18', borderRadius: 10, padding: '10px 14px', color: '#f0efff', fontSize: '.88rem', outline: 'none', fontFamily: 'inherit' };
  const LBL  = { display: 'block', fontSize: '.75rem', color: '#7b79a0', marginBottom: 5, fontWeight: 500 };

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: '#f0efff' }}>
      <style>{`
        @keyframes ring{0%,100%{transform:rotate(-14deg) scale(1.1)}50%{transform:rotate(14deg) scale(1.1)}}
        @keyframes alarmPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,106,159,.6)}70%{box-shadow:0 0 0 20px rgba(255,106,159,0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input[type=datetime-local]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:.4;cursor:pointer}
        .song-row:hover{background:#1a1a35!important}
        .upload-zone:hover{border-color:rgba(106,255,212,.5)!important;background:rgba(106,255,212,.04)!important}
      `}</style>

      {/* ── FIRING POPUP ── */}
      {firing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(6,6,15,.93)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ ...CARD, padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 400, width: '100%', animation: 'alarmPulse 1.1s infinite', border: '1px solid rgba(255,106,159,.4)' }}>
            <div style={{ fontSize: '3.5rem', animation: 'ring .45s infinite', display: 'inline-block', marginBottom: '1rem' }}>
              {firing.sound?.startsWith('custom_') ? '🎶' : firing.sound === 'mantra' ? '🎵' : '⏰'}
            </div>
            <div style={{ fontSize: '.72rem', letterSpacing: '.15em', textTransform: 'uppercase', color: '#ff6a9f', marginBottom: 8, fontWeight: 600 }}>Reminder!</div>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>{firing.title}</h3>
            {firing.note && <p style={{ color: '#7b79a0', fontSize: '.85rem', marginBottom: 6 }}>{firing.note}</p>}
            <p style={{ color: '#7b79a0', fontSize: '.78rem', marginBottom: '.5rem' }}>{new Date(firing.datetime).toLocaleString()}</p>
            <p style={{ color: '#6affd4', fontSize: '.75rem', marginBottom: '1.5rem' }}>{getSoundLabel(firing.sound)}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[5, 10, 30].map(m => (
                <button key={m} onClick={() => snooze(firing.id, m)} style={{ ...BTN, background: '#1a1a35', border: '1px solid #ffffff18', color: '#f0efff', boxShadow: 'none', fontSize: '.78rem', padding: '7px 12px' }}>😴 {m}m</button>
              ))}
              <button onClick={() => dismiss(firing.id)} style={BTN}>✓ Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>⏰ Reminders & Alarms</h2>
          <p style={{ color: '#7b79a0', fontSize: '.88rem' }}>{upcoming.length} upcoming · {firedList.length} fired · {customSongs.length} custom tones</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => playAlarm(getAudio(), 'gentle', customSongs)} style={{ ...BTN, background: '#13132a', border: '1px solid #ffffff18', color: '#6affd4', boxShadow: 'none', fontSize: '.78rem' }}>🔔 Test Beep</button>
          <button onClick={() => setShowSongs(v => !v)} style={{ ...BTN, background: '#13132a', border: '1px solid rgba(106,255,212,.3)', color: '#6affd4', boxShadow: 'none', fontSize: '.78rem' }}>
            🎶 My Songs {customSongs.length > 0 && <span style={{ background: '#6affd4', color: '#06060f', borderRadius: '50%', width: 16, height: 16, fontSize: '.65rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>{customSongs.length}</span>}
          </button>
          <button onClick={() => setShowForm(v => !v)} style={BTN}>{showForm ? '✕ Cancel' : '+ Add Reminder'}</button>
        </div>
      </div>

      {'Notification' in window && Notification.permission === 'denied' && (
        <div style={{ background: 'rgba(255,217,106,.08)', border: '1px solid rgba(255,217,106,.25)', borderRadius: 12, padding: '12px 16px', marginBottom: '1.5rem', fontSize: '.83rem', color: '#ffd96a' }}>⚠️ Browser notifications blocked. Enable in browser settings.</div>
      )}

      {/* ── MY SONGS PANEL ── */}
      {showSongs && (
        <div style={{ ...CARD, padding: '1.5rem', marginBottom: '1.5rem', animation: 'fadeUp .3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.95rem' }}>🎶 My Custom Ringtones</div>
            <span style={{ fontSize: '.72rem', color: '#7b79a0' }}>Saved in browser · max 10MB per file</span>
          </div>

          {/* Upload Zone */}
          <div
            className="upload-zone"
            onClick={() => fileInput.current?.click()}
            style={{ border: '2px dashed rgba(106,255,212,.25)', borderRadius: 12, padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all .2s', marginBottom: '1rem', background: 'transparent' }}
          >
            {uploading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div style={{ width: 18, height: 18, border: '2px solid #6affd4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                <span style={{ color: '#6affd4', fontSize: '.85rem' }}>Uploading song...</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎵</div>
                <div style={{ color: '#6affd4', fontWeight: 600, fontSize: '.88rem', marginBottom: 4 }}>Click to upload your favorite song</div>
                <div style={{ color: '#7b79a0', fontSize: '.75rem' }}>Supports MP3, WAV, OGG, M4A · Max 10MB</div>
              </>
            )}
          </div>
          <input ref={fileInput} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleSongUpload} />

          {/* Song List */}
          {customSongs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#7b79a0', fontSize: '.83rem' }}>No songs uploaded yet. Upload one above! 🎵</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customSongs.map(song => (
                <div key={song.id} className="song-row" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#13132a', borderRadius: 10, padding: '10px 14px', transition: 'all .2s' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7c6aff,#ff6a9f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🎵</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</div>
                    <div style={{ fontSize: '.72rem', color: '#7b79a0', marginTop: 2 }}>{song.size}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => playAlarm(getAudio(), `custom_${song.id}`, customSongs)}
                      style={{ ...BTN, padding: '5px 12px', fontSize: '.74rem', background: '#1a1a35', border: '1px solid #ffffff18', color: '#6affd4' }}
                    >▶ Play</button>
                    <button
                      onClick={() => stopAlarm()}
                      style={{ ...BTN, padding: '5px 10px', fontSize: '.74rem', background: '#1a1a35', border: '1px solid #ffffff18', color: '#ffd96a' }}
                    >■ Stop</button>
                    <button
                      onClick={() => deleteSong(song.id)}
                      style={{ background: 'rgba(255,106,106,.08)', border: '1px solid rgba(255,106,106,.2)', color: '#ff6a6a', padding: '5px 10px', borderRadius: 8, fontSize: '.74rem', cursor: 'pointer', fontFamily: 'inherit' }}
                    >🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADD REMINDER FORM ── */}
      {showForm && (
        <div style={{ ...CARD, padding: '1.75rem', marginBottom: '1.5rem', animation: 'fadeUp .3s ease' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, marginBottom: '1.25rem', fontSize: '.95rem' }}>✦ New Reminder</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1/-1' }}><label style={LBL}>Title *</label><input style={INP} placeholder="e.g. Submit physics assignment" value={form.title} onChange={fld('title')} onKeyDown={e => e.key === 'Enter' && addReminder()} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={LBL}>Note (optional)</label><input style={INP} placeholder="Additional details..." value={form.note} onChange={fld('note')} /></div>
            <div><label style={LBL}>Date & Time *</label><input type="datetime-local" style={INP} value={form.datetime} onChange={fld('datetime')} /></div>
            <div><label style={LBL}>Link to Task</label>
              <select style={INP} value={form.taskId} onChange={fld('taskId')}>
                <option value="">— None —</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title.slice(0, 28)}</option>)}
              </select>
            </div>
            <div><label style={LBL}>Repeat</label>
              <select style={INP} value={form.repeat} onChange={fld('repeat')}>
                {['none', 'daily', 'weekly'].map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Alarm Sound</label>
              <select style={INP} value={form.sound} onChange={fld('sound')}>
                <optgroup label="── Built-in Tones ──">
                  <option value="gentle">🔔 Gentle Chime</option>
                  <option value="alert">🔔 Alert Beep</option>
                  <option value="urgent">🚨 Urgent Alarm</option>
                  <option value="radhe">🪔 Radhe Radhe</option>
                  <option value="mantra">🎵 Jennie Mantra</option>
                </optgroup>
                {customSongs.length > 0 && (
                  <optgroup label="── My Songs ──">
                    {customSongs.map(s => (
                      <option key={s.id} value={`custom_${s.id}`}>🎶 {s.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              {/* Upload shortcut inside form */}
              <button
                type="button"
                onClick={() => { setShowSongs(true); fileInput.current?.click(); }}
                style={{ marginTop: 8, background: 'transparent', border: '1px dashed rgba(106,255,212,.3)', borderRadius: 8, color: '#6affd4', fontSize: '.72rem', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
              >+ Upload a new song as ringtone</button>
            </div>
          </div>
          <button onClick={addReminder} style={{ ...BTN, marginTop: '1.25rem' }}>Save Reminder ✦</button>
        </div>
      )}

      {/* ── FILTER TABS ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem' }}>
        {[['upcoming', `Upcoming (${upcoming.length})`], ['fired', `Fired (${firedList.length})`], ['all', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setFilterTab(v)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: '.8rem', border: '1px solid', borderColor: filterTab === v ? 'rgba(124,106,255,.4)' : '#ffffff18', background: filterTab === v ? '#7c6aff' : 'transparent', color: filterTab === v ? '#fff' : '#7b79a0', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, transition: 'all .2s' }}>{l}</button>
        ))}
      </div>

      {/* ── REMINDER CARDS ── */}
      <div style={{ display: 'grid', gap: '.8rem' }}>
        {shown.map(r => {
          const tl     = tLeft(r.datetime);
          const linked = tasks.find(t => t.id === r.taskId);
          const isCustom = r.sound?.startsWith('custom_');
          const soundLabel = getSoundLabel(r.sound);
          return (
            <div key={r.id} style={{ ...CARD, padding: '1rem 1.4rem', display: 'flex', alignItems: 'center', gap: 14, transition: 'all .2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#ffffff28'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#ffffff18'}>
              <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                {isCustom ? '🎶' : r.sound === 'mantra' ? '🎵' : r.sound === 'radhe' ? '🪔' : r.fired ? '✅' : tl.label === 'Due now!' ? '🔥' : '🔔'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 4 }}>{r.title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '.72rem', color: '#7b79a0', alignItems: 'center' }}>
                  <span>📅 {new Date(r.datetime).toLocaleString()}</span>
                  {!r.fired && <span style={{ color: tl.color, fontWeight: 600, background: `${tl.color}18`, padding: '1px 7px', borderRadius: 5 }}>{tl.label}</span>}
                  <span style={{ background: 'rgba(124,106,255,.1)', color: '#a89aff', padding: '1px 7px', borderRadius: 5 }}>{soundLabel}</span>
                  {r.repeat !== 'none' && <span style={{ background: 'rgba(124,106,255,.12)', color: '#7c6aff', padding: '1px 7px', borderRadius: 5 }}>🔁 {r.repeat}</span>}
                  {linked && <span style={{ background: 'rgba(106,255,212,.1)', color: '#6affd4', padding: '1px 7px', borderRadius: 5 }}>📌 {linked.title.slice(0, 18)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => dismiss(r.id)} style={{ ...BTN, padding: '5px 12px', fontSize: '.74rem' }}>Done</button>
                <button onClick={() => del(r.id)} style={{ background: 'rgba(255,106,106,.08)', border: '1px solid rgba(255,106,106,.2)', color: '#ff6a6a', padding: '5px 10px', borderRadius: 8, fontSize: '.74rem', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#7b79a0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</div>
            <div>No reminders yet. Add one!</div>
          </div>
        )}
      </div>
    </div>
  );
}
