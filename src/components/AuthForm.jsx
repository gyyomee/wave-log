import { useState } from 'react'
import { useAuth } from '../auth/useAuth'

export default function AuthForm() {
  const { signInWithKakao, authError } = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin() {
    setError('')
    setSubmitting(true)
    try {
      await signInWithKakao()
    } catch {
      setError('카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand">
          <h1 id="auth-title">Wave Log</h1>
          <p>나의 파도를 기록하다</p>
        </div>
        <button className="kakao-button" type="button" disabled={submitting} onClick={handleLogin}>
          {submitting ? '카카오로 이동 중...' : '카카오로 시작하기'}
        </button>
        {error || authError ? <p className="form-message error" role="alert">{error || authError}</p> : null}
      </section>
    </main>
  )
}
