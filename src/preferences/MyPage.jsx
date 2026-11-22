import WindUnitControl from './WindUnitControl'

export default function MyPage({nickname,busy,onStatistics,onEquipment,onSettings,onLogout}) {
  return <section><h2>마이페이지</h2><p className="nickname">{nickname}</p><div className="mypage-menu">
    <button type="button" onClick={onStatistics}>내 서핑 통계 <span aria-hidden="true">→</span></button>
    <button type="button" onClick={onEquipment}>내 장비 관리 <span aria-hidden="true">→</span></button>
    <button type="button" onClick={onSettings}>환경설정 <span aria-hidden="true">→</span></button>
    <button type="button" disabled={busy} onClick={onLogout}>{busy ? '로그아웃 중...' : '로그아웃'}</button>
  </div></section>
}
export function PreferencesPage() {
  return <section><h2>환경설정</h2><WindUnitControl/></section>
}
