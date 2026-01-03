import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Minus, Trash2, Users, UserX, Play, ArrowLeft, Check, Sparkles, Zap, Bot, User, HelpCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { categories, getWordsFromCategories, getWordCountForCategory, difficultyLabels, Difficulty } from "@/data/words";
import { cn } from "@/lib/utils";
import { preloadVoices, speak } from "@/utils/tts";
import { supabase } from "@/integrations/supabase/client";
import { ALLOW_BOTS } from "@/config";
import AdBanner from "@/components/AdBanner";

interface Player {
  name: string;
  isBot: boolean;
}

export default function Setup() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [impostorCount, setImpostorCount] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [allowImpostorHint, setAllowImpostorHint] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("gameData");
    if (!raw) return;

    try {
      const data = JSON.parse(raw);

      if (Array.isArray(data?.players)) {
        setPlayers(
          data.players
            .filter((p: any) => p && typeof p.name === "string")
            .map((p: any) => ({ name: String(p.name), isBot: Boolean(p.isBot) })),
        );
      }

      if (typeof data?.impostorCount === "number") setImpostorCount(data.impostorCount);
      if (Array.isArray(data?.selectedCategories)) setSelectedCategories(data.selectedCategories);
      if (typeof data?.allowImpostorHint === "boolean") setAllowImpostorHint(data.allowImpostorHint);

      const d = data?.difficulty;
      if (d === "facil" || d === "normal" || d === "dificil" || d === "leyenda") {
        setDifficulty(d);
      }
    } catch {
      // ignore
    }
  }, []);

  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) {
      toast.error("Ingresá un nombre");
      return;
    }
    if (players.some(p => p.name === name)) {
      toast.error("Ya existe un jugador con ese nombre");
      return;
    }
    if (players.length >= 20) {
      toast.error("Máximo 20 jugadores");
      return;
    }
    setPlayers([...players, { name, isBot: isAddingBot }]);
    setNewPlayerName("");
    toast.success(`${name} ${isAddingBot ? "(BOT)" : ""} agregado`);
  };

  const addQuickBot = () => {
    const botNumber = players.filter(p => p.isBot).length + 1;
    const botName = `Bot ${botNumber}`;
    if (players.some(p => p.name === botName)) {
      const uniqueName = `Bot ${Date.now() % 1000}`;
      setPlayers([...players, { name: uniqueName, isBot: true }]);
      toast.success(`${uniqueName} agregado`);
    } else {
      setPlayers([...players, { name: botName, isBot: true }]);
      toast.success(`${botName} agregado`);
    }
  };

  const removePlayer = (index: number) => {
    const removed = players[index];
    const newPlayers = players.filter((_, i) => i !== index);
    setPlayers(newPlayers);
    toast.info(`${removed.name} eliminado`);
    
    // Ajustar impostores si excede el nuevo máximo (jugadores - 1)
    const newMaxImpostors = newPlayers.length >= 3 ? newPlayers.length - 1 : 1;
    if (impostorCount > newMaxImpostors) {
      setImpostorCount(Math.max(1, newMaxImpostors));
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const selectAllCategories = () => {
    if (selectedCategories.length === categories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(categories.map(c => c.id));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addPlayer();
    }
  };

  const maxImpostors = players.length >= 3 ? players.length - 1 : 1;
  const canStart = players.length >= 3 && impostorCount >= 1 && impostorCount <= maxImpostors;
  
  const availableWords = getWordsFromCategories(selectedCategories, difficulty);
  const wordCount = availableWords.length;

  const humanCount = players.filter(p => !p.isBot).length;
  const botCount = players.filter(p => p.isBot).length;

  const startGame = async () => {
    if (!canStart) return;

    // Prime TTS on a user gesture (important when all players are bots)
    try {
      void preloadVoices();
    } catch {
      // ignore
    }

    // Register game session
    const email = localStorage.getItem("visitor_email") || null;
    try {
      await supabase.from("game_sessions").insert({
        email,
        player_count: players.length,
        bot_count: botCount,
        impostor_count: impostorCount,
        difficulty,
        player_names: players.map(p => p.name).join(", "),
        allow_impostor_hint: allowImpostorHint,
      });
    } catch (error) {
      console.error("Error saving game session:", error);
    }

    sessionStorage.setItem(
      "gameData",
      JSON.stringify({
        players,
        impostorCount,
        selectedCategories,
        difficulty,
        allowImpostorHint,
      }),
    );

    navigate("/play-turns");
  };

  const difficulties: Difficulty[] = ["facil", "normal", "dificil", "leyenda"];

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-lg space-y-8">
        {/* Ad Banner */}
        <AdBanner />
        {/* Header */}
        <div className="space-y-2">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
          <h1 className="font-display text-4xl tracking-wider text-glow">
            CONFIGURAR PARTIDA
          </h1>
        </div>

        {/* Difficulty Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <label className="text-sm font-medium text-foreground">
              Dificultad
            </label>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {difficulties.map((diff) => (
              <button
                key={diff}
                onClick={() => setDifficulty(diff)}
                className={cn(
                  "relative flex flex-col items-start rounded-lg border p-3 text-left transition-all",
                  difficulty === diff
                    ? "border-primary bg-primary/10"
                    : "border-border/50 bg-card/50 hover:border-border hover:bg-card"
                )}
              >
                <span className={cn("text-sm font-bold", difficultyLabels[diff].color)}>
                  {difficultyLabels[diff].name}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {difficultyLabels[diff].description}
                </span>
                {difficulty === diff && (
                  <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Categorías de palabras
            </label>
            <button
              onClick={selectAllCategories}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {selectedCategories.length === categories.length ? "Deseleccionar todas" : "Seleccionar todas"}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg border p-3 text-left transition-all",
                  selectedCategories.includes(category.id)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/50 bg-card/50 text-muted-foreground hover:border-border hover:bg-card"
                )}
              >
                <span className="text-xl">{category.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{category.name}</p>
                  <p className="text-xs text-muted-foreground">{getWordCountForCategory(category.id, difficulty)} palabras</p>
                </div>
                {selectedCategories.includes(category.id) && (
                  <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
          
          <p className="text-center text-sm text-muted-foreground">
            {selectedCategories.length === 0 ? (
              <span className="text-accent">Todas las categorías · {wordCount} palabras ({difficultyLabels[difficulty].name})</span>
            ) : (
              <span>{selectedCategories.length} categoría{selectedCategories.length !== 1 && 's'} · {wordCount} palabras ({difficultyLabels[difficulty].name})</span>
            )}
          </p>
        </div>

        {/* Add Player */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Agregar jugador
            </label>
            {ALLOW_BOTS && (
              <Button
                onClick={addQuickBot}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Bot className="h-4 w-4" />
                + BOT rápido
              </Button>
            )}
          </div>
          
          {/* Player type toggle */}
          {ALLOW_BOTS && (
            <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg">
              <button
                onClick={() => setIsAddingBot(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all",
                  !isAddingBot ? "bg-card shadow-sm" : "text-muted-foreground"
                )}
              >
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">Humano</span>
              </button>
              <button
                onClick={() => setIsAddingBot(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all",
                  isAddingBot ? "bg-card shadow-sm" : "text-muted-foreground"
                )}
              >
                <Bot className="h-4 w-4" />
                <span className="text-sm font-medium">BOT</span>
              </button>
            </div>
          )}
          
          <div className="flex gap-2">
            <Input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isAddingBot ? "Nombre del BOT" : "Nombre del jugador"}
              className="flex-1 bg-card border-border/50 focus:border-primary"
              maxLength={20}
            />
            <Button onClick={addPlayer} size="icon" variant="game">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Player List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Jugadores ({players.length})
              {botCount > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({humanCount} humanos, {botCount} bots)
                </span>
              )}
            </label>
            {players.length < 3 && (
              <span className="text-xs text-muted-foreground">
                Mínimo 3 jugadores
              </span>
            )}
          </div>
          
          {players.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/50 py-12">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No hay jugadores aún
              </p>
              <p className="text-sm text-muted-foreground/70">
                Agregá al menos 3 jugadores para empezar
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((player, index) => (
                <div
                  key={index}
                  className={cn(
                    "group flex items-center justify-between rounded-lg border px-4 py-3 transition-all hover:border-destructive/50",
                    player.isBot 
                      ? "bg-purple-500/10 border-purple-500/30" 
                      : "bg-card border-border/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                      player.isBot 
                        ? "bg-purple-500/20 text-purple-400" 
                        : "bg-primary/20 text-primary"
                    )}>
                      {player.isBot ? <Bot className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.name}</span>
                      {player.isBot && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                          BOT
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removePlayer(index)}
                    className="rounded-lg p-2 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Impostor Count */}
        {players.length >= 3 && (
          <div className="space-y-4">
            <label className="text-sm font-medium text-foreground">
              Cantidad de impostores
            </label>
            <div className="flex items-center justify-center gap-6 rounded-xl bg-card border border-border/50 py-6">
              <button
                onClick={() => setImpostorCount(Math.max(1, impostorCount - 1))}
                disabled={impostorCount <= 1}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground transition-all hover:bg-secondary/80 disabled:opacity-50"
              >
                <Minus className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-3">
                <UserX className="h-8 w-8 text-impostor" />
                <span className="font-display text-5xl text-impostor text-glow-impostor">
                  {impostorCount}
                </span>
              </div>
              
              <button
                onClick={() => setImpostorCount(Math.min(maxImpostors, impostorCount + 1))}
                disabled={impostorCount >= maxImpostors}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground transition-all hover:bg-secondary/80 disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {players.length - impostorCount} inocentes vs {impostorCount} impostor{impostorCount > 1 ? "es" : ""}
            </p>

            {/* Toggle for impostor hint */}
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Pista para el impostor</span>
              </div>
              <Switch
                checked={allowImpostorHint}
                onCheckedChange={setAllowImpostorHint}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {allowImpostorHint 
                ? "El impostor verá la pista (más fácil para el impostor)" 
                : "El impostor NO verá la pista (más difícil para el impostor)"}
            </p>
          </div>
        )}

        {/* Start Game Button */}
        <Button
          onClick={startGame}
          disabled={!canStart}
          variant="mystery"
          size="xl"
          className="w-full"
        >
          <Play className="h-6 w-6" />
          EMPEZAR PARTIDA
        </Button>
        
        {!canStart && players.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {players.length < 3
              ? `Necesitás ${3 - players.length} jugador${3 - players.length > 1 ? "es" : ""} más`
              : "Configuración inválida"}
          </p>
        )}

        {/* Ad Banner Bottom */}
        <AdBanner />
      </div>
    </div>
  );
}
