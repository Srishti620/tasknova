import React, { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:5000';
const getToken = () => localStorage.getItem('tasknova_token');
const apiFetch = (path, opts={}) =>
  fetch(`${API_BASE}${path}`, {
    ...opts,
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`,...(opts.headers||{})},
    body:opts.body?JSON.stringify(opts.body):undefined,
  }).then(r=>r.json());

const QUICK = ["📋 Summarize my tasks","💡 Give me a study tip","🧠 Quiz me!","⚡ What should I do first?","➕ Add a task for me"];

const makeSystem = (tasks, subjects) => `You are Nova, a smart and friendly AI assistant inside TaskNova — a student task manager app.

## Student's Current Data
Subjects: ${subjects.join(', ') || 'none yet'}
Tasks (${tasks.length} total):
${tasks.slice(0,20).map(t=>`  [${t.status.toUpperCase()}] "${t.title}" | Subject: ${t.subject} | Priority: ${t.priority}${t.dueDate?` | Due: ${new Date(t.dueDate).toLocaleDateString()}`:''}${t.id?` | id: ${t.id}`:''}`).join('\n')||'  No tasks yet.'}

## Your Capabilities
1. Study Assistant — Explain concepts, quiz the student, give mnemonics and study tips
2. Task Manager — Add, delete, or update tasks on behalf of the student
3. Planner — Help prioritize, suggest schedules, motivate

## Task Actions
To ADD a task, include in your response:
<ACTION>{"type":"add","title":"...","subject":"...","priority":"low|medium|high","dueDate":"YYYY-MM-DD or null"}</ACTION>

To DELETE a task:
<ACTION>{"type":"delete","id":"..."}</ACTION>

To UPDATE task status:
<ACTION>{"type":"update","id":"...","status":"todo|in_progress|done"}</ACTION>

Always confirm what you did after the ACTION block.

## Personality
Warm, encouraging, smart. Use emojis occasionally. Keep responses under 120 words unless explaining a concept. Be the student's best study buddy.`;

const parseAction = text => { const m=text.match(/<ACTION>([\s\S]*?)<\/ACTION>/); if(!m) return null; try{return JSON.parse(m[1]);}catch{return null;} };
const cleanText = text => text.replace(/<ACTION>[\s\S]*?<\/ACTION>/g,'').trim();
const renderMd = text => {
  const parts=text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p,i)=>{
    if(p.startsWith('**')&&p.endsWith('**')) return <strong key={i}>{p.slice(2,-2)}</strong>;
    if(p.startsWith('`')&&p.endsWith('`')) return <code key={i} style={{background:'#1a1a35',padding:'1px 6px',borderRadius:4,fontSize:'.82em',fontFamily:'monospace'}}>{p.slice(1,-1)}</code>;
    return p.split('\n').map((l,j,a)=><React.Fragment key={`${i}-${j}`}>{l}{j<a.length-1?<br/>:null}</React.Fragment>);
  });
};

export default function Chatbot({ tasks=[], subjects=[], onTasksChange }) {
  const [open,setOpen]       = useState(false);
  const [msgs,setMsgs]       = useState([{role:'assistant',content:"Hey! I'm **Nova** 🌟 — your AI study buddy.\n\nI can explain concepts, quiz you, manage your tasks, or help you plan. What do you need?"}]);
  const [input,setInput]     = useState('');
  const [loading,setLoading] = useState(false);
  const [unread,setUnread]   = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(()=>{if(open){setUnread(0);setTimeout(()=>inputRef.current?.focus(),200);}}, [open]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'});},[msgs,loading]);

  const executeAction = useCallback(async(action)=>{
    try{
      if(action.type==='add'){
        const t=await apiFetch('/api/tasks',{method:'POST',body:{title:action.title,subject:action.subject||subjects[0]||'General',priority:action.priority||'medium',dueDate:action.dueDate||null,status:'todo'}});
        onTasksChange?.();
        return `✅ Added: "${t.title}"`;
      }
      if(action.type==='delete'){
        await fetch(`${API_BASE}/api/tasks/${action.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${getToken()}`}});
        onTasksChange?.();
        return '🗑️ Task deleted.';
      }
      if(action.type==='update'){
        await apiFetch(`/api/tasks/${action.id}`,{method:'PUT',body:{status:action.status}});
        onTasksChange?.();
        return `✏️ Task updated to "${action.status}".`;
      }
    }catch(e){return `⚠️ Action failed: ${e.message}`;}
    return null;
  },[subjects,onTasksChange]);

  const send = useCallback(async(text)=>{
    const msg=(text||input).trim();
    if(!msg||loading) return;
    setInput('');
    const userMsg={role:'user',content:msg};
    setMsgs(p=>[...p,userMsg]);
    setLoading(true);
    try{
      const history=[...msgs,userMsg].slice(-14).map(m=>({role:m.role,content:m.content}));
      const res = await fetch('http://localhost:5000/api/nova/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
  body: JSON.stringify({ system: makeSystem(tasks, subjects), messages: history }),
});
      const data=await res.json();
      const raw=data.content?.[0]?.text||"Sorry, I couldn't respond right now.";
      const action=parseAction(raw);
      let actionResult=null;
      if(action) actionResult=await executeAction(action);
      const display=cleanText(raw)+(actionResult?`\n\n${actionResult}`:'');
      setMsgs(p=>[...p,{role:'assistant',content:display}]);
      if(!open) setUnread(u=>u+1);
    }catch{
      setMsgs(p=>[...p,{role:'assistant',content:"⚠️ Can't connect to AI. Check your internet connection."}]);
    }finally{setLoading(false);}
  },[msgs,input,loading,tasks,subjects,open,executeAction]);

  const handleKey=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};

  return(
    <>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}}.ndot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#7b79a0;margin:0 2px;animation:blink 1.4s infinite}.ndot:nth-child(2){animation-delay:.2s}.ndot:nth-child(3){animation-delay:.4s}.nova-scroll::-webkit-scrollbar{width:4px}.nova-scroll::-webkit-scrollbar-thumb{background:#1a1a35;border-radius:2px}`}</style>

      {/* BUBBLE */}
      <button onClick={()=>setOpen(v=>!v)} style={{position:'fixed',bottom:'2.5rem',right:'5.5rem',zIndex:200,width:52,height:52,borderRadius:14,background:'linear-gradient(135deg,#6affd4,#7c6aff)',border:'none',cursor:'pointer',boxShadow:'0 8px 30px rgba(106,255,212,.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',transition:'all .25s'}}
        onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.1)';e.currentTarget.style.boxShadow='0 12px 40px rgba(106,255,212,.55)'}}
        onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 8px 30px rgba(106,255,212,.4)'}}>
        <span>{open?'✕':'💬'}</span>
        {!open&&unread>0&&<span style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'#ff6a6a',color:'#fff',fontSize:'.62rem',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{unread}</span>}
      </button>

      {/* PANEL */}
      {open&&(
        <div style={{position:'fixed',bottom:'7rem',right:'2rem',zIndex:200,width:390,height:580,background:'#0d0d1f',border:'1px solid #ffffff18',borderRadius:20,display:'flex',flexDirection:'column',boxShadow:'0 24px 80px rgba(0,0,0,.65)',overflow:'hidden',animation:'slideUp .35s cubic-bezier(.34,1.56,.64,1)'}}>
          {/* Header */}
          <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid #ffffff0f',display:'flex',alignItems:'center',gap:10,background:'linear-gradient(135deg,rgba(106,255,212,.05),rgba(124,106,255,.05))',flexShrink:0}}>
            <div style={{width:38,height:38,borderRadius:11,background:'linear-gradient(135deg,#6affd4,#7c6aff)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0}}>🤖</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.95rem'}}>Nova</div>
              <div style={{fontSize:'.7rem',color:'#6affd4',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#6affd4',display:'inline-block'}}/>Study Assistant · Always on</div>
            </div>
            <button onClick={()=>{setMsgs([{role:'assistant',content:"Fresh start! 🌟 What do you need?"}]);}} style={{background:'transparent',border:'none',color:'#7b79a0',cursor:'pointer',fontSize:'.75rem',fontFamily:'inherit',padding:'4px 8px',borderRadius:6}}
              onMouseEnter={e=>e.currentTarget.style.color='#f0efff'} onMouseLeave={e=>e.currentTarget.style.color='#7b79a0'}>Clear</button>
          </div>

          {/* Messages */}
          <div className="nova-scroll" style={{flex:1,overflowY:'auto',padding:'1rem',display:'flex',flexDirection:'column',gap:'.75rem'}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',alignItems:'flex-end',gap:7}}>
                {m.role==='assistant'&&<div style={{width:26,height:26,borderRadius:8,background:'linear-gradient(135deg,#6affd4,#7c6aff)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.72rem',flexShrink:0}}>🤖</div>}
                <div style={{maxWidth:'78%',padding:'10px 14px',borderRadius:m.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',background:m.role==='user'?'linear-gradient(135deg,#7c6aff,#9b6aff)':'#13132a',border:m.role==='user'?'none':'1px solid #ffffff0f',fontSize:'.85rem',lineHeight:1.6,color:'#f0efff'}}>{renderMd(m.content)}</div>
                {m.role==='user'&&<div style={{width:26,height:26,borderRadius:8,background:'linear-gradient(135deg,#7c6aff,#ff6a9f)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.65rem',fontWeight:700,flexShrink:0}}>U</div>}
              </div>
            ))}
            {loading&&(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:26,height:26,borderRadius:8,background:'linear-gradient(135deg,#6affd4,#7c6aff)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.72rem'}}>🤖</div>
                <div style={{background:'#13132a',border:'1px solid #ffffff0f',borderRadius:'14px 14px 14px 4px',padding:'10px 16px'}}><span className="ndot"/><span className="ndot"/><span className="ndot"/></div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Quick prompts */}
          {msgs.length<=2&&(
            <div style={{padding:'0 1rem .5rem',display:'flex',gap:6,flexWrap:'wrap',flexShrink:0}}>
              {QUICK.map(p=><button key={p} onClick={()=>send(p)} style={{background:'#13132a',border:'1px solid #ffffff15',color:'#7b79a0',padding:'5px 10px',borderRadius:8,fontSize:'.72rem',cursor:'pointer',fontFamily:'inherit',transition:'all .2s'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(106,255,212,.4)';e.currentTarget.style.color='#f0efff'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#ffffff15';e.currentTarget.style.color='#7b79a0'}}>{p}</button>)}
            </div>
          )}

          {/* Context pill */}
          <div style={{padding:'0 1rem .4rem',flexShrink:0}}>
            <div style={{fontSize:'.68rem',color:'#7b79a0',background:'#13132a',border:'1px solid #ffffff0f',borderRadius:8,padding:'4px 10px',display:'inline-flex',gap:8}}>
              <span>📋 {tasks.length} tasks</span><span>·</span><span>🎓 {subjects.length} subjects</span><span>·</span><span style={{color:'#6affd4'}}>Nova can add/edit tasks</span>
            </div>
          </div>

          {/* Input */}
          <div style={{padding:'.75rem 1rem',borderTop:'1px solid #ffffff0f',display:'flex',gap:8,alignItems:'flex-end',flexShrink:0}}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask Nova anything..." rows={1}
              style={{flex:1,background:'#13132a',border:'1px solid #ffffff18',borderRadius:10,padding:'10px 12px',color:'#f0efff',fontSize:'.85rem',resize:'none',fontFamily:'inherit',lineHeight:1.5,maxHeight:80,overflowY:'auto',outline:'none'}}/>
            <button onClick={()=>send()} disabled={!input.trim()||loading}
              style={{width:38,height:38,borderRadius:10,border:'none',background:input.trim()&&!loading?'linear-gradient(135deg,#6affd4,#7c6aff)':'#1a1a35',color:input.trim()&&!loading?'#06060f':'#7b79a0',cursor:input.trim()&&!loading?'pointer':'default',fontSize:'1rem',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}>➤</button>
          </div>
        </div>
      )}
    </>
  );
}
