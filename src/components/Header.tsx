import React from 'react';
import type { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
}

export const Header: React.FC<HeaderProps> = ({ currentTab }) => {
  const getMeta = () => {
    switch (currentTab) {
      case 'tts':
        return {
          title: 'Chuyển văn bản',
          subtitle: 'Chuyển đổi văn bản tiếng Việt thành âm thanh',
        };
      case 'corpus':
        return {
          title: 'Quản lý ngữ liệu',
          subtitle: 'Bộ dữ liệu từ vựng - âm thanh song song mức từ',
        };
      case 'about':
        return {
          title: 'Giới thiệu & Kiến trúc',
          subtitle: 'Sơ đồ khối, quy trình thực hiện và trích rút đặc trưng âm học',
        };
    }
  };

  const { title, subtitle } = getMeta();

  return (
    <header className="fixed top-0 left-0 md:left-[240px] right-0 z-30 h-[72px] px-8 bg-white/95 backdrop-blur-xs border-b border-[#E8E8F0] flex items-center justify-between select-none shadow-2xs">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-[#2CB4FE] via-[#528FFC] to-[#CB69F7] bg-clip-text text-transparent inline-block">{title}</h1>
        <p className="text-xs text-[#85879A] mt-0.5">{subtitle}</p>
      </div>

      {/* <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F0F2F9] text-[#555870] border border-[#E2E4F0]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Ghép nối ngữ liệu (Concatenative)
        </span>
      </div> */}
    </header>
  );
};

