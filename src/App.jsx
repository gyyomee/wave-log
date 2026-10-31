import { useState } from 'react'
import { useAuth } from './auth/useAuth'
import AuthForm from './components/AuthForm'

function App() {
  const { loading, signOut, user } = useAuth()
  const [signOutError, setSignOutError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSignOutError('')
    setSigningOut(true)

    try {
      await signOut()
    } catch (error) {
      setSignOutError('로그아웃하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setSigningOut(false)
    }
  }

  if (loading) {
    return (
      <main className="app">
        <p className="loading" role="status">로그인 확인 중...</p>
      </main>
    )
  }

  if (!user) {
    return <AuthForm />
  }

  return (
    <main className="app">
      <div className="session-bar" aria-label="Current session">
        <span>{[user.user_metadata?.nickname, user.user_metadata?.preferred_username, user.user_metadata?.name, user.user_metadata?.full_name].find((name) => typeof name === 'string' && name.trim()) || '서퍼'}</span>
        <button type="button" disabled={signingOut} onClick={handleSignOut}>
          {signingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>
      <section className="intro">
        <h1>Wave Log</h1>
        <p>Personal Surf Journal</p>
      </section>
      {signOutError ? <p className="session-error" role="alert">{signOutError}</p> : null}
    </main>
  )
}

export default App
