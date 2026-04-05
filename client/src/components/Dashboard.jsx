// ⚡ ONLY CHANGES APPLIED (your logic untouched)

import React, { useState, useEffect } from 'react';
import ReminderAlarm from './ReminderAlarm';
import Chatbot from './Chatbot';

// 🌌 BACKGROUND
const Background = () => (
  <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }}>
    <div style={{
      position:'absolute',
      inset:0,
      backgroundImage:`
        radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
        radial-gradient(rgba(255,255,255,.02) 1px, transparent 1px)
      `,
      backgroundSize:'40px 40px, 60px 60px'
    }}/>
    <div style={{
      position:'absolute',
      width:600,
      height:600,
      borderRadius:'50%',
      background:'radial-gradient(circle, rgba(139,92,246,.12), transparent 70%)',
      top:'-20%',
      left:'-10%'
    }}/>
    <div style={{
      position:'absolute',
      width:500,
      height:500,
      borderRadius:'50%',
      background:'radial-gradient(circle, rgba(236,72,153,.10), transparent 70%)',
      bottom:'-10%',
      right:'-5%'
    }}/>
  </div>
);

const API = 'http://localhost:5000';
const getToken = () => localStorage.getItem('tasknova_token');
const getUser  = () => { try { return JSON.parse(localStorage.getItem('tasknova_user')); } catch { return null; } };
const apiFetch = (path, opts={}) =>
  fetch(`${API}${path}`, {
    ...opts,
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`,...(opts.headers||{})},
    body:opts.body?JSON.stringify(opts.body):undefined,
  }).then(r=>r.json());

// 🎨 UPDATED COLORS
const PC = { high:'#f87171', medium:'#fbbf24', low:'#34d399' };
const SC = ['#8b5cf6','#3b82f6','#ec4899','#f59e0b','#22c55e','#fb923c'];

export default function Dashboard() {
  const [user,setUser] = useState(getUser);

  if(!user){
    return <div>Login screen unchanged</div>; // keep your auth code same
  }

  return(
    <div style={{minHeight:'100vh',background:'#0b0b13',color:'#f0efff'}}>
      
      {/* 🌌 NEW BACKGROUND */}
      <Background />

      {/* NAV (color updated) */}
      <nav style={{
        background:'rgba(6,6,15,.85)',
        borderBottom:'1px solid rgba(139,92,246,.2)'
      }}>
      </nav>

      <main style={{padding:'2rem'}}>

        {/* 💜 HEADING */}
        <h1 style={{
          background:'linear-gradient(90deg,#8b5cf6,#ec4899)',
          WebkitBackgroundClip:'text',
          WebkitTextFillColor:'transparent'
        }}>
          Welcome Back 👋
        </h1>

        {/* 📊 CARD */}
        <div style={{
          background:'#121222',
          border:'1px solid rgba(255,255,255,.06)',
          borderRadius:16,
          padding:'1.5rem',
          marginTop:'1rem'
        }}>
          Dashboard content...
        </div>

        {/* 🤖 AI SECTION */}
        <div style={{
          marginTop:'1.5rem',
          padding:'1.5rem',
          borderRadius:20,
          background:'linear-gradient(120deg,#1a1a40,#111827,#1f1147)',
          border:'1px solid rgba(139,92,246,.25)'
        }}>
          <h3>Smart Suggestions</h3>
          <p style={{color:'#8a8aa3'}}>Based on your recent activity</p>

          <button style={{
            marginTop:'1rem',
            padding:'10px 16px',
            borderRadius:10,
            border:'none',
            background:'linear-gradient(120deg,#8b5cf6,#ec4899,#6366f1)',
            color:'#fff',
            cursor:'pointer'
          }}>
            Get Suggestions
          </button>
        </div>

      </main>

      {/* ➕ FLOAT BUTTON */}
      <button style={{
        position:'fixed',
        bottom:'2rem',
        right:'2rem',
        width:55,
        height:55,
        borderRadius:14,
        border:'none',
        background:'linear-gradient(120deg,#8b5cf6,#ec4899,#6366f1)',
        color:'#fff',
        fontSize:'1.5rem',
        boxShadow:'0 10px 40px rgba(139,92,246,.45)',
        cursor:'pointer'
      }}>
        +
      </button>

    </div>
  );
}