import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, FileText, Lock, Globe } from "lucide-react";

const PrivacyPolicy = () => {
  const lastUpdated = "October 24, 2025";

  return (
    <>
      <Helmet>
        <title>Privacy Policy - ROUGEE</title>
        <meta name="description" content="Privacy Policy for ROUGEE - how we collect, use, and protect your data." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 mb-24 md:mb-8 max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">Privacy Policy</h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">Last Updated: {lastUpdated}</p>
          </div>

          <Alert className="mb-6 sm:mb-8 border-primary/50 bg-primary/5">
            <Lock className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm sm:text-base">
              We respect your privacy. This policy explains what data we collect, how we use it, and your rights.
            </AlertDescription>
          </Alert>

          {/* 1. Overview */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">1. Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                ROUGEE is a decentralized platform. Some information (like wallet addresses and on-chain transactions) is public by design and stored on blockchains we do not control.
              </p>
              <p>
                This policy applies to off-chain data we process directly (e.g., website analytics, account metadata) and how we interface with third parties.
              </p>
            </CardContent>
          </Card>

          {/* 2. Data We Collect */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">2. Data We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Wallet address and on-chain activity (public, on-chain)</li>
                <li>Basic profile details you provide (e.g., display name, avatar)</li>
                <li>Usage data and analytics (device, pages viewed, referrers)</li>
                <li>Support communications (email, Discord, forms)</li>
                <li>Cookies and similar technologies (see Cookie Policy)</li>
              </ul>
            </CardContent>
          </Card>

          {/* 3. How We Use Data */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">3. How We Use Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide and improve the Platform</li>
                <li>Prevent abuse, fraud, and violations</li>
                <li>Support customer service and communications</li>
                <li>Comply with legal obligations (including DMCA)</li>
              </ul>
            </CardContent>
          </Card>

          {/* 4. Sharing */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">4. Sharing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>We may share data with:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Service providers (hosting, analytics, support)</li>
                <li>Law enforcement or regulators when required by law</li>
                <li>Other users via public on-chain data</li>
              </ul>
            </CardContent>
          </Card>

          {/* 5. Data Retention */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">5. Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>We retain off-chain data only as long as necessary for the purposes described in this policy, unless a longer retention period is required by law.</p>
            </CardContent>
          </Card>

          {/* 6. Your Rights */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">6. Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>Depending on your jurisdiction, you may have rights to access, correct, or delete your personal information.</p>
              <p className="text-xs text-muted-foreground">Note: On-chain data and IPFS content are public/immutable and cannot be altered or deleted by us.</p>
            </CardContent>
          </Card>

          {/* 7. International Transfers */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">7. International Transfers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Our services may be provided globally. Your data may be processed in countries that may not have the same data protection laws as your jurisdiction.</p>
            </CardContent>
          </Card>

          {/* 8. Changes */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">8. Changes to this Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>We may update this Privacy Policy from time to time. Continued use of the Platform after updates constitutes acceptance.</p>
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

export default PrivacyPolicy;
