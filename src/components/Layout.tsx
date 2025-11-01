import { ReactNode, useState } from "react";
import Header from "./Header";
import Navigation from "./Navigation";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Header />
      {/* Main content with sidebar offset on desktop and padding for fixed header - CSS variable handles the transition */}
      <div 
        className="pb-20 md:pb-0 pt-14 md:pt-16 transition-all duration-300"
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

