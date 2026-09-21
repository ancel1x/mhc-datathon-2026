import { forwardRef } from 'react';

/** 28 px grey circle with an X, the way Apple sheets close. */
const CloseButton = forwardRef(function CloseButton({ label = 'Close', onClick, className }, ref) {
  return (
    <button ref={ref} type="button" className={className ? `close-btn ${className}` : 'close-btn'} aria-label={label} title={label} onClick={onClick}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M2 2l8 8M10 2l-8 8" />
      </svg>
    </button>
  );
});

export default CloseButton;
