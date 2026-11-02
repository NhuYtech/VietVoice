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
          subtitle: 'Chuyển đổi văn bản tiếng Việt thành âm thanh từ ngữ liệu thu âm',
        };
      case 'corpus':
        return {
          title: 'Quản lý ngữ liệu',
          subtitle: 'Bộ dữ liệu từ vựng - âm thanh song song mức từ (Word-level Parallel Corpus)',
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
    <header className="h-[72px] px-8 bg-white border-b border-[#E8E8F0] flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-xl font-bold text-[#20213A] tracking-tight">{title}</h1>
        <p className="text-xs text-[#85879A] mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F0F2F9] text-[#555870] border border-[#E2E4F0]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Ghép nối ngữ liệu (Concatenative)
        </span>
      </div>
    </header>
  );
};

