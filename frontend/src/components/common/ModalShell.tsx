import React from 'react';
import BodyPortal from './BodyPortal';

type ModalPosition = 'center' | 'bottom';
type ModalWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalShellProps {
  children: React.ReactNode;
  visible?: boolean;
  onClose?: () => void;
  position?: ModalPosition;
  width?: ModalWidth;
  showHandle?: boolean;
  panelRef?: React.Ref<HTMLDivElement>;
  panelClassName?: string;
  contentClassName?: string;
  overlayClassName?: string;
  zIndex?: number;
  closeOnBackdrop?: boolean;
}

const WIDTH_CLASS: Record<ModalWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-2xl',
};

export default function ModalShell({
  children,
  visible = true,
  onClose,
  position = 'center',
  width = 'lg',
  showHandle = true,
  panelRef,
  panelClassName = '',
  contentClassName = 'px-5 pb-8 pt-2',
  overlayClassName = 'bg-black/60 backdrop-blur-sm',
  zIndex = 60,
  closeOnBackdrop = true,
}: ModalShellProps) {
  const containerClasses = position === 'center'
    ? 'fixed inset-0 flex items-center justify-center p-3 sm:p-5'
    : 'fixed inset-x-0 bottom-0 flex justify-center px-3 pb-safe';

  const panelMotion = position === 'center'
    ? (visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.98] opacity-0')
    : (visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0');

  const panelShape = position === 'center'
    ? 'rounded-3xl max-h-[calc(100vh-1.5rem)] sm:max-h-[min(92vh,820px)]'
    : 'rounded-t-3xl sm:rounded-3xl max-h-[70vh]';

  return (
    <BodyPortal>
      <div className="fixed inset-0" style={{ zIndex }}>
        <div
          className={`absolute inset-0 transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'} ${overlayClassName}`}
          onClick={closeOnBackdrop ? onClose : undefined}
        />
        <div className={containerClasses} style={{ zIndex: zIndex + 1, pointerEvents: 'none' }}>
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            className={`pointer-events-auto w-full ${WIDTH_CLASS[width]} bg-surface border border-default shadow-2xl overflow-y-auto overscroll-contain transition-all duration-300 ease-out ${panelShape} ${panelMotion} ${panelClassName}`}
          >
            {showHandle && (
              <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-surface z-10">
                <div className="w-10 h-1 bg-elevated rounded-full" />
              </div>
            )}
            <div className={contentClassName}>{children}</div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
