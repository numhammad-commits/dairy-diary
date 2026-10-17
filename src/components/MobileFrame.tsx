import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <div className="h-screen w-screen bg-slate-900 flex justify-center items-stretch overflow-hidden select-none">
      {/* App Shell Container - Full height, fixed boundaries with light theme background */}
      <main className="w-full max-w-md h-full bg-[#F4FBF7] flex flex-col relative shadow-2xl overflow-hidden sm:border-x sm:border-[#D6E9E1]">
        {children}
      </main>
    </div>
  );
};
