import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Thankyou from './Thankyou.jsx'

const path = window.location.pathname.replace(/\/+$/, '').toLowerCase()
const isThankYou = path === '/thankyou' || path === '/public/thankyou'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isThankYou ? <Thankyou /> : <App />}
  </StrictMode>
)
