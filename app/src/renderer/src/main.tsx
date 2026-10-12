import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { WidgetView } from './components/WidgetView'
import './index.css'

const isWidgetView =
  window.location.hash.includes('widget') ||
  window.location.search.includes('widget')

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isWidgetView ? <WidgetView /> : <App />}
  </React.StrictMode>
)
