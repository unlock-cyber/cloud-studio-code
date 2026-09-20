import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePageMeta } from "@/lib/seo";

export default function NotFound() {
  const navigate = useNavigate();
  usePageMeta({
    title: "Page not found — Cloud Studio Code",
    description: "This page could not be found.",
    noindex: true,
  });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col bg-background text-foreground"
    >
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-5xl mx-auto relative px-4">
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-4">404</h1>
              <p className="text-lg text-muted-foreground">Page Not Found</p>
              <Button className="mt-6" onClick={() => navigate("/")}>
                Back to home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
