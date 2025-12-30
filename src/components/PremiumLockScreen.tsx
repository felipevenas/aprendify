import { motion } from "framer-motion";
import { Lock, CheckCircle2, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PremiumFeature {
  title: string;
  description: string;
}

interface PremiumLockScreenProps {
  title: string;
  description: string;
  features: PremiumFeature[];
}

const PremiumLockScreen = ({ title, description, features }: PremiumLockScreenProps) => {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
        <Lock className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      <p className="text-xl text-muted-foreground mb-8">{description}</p>

      <Card className="max-w-2xl mx-auto mb-8">
        <CardContent className="pt-6">
          <div className="space-y-4 text-left">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
        onClick={() => navigate("/subscription")}
      >
        <Crown className="h-5 w-5" />
        Assinar Premium
      </Button>
    </motion.div>
  );
};

export default PremiumLockScreen;
