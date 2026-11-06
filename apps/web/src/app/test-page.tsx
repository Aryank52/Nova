'use client';

import { useState } from 'react';

export default function TestApp() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-4">
      <h1>Test</h1>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
    </div>
  );
}
