import { useState } from "react";
import { Eye, EyeOff, Check, User, Skull, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerCardProps {
  name: string;
  isImpostor: boolean;
  word: string;
  hint: string;
  hasRevealed: boolean;
  onReveal: () => void;
}

export function PlayerCard({
  name,
  isImpostor,
  word,
  hint,
  hasRevealed,
  onReveal,
}: PlayerCardProps) {
  const [isRevealing, setIsRevealing] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const handleClick = () => {
    if (hasRevealed) return;
    
    setIsRevealing(true);
    setTimeout(() => {
      setShowContent(true);
    }, 300);
  };

  const handleConfirm = () => {
    setShowContent(false);
    setIsRevealing(false);
    onReveal();
  };

  if (hasRevealed) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-secondary/50 border border-border/50 p-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Check className="h-6 w-6 text-citizen" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{name}</p>
            <p className="text-sm text-muted-foreground">Ya vio su palabra</p>
          </div>
        </div>
      </div>
    );
  }

  if (isRevealing && showContent) {
    return (
      <div className={cn(
        "animate-reveal rounded-xl border-4 p-6",
        isImpostor 
          ? "border-impostor/70 bg-gradient-to-br from-impostor/20 via-card to-red-950/30" 
          : "border-citizen/70 bg-gradient-to-br from-citizen/20 via-card to-green-950/30"
      )}>
        <div className="text-center space-y-5">
          {/* Player Name */}
          <p className="text-sm text-muted-foreground uppercase tracking-widest">
            {name}
          </p>
          
          {/* Role Badge - Very Prominent */}
          <div className={cn(
            "mx-auto flex items-center justify-center gap-3 rounded-2xl px-6 py-4",
            isImpostor 
              ? "bg-impostor/30 border-2 border-impostor" 
              : "bg-citizen/30 border-2 border-citizen"
          )}>
            {isImpostor ? (
              <Skull className="h-10 w-10 text-impostor" />
            ) : (
              <Shield className="h-10 w-10 text-citizen" />
            )}
            <span className={cn(
              "font-display text-3xl tracking-wider",
              isImpostor ? "text-impostor" : "text-citizen"
            )}>
              {isImpostor ? "IMPOSTOR" : "INOCENTE"}
            </span>
          </div>
          
          {/* Word/Hint Section */}
          <div className={cn(
            "rounded-xl p-5 space-y-2",
            isImpostor ? "bg-impostor/10" : "bg-citizen/10"
          )}>
            <p className={cn(
              "text-sm font-medium uppercase tracking-wide",
              isImpostor ? "text-impostor/80" : "text-citizen/80"
            )}>
              {isImpostor ? "Tu pista es:" : "Tu palabra es:"}
            </p>
            <p className={cn(
              "font-display tracking-wider",
              isImpostor 
                ? "text-4xl text-impostor text-glow-impostor" 
                : "text-5xl text-citizen text-glow-accent"
            )}>
              {isImpostor ? hint : word}
            </p>
          </div>
          
          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            className={cn(
              "mt-4 w-full rounded-xl py-4 font-bold text-lg transition-all hover:scale-[1.02]",
              isImpostor 
                ? "bg-impostor text-white hover:bg-impostor/90" 
                : "bg-citizen text-white hover:bg-citizen/90"
            )}
          >
            ✓ ENTENDIDO
          </button>
          
          <p className="text-xs text-muted-foreground">
            Una vez que toques "Entendido", no podrás ver esto de nuevo
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border border-border/50 bg-card p-4 text-left transition-all duration-300",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02]",
        isRevealing && "animate-shake"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 transition-all group-hover:from-primary/30 group-hover:to-purple-500/30">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{name}</p>
            <p className="text-sm text-muted-foreground">Toca para revelar</p>
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-all group-hover:bg-primary/20">
          {isRevealing ? (
            <EyeOff className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Eye className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
          )}
        </div>
      </div>
      
      {/* Glow effect on hover */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
