import React from 'react';
import { Volume2, Database, Info, Sparkles } from 'lucide-react';

export type NavTab = 'tts' | 'corpus' | 'about';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  corpusCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, corpusCount }) => {
  const navItems = [
    {
      id: 'tts' as NavTab,
      label: 'Chuyển văn bản',
      icon: Volume2,
      desc: 'Tổng hợp giọng nói',
    },
    {
      id: 'corpus' as NavTab,
      label: 'Dữ liệu',
      icon: Database,
      desc: 'Quản lý từ vựng & âm thanh',
      badge: corpusCount > 0 ? corpusCount : undefined,
    },
    {
      id: 'about' as NavTab,
      label: 'Giới thiệu',
      icon: Info,
      desc: 'Sơ đồ khối & kiến trúc',
    },
  ];

  return (
    <aside className="w-[240px] flex-shrink-0 bg-white border-r border-[#E8E8F0] h-screen flex flex-col justify-between select-none fixed left-0 top-0 z-30">
      {/* Brand Header */}
      <div>
        <div className="h-[72px] px-5 flex items-center gap-3 border-b border-[#E8E8F0]">
          <img
            src="/logo.png"
            alt="VietVoice Logo"
            className="w-10 h-10 rounded-xl object-contain shadow-sm border border-[#E8E8F0] bg-white flex-shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-[#20213A] tracking-tight">VietVoice</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#6255CF]/10 text-[#6255CF]">
                TTS
              </span>
            </div>
            <p className="text-[11px] text-[#85879A] leading-tight font-medium">Vietnamese TTS</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${isActive
                  ? 'bg-[#6255CF] text-white shadow-sm shadow-[#6255CF]/25'
                  : 'text-[#555870] hover:text-[#20213A] hover:bg-[#F4F5FB]'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#85879A]'}`} />
                  <div>
                    <span className="block leading-snug">{item.label}</span>
                  </div>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-white/20 text-white' : 'bg-[#EAEBF4] text-[#60637A]'
                      }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Info Section */}
      <div className="p-4 border-t border-[#E8E8F0]">
        <div className="rounded-xl bg-[#F7F8FC] border border-[#E8E8F0] p-3 text-left">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6255CF] mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Học phần — Hệ cơ sở dữ liệu đa phương tiện</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
