import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Eye, Users, UserX, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "@/components/PlayerCard";
import { getRandomWord, difficultyLabels, Difficulty } from "@/data/words";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AdBanner from "@/components/AdBanner";

interface GameState {
  players: string[];
  impostorCount: number;
  word: string;
  hint: string;
  impostors: Set<number>;
  revealed: Set<number>;
  selectedCategories: string[];
  difficulty: Difficulty;
}

export default function Play() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [allRevealed, setAllRevealed] = useState(false);

  useEffect(() => {
    const data = sessionStorage.getItem("gameData");
    if (!data) {
      navigate("/setup");
      return;
    }

    const { players, impostorCount, selectedCategories = [], difficulty = "normal" } = JSON.parse(data);
    
    const { word, hint } = getRandomWord(selectedCategories, difficulty);
    
    const impostors = new Set<number>();
    while (impostors.size < impostorCount) {
      const randomIndex = Math.floor(Math.random() * players.length);
      impostors.add(randomIndex);
    }

    setGameState({
      players,
      impostorCount,
      word,
      hint,
      impostors,
      revealed: new Set(),
      selectedCategories,
      difficulty,
    });
  }, [navigate]);

  const handleReveal = (index: number) => {
    if (!gameState) return;
    
    const newRevealed = new Set(gameState.revealed);
    newRevealed.add(index);
    
    setGameState({
      ...gameState,
      revealed: newRevealed,
    });

    if (newRevealed.size === gameState.players.length) {
      setAllRevealed(true);
      toast.success("¡Todos vieron su palabra! ¡A jugar!");
    }
  };

  const resetGame = async () => {
    const data = sessionStorage.getItem("gameData");
    if (!data) return;

    const { players, impostorCount, selectedCategories = [], difficulty = "normal", allowImpostorHint = true, botCount = 0 } = JSON.parse(data);
    const { word, hint } = getRandomWord(selectedCategories, difficulty);
    
    const impostors = new Set<number>();
    while (impostors.size < impostorCount) {
      const randomIndex = Math.floor(Math.random() * players.length);
      impostors.add(randomIndex);
    }

    // Registrar la nueva partida en la base de datos
    try {
      await supabase.from("game_sessions").insert({
        player_count: players.length,
        bot_count: botCount,
        impostor_count: impostorCount,
        difficulty,
        player_names: players.join(", "),
        allow_impostor_hint: allowImpostorHint,
      });
    } catch (error) {
      console.error("Error saving game session:", error);
    }

    setGameState({
      players,
      impostorCount,
      word,
      hint,
      impostors,
      revealed: new Set(),
      selectedCategories,
      difficulty,
    });
    setAllRevealed(false);
    toast.success("¡Nueva partida iniciada!");
  };

  if (!gameState) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-lg text-muted-foreground">
          Cargando...
        </div>
      </div>
    );
  }

  const revealedCount = gameState.revealed.size;
  const totalPlayers = gameState.players.length;
  const progress = (revealedCount / totalPlayers) * 100;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Ad Banner */}
        <AdBanner />
        {/* Header */}
        <div className="space-y-2">
          <button
            onClick={() => navigate("/setup")}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a configurar</span>
          </button>
          <h1 className="font-display text-4xl tracking-wider text-glow">
            {allRevealed ? "¡A JUGAR!" : "REVELAR PALABRAS"}
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-card border border-border/50 p-3">
            <Users className="h-6 w-6 text-citizen" />
            <div>
              <p className="text-xl font-display text-citizen">
                {totalPlayers - gameState.impostorCount}
              </p>
              <p className="text-xs text-muted-foreground">Inocentes</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-card border border-border/50 p-3">
            <UserX className="h-6 w-6 text-impostor" />
            <div>
              <p className="text-xl font-display text-impostor">
                {gameState.impostorCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Impostor{gameState.impostorCount > 1 ? "es" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-card border border-border/50 p-3">
            <Zap className={`h-6 w-6 ${difficultyLabels[gameState.difficulty].color}`} />
            <div>
              <p className={`text-sm font-display ${difficultyLabels[gameState.difficulty].color}`}>
                {difficultyLabels[gameState.difficulty].name}
              </p>
              <p className="text-xs text-muted-foreground">Dificultad</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso</span>
            <span className="font-medium">
              {revealedCount} / {totalPlayers} revelados
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Instructions or Ready message */}
        {!allRevealed ? (
          <div className="rounded-xl bg-card/50 border border-border/30 p-4 text-center">
            <Eye className="mx-auto h-8 w-8 text-primary/70" />
            <p className="mt-2 text-sm text-muted-foreground">
              Cada jugador debe tocar su nombre para ver su palabra en secreto.
              <br />
              <span className="text-foreground font-medium">
                ¡Solo se puede ver una vez!
              </span>
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 p-6 text-center">
            <p className="font-display text-2xl text-glow tracking-wider">
              TODOS LISTOS
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Empiecen a describir la palabra por turnos.
              <br />
              ¡Descubran quién es el impostor!
            </p>
          </div>
        )}

        {/* Player Cards */}
        <div className="space-y-3">
          {gameState.players.map((player, index) => (
            <PlayerCard
              key={index}
              name={player}
              isImpostor={gameState.impostors.has(index)}
              word={gameState.word}
              hint={gameState.hint}
              hasRevealed={gameState.revealed.has(index)}
              onReveal={() => handleReveal(index)}
            />
          ))}
        </div>

        {/* New Game Button */}
        {allRevealed && (
          <Button
            onClick={resetGame}
            variant="game"
            size="lg"
            className="w-full"
          >
            <RotateCcw className="h-5 w-5" />
            NUEVA PARTIDA
          </Button>
        )}

        {/* Ad Banner Bottom */}
        <AdBanner />
      </div>
    </div>
  );
}
