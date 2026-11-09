import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 dark:bg-amber-600 text-slate-950 font-semibold px-4 py-1.5 text-xs flex items-center justify-center gap-2 shadow-sm transition-all sticky top-[105px] z-20">
      <WifiOff className="w-4 h-4 shrink-0 text-slate-950" />
      <span>Modo sin conexión: Trabajando 100% con datos locales guardados en el teléfono.</span>
    </div>
  );
};
