import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { getPreferences, saveWindPreference } from '../services/userPreferences.js'
import { createPreferenceStore } from './preferenceStore.js'

export const PreferencesContext=createContext({unit:'kts',ready:false,loading:false,saving:false,error:'',message:'',change:()=>{},retry:()=>{}})
export const usePreferences=()=>useContext(PreferencesContext)
export function PreferencesProvider({userId,children}) {
  const [store]=useState(()=>createPreferenceStore({load:()=>getPreferences(userId),save:unit=>saveWindPreference(userId,unit)}))
  const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot)
  useEffect(()=>{store.load();return store.cancel},[store])
  return <PreferencesContext.Provider value={{...state,change:store.change,retry:store.load}}>{children}</PreferencesContext.Provider>
}
