import { useAuth } from './auth/useAuth'
import AuthForm from './components/AuthForm'
import Journal from './journal/Journal'
import './journal/journal.css'

export default function App() {
  const { loading, user } = useAuth()
  if (loading) return <main className="auth-screen"><p role="status">로그인 확인 중...</p></main>
  if (!user) return <AuthForm />
  return <Journal key={user.id} />
}
