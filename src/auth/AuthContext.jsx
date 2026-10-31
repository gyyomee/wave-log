import { createContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export const AuthContext = createContext(null)

function callbackError() {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const code = url.searchParams.get('error') || hash.get('error')
  if (!code && !url.searchParams.has('error_description') && !hash.has('error_description')) return ''
  return code === 'access_denied'
    ? '카카오 로그인이 취소되었거나 허용되지 않았습니다. 다시 시도해 주세요.'
    : '카카오 로그인에 실패했습니다. 다시 시도해 주세요.'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(callbackError)

  useEffect(() => {
    if (!supabase) {
      setAuthError('현재 로그인 서비스를 사용할 수 없습니다.')
      setLoading(false)
      return undefined
    }
    let active = true
    let authChanged = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      authChanged = true
      setSession(nextSession)
      setLoading(false)
    })
    // A late session read must not overwrite a newer auth event.
    async function restoreSession() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!active) return
        if (error) throw error
        if (!authChanged) setSession(data.session)
      } catch {
        if (active) setAuthError('로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.')
      } finally {
        if (active) {
          setLoading(false)
          if (callbackError()) {
            const url = new URL(window.location.href)
            for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key)
            url.hash = ''
            window.history.replaceState(window.history.state, '', url)
          }
        }
      }
    }
    restoreSession()
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    isConfigured: isSupabaseConfigured,
    loading,
    authError,
    session,
    user: session?.user ?? null,
    // auth.users.id, not the Kakao provider identifier.
    userId: session?.user.id ?? null,
    signInWithKakao: async () => {
      setAuthError('')
      if (!supabase) throw new Error('Authentication is not configured.')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
          scopes: 'profile_nickname',
        },
      })
      if (error) throw error
    },
    signOut: async () => {
      if (!supabase) return
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setAuthError('')
    },
  }), [loading, session, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
