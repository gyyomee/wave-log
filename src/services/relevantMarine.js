import { forecastRange } from '../journal/forecast.js'
export function relevantMarine(samples,session,spot=session.spot) {
  const ranges=forecastRange(session.started_at,session.ended_at)
  if(!ranges.length || spot?.latitude==null || spot?.longitude==null) return []
  const first=Date.parse(ranges[0].forecast_at), last=Date.parse(ranges.at(-1).forecast_at)
  return samples.filter(row=>row.session_id===session.id && row.spot_id===session.spot_id && Number(row.requested_latitude)===Number(spot.latitude) && Number(row.requested_longitude)===Number(spot.longitude) && Date.parse(row.sampled_at)>=first && Date.parse(row.sampled_at)<=last)
}
