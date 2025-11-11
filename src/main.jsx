import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import TagWorkbench from './features/tags/TagWorkbench.jsx'
import SynergyGraphViewer from './components/SynergyGraphViewer.tsx'

const pathname = window.location.pathname;
const isTagWb = pathname === '/tagwb' || pathname === '/tagwb/';
const isCollection = pathname === '/collection' || pathname === '/collection/';
const isSynergy = pathname === '/synergy' || pathname === '/synergy/';
if (!isTagWb && !isCollection && !isSynergy) {
  window.history.replaceState({}, '', '/collection');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isTagWb ? <TagWorkbench /> : isSynergy ? <SynergyGraphViewer /> : <App />}
  </React.StrictMode>,
)
