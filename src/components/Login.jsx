import { useState } from 'react'
import { client } from '../neonClient'

export default function Login({ t, onAuthed }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      // Neon Auth (Better Auth) can EITHER return { error } OR throw — handle both.
      const res =
        mode === 'signin'
          ? await client.auth.signIn.email({ email, password })
          : await client.auth.signUp.email({ email, password, name: name || email })

      if (res?.error) {
        setErr(res.error.message || String(res.error))
        return
      }
      // success — reload the session in App (which re-renders to the app)
      await onAuthed()
    } catch (e2) {
      // This is what was hanging the button: a thrown/rejected auth call.
      // Now it shows the real reason (e.g. "Email not verified" / bad password).
      console.error('Sign-in/up failed:', e2)
      setErr(e2?.message || String(e2) || 'Authentication failed. Please try again.')
    } finally {
      setBusy(false) // ALWAYS re-enable the button, success or failure
    }
  }

  return (
    <form className="login-wrap" onSubmit={submit}>
      <h1>{mode === 'signin' ? t.signInTitle : t.createAccount}</h1>
      <p>{t.signInSub}</p>
      {err && <div className="login-err">{err}</div>}

      {mode === 'signup' && (
        <>
          <label>{t.name}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </>
      )}
      <label>{t.email}</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      <label>{t.password}</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />

      <button type="submit" disabled={busy}>
        {busy ? t.signingIn : mode === 'signin' ? t.signInBtn : t.createAccount}
      </button>

      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12.5 }}>
        <button
          type="button"
          onClick={() => { setErr(''); setMode(mode === 'signin' ? 'signup' : 'signin') }}
          style={{ background: 'none', border: 0, color: '#175ca8', cursor: 'pointer', fontWeight: 600, width: 'auto', padding: 0 }}
        >
          {mode === 'signin' ? t.needAccount : t.haveAccount}
        </button>
      </div>
    </form>
  )
}
