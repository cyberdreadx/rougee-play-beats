import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center console-bg tech-border rounded-lg p-8">
        <h1 className="mb-4 text-4xl font-bold font-mono neon-text">404</h1>
        <p className="mb-6 text-xl text-muted-foreground font-mono">
          Page not found in the blockchain
        </p>
        <Button variant="neon" asChild>
          <a href="/">
            [RETURN TO ROUGEE]
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
