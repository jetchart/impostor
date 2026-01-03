import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Eye, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { totalWords, categories } from "@/data/words";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdBanner from "@/components/AdBanner";

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem("visitor_email") || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlayClick = () => {
    setShowEmailDialog(true);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("visitor_emails")
        .insert({ email: email.trim() });
      
      if (error) throw error;
      
      localStorage.setItem("visitor_email", email.trim());
      setShowEmailDialog(false);
      navigate("/setup");
    } catch (error) {
      console.error("Error saving email:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el email. Intentá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Ad Banner */}
      <div className="absolute top-4">
        <AdBanner />
      </div>
      {/* Main Content */}
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo/Title */}
        <div className="animate-float space-y-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-purple-500 to-pink-500 shadow-2xl shadow-primary/30">
            <Eye className="h-12 w-12 text-white" />
          </div>
          <h1 className="font-display text-6xl tracking-wider text-glow">
            IMPOSTOR
          </h1>
          <p className="text-lg text-muted-foreground">
            ¿Quién es el impostor entre nosotros?
          </p>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-6">
          <div className="text-center">
            <p className="font-display text-3xl text-accent text-glow-accent">
              {totalWords}
            </p>
            <p className="text-sm text-muted-foreground">Palabras</p>
          </div>
          <div className="h-12 w-px bg-border/50" />
          <div className="text-center">
            <p className="font-display text-3xl text-primary text-glow">
              {categories.length}
            </p>
            <p className="text-sm text-muted-foreground">Categorías</p>
          </div>
          <div className="h-12 w-px bg-border/50" />
          <div className="text-center">
            <p className="font-display text-3xl text-foreground">
              3-20
            </p>
            <p className="text-sm text-muted-foreground">Jugadores</p>
          </div>
        </div>

        {/* Play Button */}
        <div className="space-y-4 pt-4">
          <Button
            onClick={handlePlayClick}
            variant="mystery"
            size="xl"
            className="w-full"
          >
            <Users className="h-6 w-6" />
            JUGAR
          </Button>
        </div>

        {/* How to Play */}
        <div className="rounded-xl bg-card/50 border border-border/30 p-6 text-left">
          <div className="mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">¿Cómo se juega?</h2>
          </div>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                1
              </span>
              <span>
                Agregá los nombres de todos los jugadores y elegí cuántos impostores habrá.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                2
              </span>
              <span>
                Cada jugador toca su nombre para ver su palabra en secreto. Los <span className="text-citizen font-medium">inocentes</span> ven la palabra, los <span className="text-impostor font-medium">impostores</span> ven una pista.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                3
              </span>
              <span>
                Por turnos, cada uno dice algo relacionado a su palabra. ¡Cuidado con revelar demasiado!
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                4
              </span>
              <span>
                Después de varias rondas, voten quién creen que es el impostor. ¡El impostor gana si no lo descubren!
              </span>
            </li>
          </ol>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground/50">
          Basado en el clásico juego de palabras para fiestas
        </p>

        {/* Ad Banner Bottom */}
        <AdBanner />
      </div>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ingresá tu email para jugar</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Cargando..." : "Continuar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
