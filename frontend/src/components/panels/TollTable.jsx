import { fmtMoney } from '../../lib/format.js';

export default function TollTable({ tolls }) {
  const rates = Array.isArray(tolls?.ezpass_rates) ? tolls.ezpass_rates : [];
  const perTrip = Array.isArray(tolls?.per_trip) ? tolls.per_trip : [];
  if (!rates.length && !perTrip.length) return null;
  return (
    <div className="tolltable">
      <div className="chapter__section-title">E-ZPass toll, once per day</div>
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Vehicle</th>
            <th scope="col">Peak</th>
            <th scope="col">Overnight</th>
            <th scope="col">Tunnel credit</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.class}>
              <td>{r.class}</td>
              <td>{fmtMoney(r.peak)}</td>
              <td>{fmtMoney(r.overnight)}</td>
              <td>{fmtMoney(r.crossing_credit)}</td>
            </tr>
          ))}
          {perTrip.map((r) => (
            <tr key={r.class}>
              <td>{r.class}</td>
              <td colSpan={3}>{fmtMoney(r.fee)} per trip</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tolltable__note">
        Peak: weekdays {tolls?.peak_hours?.weekday ?? '—'}, weekends {tolls?.peak_hours?.weekend ?? '—'}. Excluded roadways:{' '}
        {(tolls?.excluded_roadways ?? []).join('; ') || '—'}.
      </p>
    </div>
  );
}
