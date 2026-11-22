import { isWindUnit } from '../lib/windUnits.js'

// Each signed-in account owns a separate store; no device-global persistence.
export function createPreferenceStore({load,save}) {
  let state={unit:'kts',loading:true,saving:false,ready:false,error:'',message:''},version=0
  const listeners=new Set()
  function publish(patch) { state={...state,...patch}; for(const notify of listeners) notify() }
  return {
    getSnapshot:()=>state,
    subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},
    cancel:()=>{version++},
    async load() {
      if(state.saving) return
      const ticket=++version
      publish({loading:true,error:'',message:''})
      try {
        const data=await load()
        if(data && !isWindUnit(data.wind_speed_unit)) throw new Error('Invalid stored unit')
        if(ticket===version) publish({unit:data?.wind_speed_unit || 'kts',ready:true,loading:false})
      } catch {
        if(ticket===version) publish({loading:false,error:'환경설정을 불러오지 못했습니다. 저장된 설정은 변경하지 않았습니다.'})
      }
    },
    async change(unit) {
      if(!isWindUnit(unit) || !state.ready || state.loading || state.saving || unit===state.unit) return
      const previous=state.unit,ticket=++version
      publish({unit,saving:true,error:'',message:''})
      try {
        const data=await save(unit)
        if(data?.wind_speed_unit!==unit) throw new Error('Preference was not saved')
        if(ticket===version) publish({saving:false,message:'저장했습니다.'})
      } catch {
        if(ticket===version) publish({unit:previous,saving:false,error:'설정을 저장하지 못했습니다. 이전 단위로 돌아갔습니다.'})
      }
    },
  }
}
