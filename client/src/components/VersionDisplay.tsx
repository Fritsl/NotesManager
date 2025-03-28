import React from 'react';

export default function VersionDisplay() {
  return (
    <div className="text-xs text-muted-foreground opacity-50 fixed bottom-2 right-2 z-10 bg-background/30 backdrop-blur-sm py-1 px-2 rounded">
      v1.0.2 • {new Date().getFullYear()}
    </div>
  );
}