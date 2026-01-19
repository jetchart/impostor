import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Volume2, VolumeX, Bot, User, Skull, Shield, Loader2, ChevronRight, Eye, Send, Mic, MicOff, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRandomWord, difficultyLabels, Difficulty } from "@/data/words";
import { toast } from "sonner";
import { speak, cancelSpeech, preloadVoices } from "@/utils/tts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import AdBanner from "@/components/AdBanner";

interface Player {
  name: string;
  isBot: boolean;
}

interface GamePlayer extends Player {
  isImpostor: boolean;
  word: string;
  hint: string;
  hasSeenWord: boolean;
}

interface Description {
  playerName: string;
  text: string;
  round: number;
}

interface Vote {
  voterName: string;
  votedForName: string;
  isBot: boolean;
}

interface GameState {
  players: GamePlayer[];
  turnOrder: number[];
  currentTurnPosition: number;
  currentRound: number;
  descriptions: Description[];
  votes: Vote[];
  phase: "reveal" | "playing" | "voting" | "finished" | "impostor-wins";
  word: string;
  hint: string;
  difficulty: Difficulty;
  isMuted: boolean;
  votingOrder?: string[];
  currentVoterIndex?: number;
  allowImpostorHint: boolean;
}

export default function PlayTurns() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showingCard, setShowingCard] = useState<number | null>(null);
  const [humanInput, setHumanInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [turnAnnounced, setTurnAnnounced] = useState(false);
  const hasInitialized = useRef(false);
  const processingTurn = useRef(false);

  useEffect(() => {
    preloadVoices();
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const data = sessionStorage.getItem("gameData");
    if (!data) {
      navigate("/setup");
      return;
    }

    const { players, impostorCount, selectedCategories = [], difficulty = "normal", allowImpostorHint = true } = JSON.parse(data);
    const { word, hint } = getRandomWord(selectedCategories, difficulty);
    
    // Select random impostors
    const impostorIndices = new Set<number>();
    while (impostorIndices.size < impostorCount) {
      const randomIndex = Math.floor(Math.random() * players.length);
      impostorIndices.add(randomIndex);
    }

    // Create game players with roles - BOTs are auto-marked as seen
    const gamePlayers: GamePlayer[] = players.map((p: Player, i: number) => ({
      ...p,
      isImpostor: impostorIndices.has(i),
      word,
      hint,
      hasSeenWord: p.isBot, // BOTs don't need to reveal, auto-mark as seen
    }));

    // Create random turn order
    const order = [...Array(gamePlayers.length).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    // If all players are bots, skip reveal phase and start playing directly
    const allBots = gamePlayers.every(p => p.isBot);

    setGameState({
      players: gamePlayers,
      turnOrder: order,
      currentTurnPosition: 0,
      currentRound: 1,
      descriptions: [],
      votes: [],
      phase: allBots ? "playing" : "reveal",
      word,
      hint,
      difficulty,
      isMuted: false,
      allowImpostorHint,
    });
  }, [navigate]);

  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (gameState?.isMuted) {
        resolve();
        return;
      }
      setIsSpeaking(true);
      
      // Safety timeout - resolve after 5 seconds max to prevent hanging
      const timeout = setTimeout(() => {
        setIsSpeaking(false);
        resolve();
      }, 5000);
      
      speak(text, () => {
        clearTimeout(timeout);
        setIsSpeaking(false);
        resolve();
      });
    });
  }, [gameState?.isMuted]);

  const getCurrentPlayer = useCallback(() => {
    if (!gameState) return null;
    const len = gameState.players.length;
    if (!len) return null;

    const orderIndex = gameState.currentTurnPosition % len;
    const playerIndex = gameState.turnOrder?.[orderIndex];
    if (playerIndex === undefined || playerIndex === null) return null;

    const player = gameState.players[playerIndex];
    if (!player) return null;

    return { ...player, index: playerIndex };
  }, [gameState]);

  const handleRevealCard = (index: number) => {
    if (!gameState) return;
    setShowingCard(index);
  };

  const confirmSeen = async (index: number) => {
    if (!gameState) return;
    
    const newPlayers = [...gameState.players];
    newPlayers[index] = { ...newPlayers[index], hasSeenWord: true };
    
    setGameState({ ...gameState, players: newPlayers });
    setShowingCard(null);

    // Check if all players have seen their words
    if (newPlayers.every(p => p.hasSeenWord)) {
      toast.success("¡Todos listos! Empieza el juego");
      speak("Iniciando partida");
      setGameState(prev => prev ? { ...prev, phase: "playing" } : null);
    }
  };

  const generateBotDescription = async (player: GamePlayer): Promise<string> => {
    if (!gameState) return "Mmm...";

    try {
      const { data, error } = await supabase.functions.invoke("generate-bot-description", {
        body: {
          word: player.word,
          hint: player.hint,
          isImpostor: player.isImpostor,
          previousDescriptions: gameState.descriptions.map(d => d.text),
          difficulty: gameState.difficulty,
        },
      });

      if (error) throw error;
      return data.description || "Es algo interesante...";
    } catch (err) {
      console.error("Error generating bot description:", err);
      // Fallback single words based on difficulty
      const fallbacks: Record<string, string[]> = {
        facil: ["Conocido", "Común", "Popular", "Típico", "Clásico"],
        normal: ["Cotidiano", "Familiar", "Habitual", "Frecuente", "Normal"],
        dificil: ["Interesante", "Particular", "Especial", "Curioso", "Notable"],
        leyenda: ["Abstracto", "Complejo", "Único", "Raro", "Peculiar"]
      };
      const options = fallbacks[gameState.difficulty] || fallbacks.normal;
      return options[Math.floor(Math.random() * options.length)];
    }
  };

  const checkBotImpostorGuess = async (player: GamePlayer, description: string): Promise<boolean> => {
    if (!gameState || !player.isImpostor || !player.isBot) return false;
    
    // Check if bot impostor guessed the secret word
    const normalizedDescription = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedWord = gameState.word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return normalizedDescription.includes(normalizedWord);
  };

  const advanceToNextTurn = useCallback(async () => {
    if (!gameState) return;

    const nextPosition = gameState.currentTurnPosition + 1;
    
    setGameState(prev => prev ? {
      ...prev,
      currentTurnPosition: nextPosition
    } : null);
    
    setTurnAnnounced(false);
  }, [gameState]);

  // Check if we're starting a new round BEFORE the first player's turn
  const checkAndAnnounceNewRound = useCallback(async () => {
    if (!gameState) return false;

    const playersPerRound = gameState.players.length;
    const completedDescriptions = gameState.descriptions.length;
    
    // Calculate which round we should be in based on completed descriptions
    const expectedRound = Math.floor(completedDescriptions / playersPerRound) + 1;
    
    // If the expected round is higher than current, we need to announce transition
    if (expectedRound > gameState.currentRound) {
      const previousRound = gameState.currentRound;
      
      // Small pause between announcements
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Announce new round
      await speakText(`Comienza la ronda ${expectedRound}`);
      
      setGameState(prev => prev ? {
        ...prev,
        currentRound: expectedRound
      } : null);
      toast.info(`¡Ronda ${expectedRound}!`);
      
      return true; // Announced new round
    }
    
    return false; // No new round
  }, [gameState, speakText]);

  const handleBotTurn = useCallback(async () => {
    if (!gameState || gameState.phase !== "playing" || processingTurn.current) return;

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer || !currentPlayer.isBot) return;

    processingTurn.current = true;
    setIsGenerating(true);

    try {
      const playerData = gameState.players[currentPlayer.index];
      const description = await generateBotDescription(playerData);
      
      // Check if bot impostor guessed the secret word
      if (playerData.isImpostor) {
        const guessedCorrectly = await checkBotImpostorGuess(playerData, description);
        if (guessedCorrectly) {
          // Add description first
          const newDescriptions: Description[] = [
            ...gameState.descriptions,
            { playerName: currentPlayer.name, text: description, round: gameState.currentRound },
          ];
          setGameState(prev => prev ? { ...prev, descriptions: newDescriptions, phase: "impostor-wins" } : null);
          await speakText(`¡${currentPlayer.name} dijo la palabra secreta: ${description}! ¡El impostor gana!`);
          setIsGenerating(false);
          processingTurn.current = false;
          return;
        }
      }
      
      // Add description to list
      const newDescriptions: Description[] = [
        ...gameState.descriptions,
        { playerName: currentPlayer.name, text: description, round: gameState.currentRound },
      ];

      setGameState(prev => prev ? { ...prev, descriptions: newDescriptions } : null);

      // Speak the description
      await speakText(`${currentPlayer.name} dice: ${description}`);

      setIsGenerating(false);
      processingTurn.current = false;
      
      // Wait 1 second before announcing next turn
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Advance turn
      await advanceToNextTurn();
    } catch (error) {
      console.error("Bot turn error:", error);
      toast.error("Error en el turno del bot");
      setIsGenerating(false);
      processingTurn.current = false;
    }
  }, [gameState, getCurrentPlayer, speakText, advanceToNextTurn]);

  const isWordAlreadyUsed = useCallback((word: string): boolean => {
    if (!gameState) return false;
    const normalizeWord = (w: string) => w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const normalizedWord = normalizeWord(word);
    return gameState.descriptions.some(d => normalizeWord(d.text) === normalizedWord);
  }, [gameState]);

  const handleHumanSubmit = async () => {
    if (!gameState || !humanInput.trim()) return;

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer || currentPlayer.isBot) return;

    const description = humanInput.trim();
    
    // Check if word is already used
    if (isWordAlreadyUsed(description)) {
      toast.error("¡Esa palabra ya fue dicha! Elegí otra.");
      return;
    }
    
    hardStopRecording();
    
    // Check if impostor said the secret word
    const currentPlayerData = gameState.players[currentPlayer.index];
    if (currentPlayerData.isImpostor) {
      const normalizedDescription = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normalizedWord = gameState.word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      if (normalizedDescription.includes(normalizedWord)) {
        setHumanInput("");
        setGameState(prev => prev ? { ...prev, phase: "impostor-wins" as any } : null);
        await speakText(`¡${currentPlayer.name} dijo la palabra secreta! ¡El impostor gana!`);
        return;
      }
    }
    
    const newDescriptions: Description[] = [
      ...gameState.descriptions,
      { playerName: currentPlayer.name, text: description, round: gameState.currentRound },
    ];

    setGameState(prev => prev ? { ...prev, descriptions: newDescriptions } : null);
    setHumanInput("");

    // Speak the description for bots to "hear"
    await speakText(`${currentPlayer.name} dice: ${description}`);

    // Wait 1 second before announcing next turn
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Advance turn
    await advanceToNextTurn();
  };

  const startVoting = async () => {
    if (!gameState) return;
    // Create voting order: humans first (in player order), then bots
    const humanPlayers = gameState.players.filter(p => !p.isBot);
    const botPlayers = gameState.players.filter(p => p.isBot);
    const votingOrder = [...humanPlayers.map(p => p.name), ...botPlayers.map(p => p.name)];

    setGameState(prev => prev ? { 
      ...prev, 
      phase: "voting", 
      votes: [],
      votingOrder,
      currentVoterIndex: 0
    } : null);

    await speakText("¡Es hora de votar! ¿Quién es el impostor?");
  };

  const getCurrentVoter = useCallback(() => {
    if (!gameState || !gameState.votingOrder) return null;
    const idx = gameState.currentVoterIndex ?? 0;
    if (idx >= gameState.votingOrder.length) return null; // Voting complete
    const voterName = gameState.votingOrder[idx];
    if (!voterName) return null;
    return gameState.players.find(p => p.name === voterName) || null;
  }, [gameState]);

  const handleHumanVote = async (votedForName: string) => {
    if (!gameState) return;
    
    const currentVoter = getCurrentVoter();
    if (!currentVoter || currentVoter.isBot) return;
    
    const newVote: Vote = {
      voterName: currentVoter.name,
      votedForName,
      isBot: false
    };
    
    await speakText(`${currentVoter.name} vota por ${votedForName}`);
    
    const newVotes = [...gameState.votes, newVote];
    const nextIndex = (gameState.currentVoterIndex || 0) + 1;
    
    if (nextIndex >= gameState.players.length) {
      setGameState(prev => prev ? { 
        ...prev, 
        votes: newVotes,
        phase: "finished"
      } : null);
      speakText("¡Votación terminada!");
    } else {
      setGameState(prev => prev ? { 
        ...prev, 
        votes: newVotes,
        currentVoterIndex: nextIndex
      } : null);
    }
  };

  const getVoteResults = () => {
    if (!gameState) return [];
    
    const voteCounts: Record<string, number> = {};
    gameState.votes.forEach(v => {
      voteCounts[v.votedForName] = (voteCounts[v.votedForName] || 0) + 1;
    });
    
    return Object.entries(voteCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Handle bot voting when it's their turn
  useEffect(() => {
    if (!gameState || gameState.phase !== "voting" || !gameState.votingOrder) return;
    
    const idx = gameState.currentVoterIndex ?? 0;
    
    // If voting is complete, ensure we transition to finished phase
    if (idx >= gameState.votingOrder.length) {
      console.log("Voting complete, transitioning to finished phase");
      setGameState(prev => prev && prev.phase === "voting" ? { ...prev, phase: "finished" } : prev);
      return;
    }
    
    const voterName = gameState.votingOrder[idx];
    const currentVoter = gameState.players.find(p => p.name === voterName);
    
    // Only proceed if it's a bot's turn
    if (!currentVoter || !currentVoter.isBot) return;
    
    console.log(`Bot voting: ${currentVoter.name} at index ${idx}`);
    
    // Bot votes after a short delay using AI analysis
    const timer = setTimeout(async () => {
      let targetPlayerName: string;
      
      try {
        // Call edge function for intelligent voting
        const { data, error } = await supabase.functions.invoke("generate-bot-description", {
          body: {
            action: "vote",
            players: gameState.players.map(p => ({ name: p.name })),
            descriptions: gameState.descriptions,
            voterName: currentVoter.name,
            voterIsImpostor: currentVoter.isImpostor,
            word: gameState.word,
          },
        });
        
        if (error || !data?.votedFor) {
          throw new Error("Vote failed");
        }
        
        targetPlayerName = data.votedFor;
      } catch (err) {
        console.error("Bot vote error:", err);
        // Fallback to random vote
        const otherPlayers = gameState.players.filter(p => p.name !== currentVoter.name);
        targetPlayerName = otherPlayers[Math.floor(Math.random() * otherPlayers.length)].name;
      }
      
      const newVote: Vote = {
        voterName: currentVoter.name,
        votedForName: targetPlayerName,
        isBot: true
      };
      
      await speakText(`${currentVoter.name} vota por ${targetPlayerName}`);
      
      setGameState(prev => {
        if (!prev || !prev.votingOrder) return prev;
        const newVotes = [...prev.votes, newVote];
        const nextIndex = (prev.currentVoterIndex || 0) + 1;
        
        if (nextIndex >= prev.votingOrder.length) {
          speakText("¡Votación terminada!");
          return { ...prev, votes: newVotes, phase: "finished" };
        }
        return { ...prev, votes: newVotes, currentVoterIndex: nextIndex };
      });
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [gameState?.phase, gameState?.currentVoterIndex, gameState?.votingOrder, speakText]);

  // Announce turn and trigger bot if needed - check for new round BEFORE announcing turn
  useEffect(() => {
    if (!gameState || gameState.phase !== "playing" || turnAnnounced || processingTurn.current) return;

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return;

    const announceTurn = async () => {
      setTurnAnnounced(true);
      
      // Check if we're starting a new round BEFORE announcing the turn
      await checkAndAnnounceNewRound();
      
      // Small delay after round announcement if there was one
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await speakText(`Es el turno de ${currentPlayer.name}`);
      
      // If it's a bot, start their turn after announcing
      if (currentPlayer.isBot) {
        setTimeout(() => handleBotTurn(), 500);
      }
    };

    announceTurn();
  }, [gameState?.phase, gameState?.currentTurnPosition, turnAnnounced, getCurrentPlayer, speakText, handleBotTurn, checkAndAnnounceNewRound]);

  // Announce result when game finishes
  const resultAnnouncedRef = useRef(false);
  useEffect(() => {
    if (!gameState || gameState.phase !== "finished" || resultAnnouncedRef.current) return;
    
    resultAnnouncedRef.current = true;
    
    // Calculate who was voted and if impostor was caught
    const voteCounts: Record<string, number> = {};
    gameState.votes.forEach(v => {
      voteCounts[v.votedForName] = (voteCounts[v.votedForName] || 0) + 1;
    });
    
    const sortedResults = Object.entries(voteCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    
    const topVoted = sortedResults[0];
    if (!topVoted) return;
    
    const topVotedPlayer = gameState.players.find(p => p.name === topVoted.name);
    const impostorCaught = topVotedPlayer?.isImpostor === true;
    
    const announcement = impostorCaught 
      ? `¡${topVoted.name} fue descubierto! Era el impostor. ¡Los inocentes ganan!`
      : `¡${topVoted.name} era inocente! El impostor gana la partida.`;
    
    // Delay slightly to let "Votación terminada" finish
    setTimeout(() => {
      speakText(announcement);
    }, 1500);
  }, [gameState?.phase, gameState?.votes, gameState?.players, speakText]);

  const toggleMute = () => {
    if (!gameState) return;
    if (!gameState.isMuted) {
      cancelSpeech();
    }
    setGameState({ ...gameState, isMuted: !gameState.isMuted });
  };

  const resetGame = () => {
    cancelSpeech();
    hasInitialized.current = false;
    processingTurn.current = false;
    window.location.reload();
  };

  // Speech-to-text using Web Speech API
  const recognitionRef = useRef<any>(null);
  const sttHadResultRef = useRef(false);
  const sttFinalRef = useRef("");
  const sttIgnoreResultsRef = useRef(false);

  function hardStopRecording() {
    sttIgnoreResultsRef.current = true;
    try {
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop?.();
    } catch (e) {
      console.warn("[STT] stop failed:", e);
    }
    setIsRecording(false);
    sttHadResultRef.current = false;
    sttFinalRef.current = "";
  }

  const toggleRecording = () => {
    // Stop recording
    if (isRecording) {
      try {
        recognitionRef.current?.abort?.();
        recognitionRef.current?.stop?.();
      } catch (e) {
        console.warn("[STT] stop failed:", e);
      }
      setIsRecording(false);
      return;
    }

    // Avoid TTS interfering with mic capture.
    sttIgnoreResultsRef.current = false;
    cancelSpeech();

    // Web Speech API must be started from a user gesture.
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error(
        "Tu navegador no soporta dictado. Probá con Chrome en Android/PC/Mac.",
      );
      return;
    }

    if (!window.isSecureContext) {
      toast.error("El dictado requiere HTTPS (sitio seguro). ");
      return;
    }

    sttHadResultRef.current = false;
    sttFinalRef.current = "";
    sttIgnoreResultsRef.current = false;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang =
        navigator.language && navigator.language.startsWith("es")
          ? navigator.language
          : "es-ES";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onstart = () => {
        console.log("[STT] onstart");
      };

      recognition.onaudiostart = () => console.log("[STT] onaudiostart");
      recognition.onspeechstart = () => console.log("[STT] onspeechstart");
      recognition.onspeechend = () => console.log("[STT] onspeechend");
      recognition.onnomatch = () => console.log("[STT] onnomatch");

      recognition.onresult = (event: any) => {
        if (sttIgnoreResultsRef.current) return;
        sttHadResultRef.current = true;

        let finalText = sttFinalRef.current;
        let interimText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results?.[i]?.[0]?.transcript ?? "";
          const chunk = String(t).trim();
          if (!chunk) continue;

          if (event.results[i].isFinal) {
            finalText += (finalText ? " " : "") + chunk;
          } else {
            interimText += (interimText ? " " : "") + chunk;
          }
        }

        sttFinalRef.current = finalText;
        const combined = `${finalText} ${interimText}`.trim();
        if (combined) setHumanInput(combined);
      };

      recognition.onerror = (event: any) => {
        console.error("[STT] onerror:", event);

        const code = event?.error;
        if (code === "not-allowed" || code === "service-not-allowed") {
          toast.error("Permiso de micrófono bloqueado (revisá permisos). ");
        } else if (code === "no-speech") {
          toast.error("No se detectó voz. Intentá de nuevo.");
        } else if (code === "audio-capture") {
          toast.error("No se encontró micrófono disponible.");
        } else if (code === "network") {
          toast.error("Error de red del dictado. Intentá de nuevo.");
        } else if (code === "aborted") {
          // user canceled
        } else {
          toast.error("Error al reconocer voz.");
        }
      };

      recognition.onend = () => {
        console.log("[STT] onend", {
          hadResult: sttHadResultRef.current,
          final: sttFinalRef.current,
        });
        setIsRecording(false);

        if (sttIgnoreResultsRef.current) return;

        if (sttHadResultRef.current && sttFinalRef.current.trim()) {
          toast.success("¡Listo! Revisá y enviá tu descripción.");
        }
      };

      recognitionRef.current = recognition;

      // Update UI immediately (onstart can be delayed in some browsers).
      setIsRecording(true);
      toast.info("Escuchando... hablá ahora");

      recognition.start();

      // Best-effort permission warmup (non-blocking).
      navigator.mediaDevices
        ?.getUserMedia?.({ audio: true })
        .then((stream) => stream.getTracks().forEach((t) => t.stop()))
        .catch((err) => console.warn("[STT] getUserMedia failed:", err));
    } catch (err) {
      console.error("[STT] failed to start:", err);
      toast.error("No se pudo iniciar el dictado.");
      setIsRecording(false);
    }
  };

  const handleSkipTurn = async () => {
    if (!gameState) return;
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return;

    // Cancel ongoing bot processing if any
    if (currentPlayer.isBot) {
      processingTurn.current = false;
      setIsGenerating(false);
    }

    const newDescriptions: Description[] = [
      ...gameState.descriptions,
      { playerName: currentPlayer.name, text: "(pasó)", round: gameState.currentRound },
    ];

    setGameState(prev => prev ? { ...prev, descriptions: newDescriptions } : null);
    setHumanInput("");

    await speakText(`${currentPlayer.name} pasa su turno`);
    await advanceToNextTurn();
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

  const currentPlayer = getCurrentPlayer();
  const revealedCount = gameState.players.filter(p => p.hasSeenWord).length;
  const allBots = gameState.players.every(p => p.isBot);
  const impostors = gameState.players.filter(p => p.isImpostor);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Ad Banner */}
        <AdBanner />
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              cancelSpeech();
              hardStopRecording();
              navigate("/setup");
            }}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Salir</span>
          </button>
          <div className="flex items-center gap-3">
            {gameState.phase === "playing" && (
              <span className="text-sm text-muted-foreground">
                Ronda {gameState.currentRound}
              </span>
            )}
            <button
              onClick={resetGame}
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              title="Reiniciar partida"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              onClick={toggleMute}
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {gameState.isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <h1 className="font-display text-3xl tracking-wider text-glow text-center">
          {gameState.phase === "reveal" && "REVELAR PALABRAS"}
          {gameState.phase === "playing" && `RONDA ${gameState.currentRound}`}
          {gameState.phase === "voting" && "¡VOTACIÓN!"}
          {gameState.phase === "finished" && "RESULTADOS"}
        </h1>

        {/* Bot Observer Panel - Show when all players are bots */}
        {allBots && gameState.phase === "playing" && (
          <div className="rounded-xl bg-gradient-to-br from-primary/10 via-card to-primary/5 border border-primary/30 p-4 space-y-3">
            <div className="flex items-center gap-2 justify-center">
              <Bot className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">Modo Espectador</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-citizen/10 border border-citizen/30 p-3">
                <p className="text-xs text-muted-foreground uppercase">Palabra Secreta</p>
                <p className="font-display text-xl text-citizen tracking-wider">{gameState.word}</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-3">
                <p className="text-xs text-muted-foreground uppercase">Pista</p>
                {gameState.allowImpostorHint ? (
                  <p className="font-display text-xl text-primary tracking-wider">{gameState.hint}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sin pista</p>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-impostor/10 border border-impostor/30 p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase">Impostor{impostors.length > 1 ? 'es' : ''}</p>
              <p className="font-display text-lg text-impostor tracking-wider">
                {impostors.map(p => p.name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Reveal Phase */}
        {gameState.phase === "reveal" && (
          <>
            <div className="rounded-xl bg-card/50 border border-border/30 p-4 text-center">
              <Eye className="mx-auto h-8 w-8 text-primary/70" />
              <p className="mt-2 text-sm text-muted-foreground">
                Cada jugador debe tocar su nombre para ver su rol y palabra.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {revealedCount} de {gameState.players.length} listos
              </p>
            </div>

            <div className="space-y-2">
              {gameState.players.map((player, index) => {
                if (showingCard === index) {
                  return (
                    <div
                      key={index}
                      className={cn(
                        "animate-reveal rounded-xl border-4 p-6",
                        player.isImpostor
                          ? "border-impostor/70 bg-gradient-to-br from-impostor/20 via-card to-red-950/30"
                          : "border-citizen/70 bg-gradient-to-br from-citizen/20 via-card to-green-950/30"
                      )}
                    >
                      <div className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-widest">
                          {player.name}
                        </p>

                        <div className={cn(
                          "mx-auto flex items-center justify-center gap-3 rounded-2xl px-6 py-4",
                          player.isImpostor
                            ? "bg-impostor/30 border-2 border-impostor"
                            : "bg-citizen/30 border-2 border-citizen"
                        )}>
                          {player.isImpostor ? (
                            <Skull className="h-10 w-10 text-impostor" />
                          ) : (
                            <Shield className="h-10 w-10 text-citizen" />
                          )}
                          <span className={cn(
                            "font-display text-2xl tracking-wider",
                            player.isImpostor ? "text-impostor" : "text-citizen"
                          )}>
                            {player.isImpostor ? "IMPOSTOR" : "INOCENTE"}
                          </span>
                        </div>

                        <div className={cn(
                          "rounded-xl p-4 space-y-1",
                          player.isImpostor ? "bg-impostor/10" : "bg-citizen/10"
                        )}>
                          {player.isImpostor ? (
                            gameState.allowImpostorHint ? (
                              <>
                                <p className="text-xs font-medium uppercase">Tu pista:</p>
                                <p className="font-display text-3xl tracking-wider text-red-500">
                                  {player.hint}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                Sin pista - ¡Buena suerte!
                              </p>
                            )
                          ) : (
                            <>
                              <p className="text-xs font-medium uppercase">Tu palabra:</p>
                              <p className="font-display text-3xl tracking-wider text-green-500">
                                {player.word}
                              </p>
                            </>
                          )}
                        </div>

                        <button
                          onClick={() => confirmSeen(index)}
                          className={cn(
                            "rounded-lg px-6 py-2 text-sm font-medium transition-all hover:scale-[1.02] border-2",
                            player.isImpostor
                              ? "border-impostor text-impostor bg-transparent hover:bg-impostor/10"
                              : "border-citizen text-citizen bg-transparent hover:bg-citizen/10"
                          )}
                        >
                          ✓ Entendido
                        </button>
                      </div>
                    </div>
                  );
                }

                const disabled = player.hasSeenWord || showingCard !== null;
                return (
                  <button
                    key={index}
                    onClick={() => !player.hasSeenWord && !showingCard && handleRevealCard(index)}
                    disabled={disabled}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg border p-4 transition-all",
                      player.hasSeenWord || showingCard !== null
                        ? "opacity-50 bg-secondary/50 border-border/50 cursor-not-allowed"
                        : "bg-card border-border/50 hover:border-primary/50 hover:scale-[1.02]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        player.isBot ? "bg-purple-500/20" : "bg-primary/20"
                      )}>
                        {player.isBot ? (
                          <Bot className="h-5 w-5 text-purple-400" />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <span className="font-medium">{player.name}</span>
                      {player.isBot && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                          BOT
                        </span>
                      )}
                    </div>
                    {player.hasSeenWord ? (
                      <span className="text-xs text-muted-foreground">✓ Listo</span>
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Playing Phase */}
        {gameState.phase === "playing" && currentPlayer && (
          <>
            {/* Current Turn */}
            <div className={cn(
              "rounded-xl border-2 p-6 text-center",
              currentPlayer.isBot ? "border-purple-500/50 bg-purple-500/10" : "border-primary/50 bg-primary/10"
            )}>
              <p className="text-sm text-muted-foreground mb-2">Turno de:</p>
              <div className="flex items-center justify-center gap-3">
                {currentPlayer.isBot ? (
                  <Bot className="h-8 w-8 text-purple-400" />
                ) : (
                  <User className="h-8 w-8 text-primary" />
                )}
                <span className="font-display text-3xl tracking-wider">
                  {currentPlayer.name}
                </span>
              </div>

              {isGenerating && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Pensando...</span>
                  </div>
                  <Button
                    onClick={handleSkipTurn}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4 mr-1" />
                    Pasar turno
                  </Button>
                </div>
              )}

              {isSpeaking && (
                <div className="mt-4 flex items-center justify-center gap-2 text-primary">
                  <Volume2 className="h-5 w-5 animate-pulse" />
                  <span>Hablando...</span>
                </div>
              )}
            </div>

            {/* Human input */}
            {!currentPlayer.isBot && !isGenerating && !isSpeaking && (
              <div className="space-y-3">
                
                {/* Input + Mic + Send in one row */}
                <div className="flex gap-2">
                  <Input
                    value={humanInput}
                    onChange={(e) => setHumanInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleHumanSubmit()}
                    placeholder="Escribí tu descripción..."
                    className="flex-1"
                    maxLength={100}
                  />
                  <Button
                    onClick={toggleRecording}
                    variant={isRecording ? "destructive" : "outline"}
                    size="icon"
                    className="shrink-0"
                  >
                    {isRecording ? (
                      <MicOff className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                  <Button 
                    onClick={handleHumanSubmit} 
                    disabled={!humanInput.trim()}
                    variant="game"
                    size="icon"
                    className="shrink-0"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
                
                {/* Skip turn button in separate row */}
                <Button
                  onClick={handleSkipTurn}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Pasar turno
                </Button>
              </div>
            )}

            {/* Descriptions so far */}
            {gameState.descriptions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Descripciones ({gameState.descriptions.length}):
                </h3>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {gameState.descriptions.map((desc, i) => {
                    const player = gameState.players.find(p => p.name === desc.playerName);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-lg border p-3",
                          player?.isBot ? "border-purple-500/30 bg-purple-500/5" : "border-border/50 bg-card/50"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {player?.isBot ? (
                            <Bot className="h-4 w-4 text-purple-400" />
                          ) : (
                            <User className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium text-sm">{desc.playerName}</span>
                          <span className="text-xs text-muted-foreground">R{desc.round}</span>
                        </div>
                        <p className="text-foreground">{desc.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vote button */}
            <Button 
              onClick={startVoting}
              disabled={gameState.descriptions.length < gameState.players.length * gameState.currentRound}
              variant="outline" 
              size="sm"
              className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/50 hover:border-orange-500 hover:from-orange-500/30 hover:to-red-500/30 text-orange-300 hover:text-orange-200 transition-all"
            >
              <Vote className="h-4 w-4 mr-1.5" />
              Votar
            </Button>

            {/* Player Order */}
            <div className="flex flex-wrap gap-2 justify-center">
              {gameState.turnOrder.map((playerIndex, orderPos) => {
                const player = gameState.players[playerIndex];
                const descriptionsForPlayer = gameState.descriptions.filter(d => d.playerName === player.name).length;
                const expectedForRound = Math.min(gameState.currentRound, Math.ceil((gameState.currentTurnPosition + 1) / gameState.players.length));
                const hasDescribedThisRound = descriptionsForPlayer >= expectedForRound;
                const isCurrent = orderPos === gameState.currentTurnPosition % gameState.players.length;
                
                return (
                  <div
                    key={orderPos}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      hasDescribedThisRound
                        ? "bg-citizen/20 text-citizen"
                        : isCurrent
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {player.name}
                    {player.isBot && " 🤖"}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Impostor Wins Phase */}
        {gameState.phase === "impostor-wins" && (
          <>
            <div className="rounded-xl bg-gradient-to-br from-impostor/30 to-orange-500/30 border-2 border-impostor p-8 text-center animate-pulse">
              <Skull className="mx-auto h-16 w-16 text-impostor mb-4" />
              <p className="font-display text-3xl text-impostor text-glow-impostor tracking-wider mb-2">
                ¡EL IMPOSTOR GANA!
              </p>
              <p className="text-lg text-muted-foreground">
                ¡Dijo la palabra secreta!
              </p>
            </div>

            <div className="rounded-xl bg-card border border-border/50 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">La palabra era:</p>
              <p className="font-display text-3xl text-citizen text-glow-accent">{gameState.word}</p>
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-sm text-muted-foreground mb-1">Pista del impostor:</p>
                <p className="font-display text-xl text-orange-400">{gameState.hint}</p>
              </div>
            </div>

            <div className="rounded-xl bg-impostor/10 border border-impostor/30 p-4">
              <p className="text-sm text-muted-foreground mb-2">Impostores:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {gameState.players
                  .filter(p => p.isImpostor)
                  .map((p, i) => (
                    <span key={i} className="px-4 py-2 rounded-full bg-impostor/20 text-impostor font-display text-lg">
                      {p.name} {p.isBot && "🤖"}
                    </span>
                  ))}
              </div>
            </div>

            <Button onClick={resetGame} variant="game" size="lg" className="w-full">
              <RotateCcw className="h-5 w-5" />
              NUEVA PARTIDA
            </Button>
          </>
        )}

        {/* Voting Phase */}
        {gameState.phase === "voting" && (
          <>
            <div className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 p-6 text-center">
              <Vote className="mx-auto h-10 w-10 text-primary mb-2" />
              <p className="font-display text-2xl text-glow tracking-wider">
                ¿QUIÉN ES EL IMPOSTOR?
              </p>
            </div>

            {/* Current voter */}
            {(() => {
              const currentVoter = getCurrentVoter();

              if (!currentVoter) {
                // Voting complete - show loading or transition
                return (
                  <div className="rounded-xl bg-card border border-border/50 p-4 text-center">
                    <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-2" />
                    <p className="text-muted-foreground">Contando votos...</p>
                  </div>
                );
              }

              if (!currentVoter.isBot) {
                return (
                  <div className="rounded-xl bg-card border border-border/50 p-4">
                    <p className="text-sm text-muted-foreground mb-3 text-center">
                      <span className="font-medium text-foreground">{currentVoter.name}</span>, ¿por quién votás?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {gameState.players
                        .filter(p => p.name !== currentVoter.name)
                        .map((player, i) => (
                          <button
                            key={i}
                            onClick={() => handleHumanVote(player.name)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border p-3 transition-all hover:scale-[1.02]",
                              player.isBot 
                                ? "border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50"
                                : "border-border/50 bg-card hover:border-primary/50"
                            )}
                          >
                            {player.isBot ? (
                              <Bot className="h-5 w-5 text-purple-400" />
                            ) : (
                              <User className="h-5 w-5 text-primary" />
                            )}
                            <span className="font-medium">{player.name}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="rounded-xl bg-card border border-border/50 p-4 text-center">
                    <div className="animate-pulse">
                      <Bot className="mx-auto h-8 w-8 text-purple-400 mb-2" />
                      <p className="text-muted-foreground">{currentVoter.name} está votando...</p>
                    </div>
                  </div>
                );
              }
            })()}

            {/* Votes so far */}
            {gameState.votes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Votos ({gameState.votes.length}/{gameState.players.length}):
                </h3>
                <div className="space-y-1">
                  {gameState.votes.map((vote, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2",
                        vote.isBot ? "bg-purple-500/5" : "bg-card/50"
                      )}
                    >
                      <span className="text-sm">
                        {vote.isBot && <Bot className="h-3 w-3 inline mr-1 text-purple-400" />}
                        {vote.voterName}
                      </span>
                      <span className="text-sm">
                        → <span className="font-medium text-impostor">{vote.votedForName}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Descriptions reference */}
            <details className="rounded-xl bg-card/50 border border-border/30">
              <summary className="p-3 cursor-pointer text-sm text-muted-foreground">
                Ver descripciones ({gameState.descriptions.length})
              </summary>
              <div className="p-3 pt-0 space-y-2 max-h-40 overflow-y-auto">
                {gameState.descriptions.map((desc, i) => {
                  const player = gameState.players.find(p => p.name === desc.playerName);
                  return (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{desc.playerName}</span>
                      {player?.isBot && " 🤖"}: {desc.text}
                    </div>
                  );
                })}
              </div>
            </details>
          </>
        )}

        {/* Finished Phase */}
        {gameState.phase === "finished" && (() => {
          const voteResults = getVoteResults();
          const topVoted = voteResults[0];
          const topVotedPlayer = topVoted ? gameState.players.find(p => p.name === topVoted.name) : null;
          const impostorCaught = topVotedPlayer?.isImpostor === true;
          
          return (
          <>
            <div className={cn(
              "rounded-xl border p-6 text-center",
              impostorCaught 
                ? "bg-gradient-to-br from-citizen/20 to-green-500/20 border-citizen/30" 
                : "bg-gradient-to-br from-impostor/20 to-orange-500/20 border-impostor/30"
            )}>
              <p className={cn(
                "font-display text-2xl tracking-wider",
                impostorCaught ? "text-citizen" : "text-glow-impostor"
              )}>
                {impostorCaught ? "¡IMPOSTOR DESCUBIERTO!" : "¡EL IMPOSTOR GANÓ!"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {impostorCaught 
                  ? `${topVoted?.name} fue votado y era el impostor` 
                  : `${topVoted?.name} fue votado pero era inocente`}
              </p>
            </div>

            {/* Vote results */}
            {gameState.votes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Resultado de la votación:</h3>
                <div className="space-y-2">
                  {getVoteResults().map((result, i) => {
                    const player = gameState.players.find(p => p.name === result.name);
                    const isImpostor = player?.isImpostor;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3",
                          i === 0 ? "border-impostor/50 bg-impostor/10" : "border-border/50 bg-card/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {player?.isBot && <Bot className="h-4 w-4 text-purple-400" />}
                          <span className="font-medium">{result.name}</span>
                          {isImpostor && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-impostor/20 text-impostor">
                              IMPOSTOR
                            </span>
                          )}
                        </div>
                        <span className="font-display text-xl">
                          {result.count} voto{result.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All descriptions */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Todas las descripciones:</h3>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {gameState.descriptions.map((desc, i) => {
                  const player = gameState.players.find(p => p.name === desc.playerName);
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-border/50 bg-card/50 p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {player?.isBot && <Bot className="h-4 w-4 text-purple-400" />}
                        <span className="font-medium text-sm">{desc.playerName}</span>
                        <span className="text-xs text-muted-foreground">R{desc.round}</span>
                        {player?.isImpostor && (
                          <Skull className="h-3 w-3 text-impostor" />
                        )}
                      </div>
                      <p className="text-foreground">{desc.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reveal answer */}
            <div className="rounded-xl bg-card border border-border/50 p-4">
              <p className="text-sm text-muted-foreground mb-2">La palabra era:</p>
              <p className="font-display text-3xl text-citizen text-glow-accent">{gameState.word}</p>
              
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-sm text-muted-foreground mb-1">Pista del impostor:</p>
                {gameState.allowImpostorHint ? (
                  <p className="font-display text-xl text-orange-400">{gameState.hint}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sin pista (modo difícil)</p>
                )}
              </div>
              
              <p className="mt-3 text-sm text-muted-foreground">Impostores:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {gameState.players
                  .filter(p => p.isImpostor)
                  .map((p, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-impostor/20 text-impostor text-sm font-medium">
                      {p.name} {p.isBot && "🤖"}
                    </span>
                  ))}
              </div>
            </div>

            <Button onClick={resetGame} variant="game" size="lg" className="w-full">
              <RotateCcw className="h-5 w-5" />
              NUEVA PARTIDA
            </Button>
          </>
          );
        })()}

        {/* Ad Banner Bottom */}
        <AdBanner />
      </div>
    </div>
  );
}
