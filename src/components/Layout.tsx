import { ReactNode, useState } from "react";
import Header from "./Header";
import Navigation from "./Navigation";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <Navigation />
      <Header />
      {/* Main content with sidebar offset on desktop and padding for fixed header - CSS variable handles the transition */}
      <div 
        className="pb-24 md:pb-0 pt-20 md:pt-16 transition-all duration-300 w-full max-w-full overflow-x-hidden"
        style={{
          paddingLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'var(--sidebar-width, 16rem)' : '0'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Layout;

