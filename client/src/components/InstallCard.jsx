import React from 'react';

export default function InstallCard({ pkg, onAction }) {
  const { id, name, installed, version } = pkg;
  const statusLabel = installed ? `Installed ${version || ''}` : 'Not installed';
  const statusColor = installed ? 'text-accent-green' : 'text-text-secondary';

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">{name}</div>
          <div className={`text-xs ${statusColor}`}>{statusLabel}</div>
        </div>
      </div>
      <button
        onClick={() => onAction(id, installed ? 'remove' : 'install')}
        className="self-start px-3 py-1.5 rounded-md text-xs border border-border hover:bg-bg-elevated"
      >
        {installed ? 'Remove' : 'Install'}
      </button>
    </div>
  );
}

