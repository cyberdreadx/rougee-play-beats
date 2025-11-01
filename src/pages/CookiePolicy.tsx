import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cookie, FileText } from "lucide-react";

const CookiePolicy = () => {
  const lastUpdated = "October 24, 2025";

  return (
    <>
      <Helmet>
        <title>Cookie Policy - ROUGEE</title>
        <meta name="description" content="Cookie Policy for ROUGEE - how and why we use cookies and similar technologies." />
        <meta property="og:image" content={`${window.location.origin}/rougee-new-og.jpg`} />
        <meta name="twitter:image" content={`${window.location.origin}/rougee-new-og.jpg`} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 mb-24 md:mb-8 max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Cookie className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">Cookie Policy</h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">Last Updated: {lastUpdated}</p>
          </div>

          <Alert className="mb-6 sm:mb-8 border-primary/50 bg-primary/5">
            <AlertDescription className="text-sm sm:text-base">
              We use cookies and similar technologies to provide essential features and improve your experience. You can control cookies through your browser settings.
            </AlertDescription>
          </Alert>

          {/* 1. What Are Cookies? */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">1. What Are Cookies?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>Cookies are small text files stored on your device when you visit a website. We also use similar technologies like localStorage and sessionStorage.</p>
            </CardContent>
          </Card>

          {/* 2. Types of Cookies We Use */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">2. Types of Cookies We Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Essential:</strong> Required for core functionality (authentication, security)</li>
                <li><strong>Preferences:</strong> Save your settings (theme, audio)</li>
                <li><strong>Analytics:</strong> Help us understand usage and improve the Platform</li>
              </ul>
            </CardContent>
          </Card>

          {/* 3. Managing Cookies */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">3. Managing Cookies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>You can control cookies through your browser settings. Disabling certain cookies may limit functionality.</p>
            </CardContent>
          </Card>

          {/* 4. Changes */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">4. Changes to this Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>We may update this Cookie Policy from time to time. Continued use of the Platform after updates constitutes acceptance.</p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="mb-6 border-2 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>Questions about this policy?</p>
              <ul className="space-y-2 ml-4">
                <li><strong>Email:</strong> legal@rougee.network</li>
                <li><strong>Discord:</strong> discord.gg/Vumf5tcMTp</li>
                <li><strong>X (Twitter):</strong> @rougeenetwork</li>
              </ul>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
};

export default CookiePolicy;
