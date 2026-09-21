/** Source list (rendered inside the story panel's Sources view and chapter 6's Details). */
export function SourcesList({ sources }) {
  if (!sources?.length) return <p className="tolltable__note">No sources listed.</p>;
  return (
    <ul className="sources-list">
      {sources.map((s, i) => (
        <li key={`${s.dataset_id ?? s.name ?? i}`}>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name ?? s.url}</a>
          ) : (
            <span>{s.name ?? '—'}</span>
          )}
          <span className="meta">
            {[s.publisher, s.portal, s.dataset_id].filter(Boolean).join(' · ')}
            {s.used_for ? ` — ${s.used_for}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default SourcesList;
