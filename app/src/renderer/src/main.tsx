import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { WidgetView } from './components/WidgetView'
import './index.css'

const isWidgetView =
  window.location.hash.includes('widget') ||
  window.location.search.includes('widget')

if (isWidgetView) {
  document.documentElement.classList.add('widget-mode')
  document.body.classList.remove('bg-slate-50', 'dark:bg-slate-900', 'min-h-screen')
  document.body.classList.add('widget-body')
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isWidgetView ? <WidgetView /> : <App />}
  </React.StrictMode>
)
