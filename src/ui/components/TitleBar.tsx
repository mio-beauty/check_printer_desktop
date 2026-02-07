import React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Minus, Square, X } from "lucide-react";

export type ConnectionState = {
  label: string;
  tone: string;
  icon: React.ReactNode;
  title?: string;
};

type TitleBarProps = {
  connectionState: ConnectionState;
  appVersion?: string;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
};

export function TitleBar({
  connectionState,
  appVersion,
  onMinimize,
  onToggleMaximize,
  onClose,
}: TitleBarProps) {
  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between bg-background h-8 border-b border-[#ECECEE]"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="px-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <g clip-path="url(#clip0_29_75)">
            <mask id="mask0_29_75" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
              <path d="M20 0H0V20H20V0Z" fill="white" />
            </mask>
            <g mask="url(#mask0_29_75)">
              <path
                d="M14.6667 4.4244L9.95842 1.89107C9.45842 1.6244 8.86675 1.6244 8.36675 1.89107L3.66673 4.4244C3.32507 4.61607 3.1084 4.98274 3.1084 5.38274C3.1084 5.79107 3.31673 6.15774 3.66673 6.34107L8.37508 8.8744C8.62508 9.00774 8.90008 9.0744 9.16675 9.0744C9.43341 9.0744 9.71675 9.00774 9.95842 8.8744L14.6667 6.34107C15.0084 6.15774 15.2251 5.79107 15.2251 5.38274C15.2251 4.98274 15.0084 4.61607 14.6667 4.4244Z"
                fill="#131314"
              />
              <path
                d="M7.60008 9.75716L3.22508 7.57385C2.88341 7.39885 2.50008 7.42385 2.17508 7.61552C1.85841 7.81552 1.66675 8.15719 1.66675 8.53216V12.6655C1.66675 13.3822 2.06675 14.0238 2.70841 14.3488L7.08342 16.5322C7.23342 16.6072 7.40008 16.6488 7.56675 16.6488C7.75842 16.6488 7.95842 16.5905 8.13342 16.4905C8.45008 16.2905 8.64175 15.9488 8.64175 15.5738V11.4405C8.63342 10.7238 8.23342 10.0822 7.60008 9.75716Z"
                fill="#131314"
              />
              <path
                d="M16.6666 8.53216V10.5822C16.2666 10.4655 15.8416 10.4155 15.4166 10.4155C14.2833 10.4155 13.175 10.8072 12.3 11.5072C11.1 12.4488 10.4166 13.8738 10.4166 15.4155C10.4166 15.8238 10.4666 16.2322 10.575 16.6238C10.45 16.6072 10.325 16.5572 10.2083 16.4822C9.89162 16.2905 9.69995 15.9488 9.69995 15.5738V11.4405C9.69995 10.7238 10.1 10.0822 10.7333 9.75716L15.1083 7.57385C15.45 7.39885 15.8333 7.42385 16.1583 7.61552C16.475 7.81552 16.6666 8.15719 16.6666 8.53216Z"
                fill="#131314"
              />
              <path
                d="M18.3167 13.0579C17.6334 12.2162 16.5917 11.6829 15.4167 11.6829C14.5334 11.6829 13.7167 11.9912 13.0751 12.5079C12.2084 13.1912 11.6667 14.2496 11.6667 15.4329C11.6667 16.1329 11.8667 16.7996 12.2084 17.3662C12.4334 17.7412 12.7167 18.0662 13.0501 18.3329H13.0584C13.7001 18.8662 14.5251 19.1829 15.4167 19.1829C16.3667 19.1829 17.2251 18.8329 17.8834 18.2496C18.1751 17.9996 18.4251 17.6996 18.6251 17.3662C18.9667 16.7996 19.1667 16.1329 19.1667 15.4329C19.1667 14.5329 18.8501 13.6996 18.3167 13.0579ZM17.3001 14.9662L15.3001 16.8162C15.1834 16.9246 15.0251 16.9829 14.8751 16.9829C14.7167 16.9829 14.5584 16.9246 14.4334 16.7996L13.5084 15.8746C13.2667 15.6329 13.2667 15.2329 13.5084 14.9912C13.7501 14.7496 14.1501 14.7496 14.3917 14.9912L14.8917 15.4912L16.4501 14.0496C16.7001 13.8162 17.1001 13.8329 17.3334 14.0829C17.5751 14.3412 17.5584 14.7329 17.3001 14.9662Z"
                fill="#131314"
              />
            </g>
          </g>
          <defs>
            <clipPath id="clip0_29_75">
              <rect width="20" height="20" fill="white" />
            </clipPath>
          </defs>
        </svg>
        <span className="text-[13px] text-[#131314] font-medium">Склад принтер</span>
        {appVersion && (
          <p className="text-[11px] flex items-center text-muted-foreground h-[18px] px-1.5 bg-[#F6F6F7] text-[#747479] rounded-[6px] font-medium leading-[120%]">
            v{appVersion}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-[6px] px-1.5 h-6 text-sm font-normal tracking-wide",
          connectionState.tone,
        )}
        title={connectionState.title}
      >
        <span className="flex h-4 w-4 items-center justify-center text-current">{connectionState.icon}</span>
        <span className="leading-[16px]">{connectionState.label}</span>
      </div>
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Button variant="ghost" size="icon" onClick={onMinimize} aria-label="РЎРІРµСЂРЅСѓС‚СЊ" className="rounded-none">
          <Minus className=" w-3.5" strokeWidth={1.5} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleMaximize} aria-label="Р Р°Р·РІРµСЂРЅСѓС‚СЊ" className="rounded-none">
          <Square className=" w-3" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Р—Р°РєСЂС‹С‚СЊ"
          className="rounded-none hover:bg-red-600/70 hover:text-white"
        >
          <X className="w-4" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}
