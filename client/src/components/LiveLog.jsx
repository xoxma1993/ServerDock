import React, { useEffect, useRef } from 'react';

export default function LiveLog({ lines }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={ref}
      className="bg-black text-green-400 font-mono text-xs rounded-md p-3 h-64 overflow-auto"
    >
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

