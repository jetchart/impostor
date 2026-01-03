import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body ONCE and destructure all possible fields
    const requestBody = await req.json();
    const { 
      word, 
      hint, 
      isImpostor, 
      previousDescriptions = [], 
      difficulty = "normal", 
      action,
      // Vote-specific fields
      players = [],
      descriptions = [],
      voterName = "",
      voterIsImpostor = false
    } = requestBody;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Handle word deduction for impostor bots
    if (action === "deduce") {
      const deducePrompt = `Sos un impostor en un juego de palabras. Tu pista era "${hint}".
Los jugadores dijeron estas palabras: ${previousDescriptions.join(", ")}.
Analizá las palabras y tratá de adivinar cuál es la palabra secreta.
Respondé SOLO con la palabra que creés que es, sin explicación.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Sos un detective tratando de adivinar una palabra secreta basándote en pistas." },
            { role: "user", content: deducePrompt },
          ],
          max_tokens: 50,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        console.error("Deduce error:", response.status);
        return new Response(JSON.stringify({ guess: "No sé" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const guess = data.choices?.[0]?.message?.content?.trim() || "No sé";

      return new Response(JSON.stringify({ guess }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle intelligent voting for bots
    if (action === "vote") {
      // Build description map per player
      const playerDescriptions: Record<string, string[]> = {};
      players.forEach((p: { name: string }) => {
        playerDescriptions[p.name] = [];
      });
      descriptions.forEach((d: { playerName: string; text: string }) => {
        if (playerDescriptions[d.playerName]) {
          playerDescriptions[d.playerName].push(d.text);
        }
      });
      
      const otherPlayers = players.filter((p: { name: string }) => p.name !== voterName);
      const playerSummary = otherPlayers.map((p: { name: string }) => 
        `- ${p.name}: dijo "${playerDescriptions[p.name]?.join('", "') || 'nada'}"`
      ).join("\n");
      
      let votePrompt: string;
      if (voterIsImpostor) {
        // Impostor tries to blend in and vote for someone innocent
        votePrompt = `Sos el IMPOSTOR en un juego de palabras. Querés pasar desapercibido.
Estos son los otros jugadores y lo que dijeron:
${playerSummary}

Analizá quién parece más sospechoso para los demás (aunque vos sabés que sos el impostor).
Votá por alguien que parezca tener respuestas raras o fuera de lugar para desviar la atención.
Respondé SOLO con el nombre exacto del jugador por quien votás.`;
      } else {
        // Innocent tries to detect the impostor
        votePrompt = `Sos INOCENTE en un juego de palabras. La palabra secreta es "${word}".
Estos son los otros jugadores y lo que dijeron:
${playerSummary}

Analizá las respuestas de cada jugador:
- Los inocentes conocen la palabra y sus respuestas deberían estar relacionadas con "${word}"
- El impostor NO conoce la palabra y sus respuestas pueden ser vagas, genéricas o fuera de contexto

¿Quién parece saber menos sobre la palabra? ¿Quién dio respuestas que no encajan bien?
Respondé SOLO con el nombre exacto del jugador que creés que es el impostor.`;
      }
      
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Sos un jugador de un juego social de deducción. Respondé solo con el nombre del jugador." },
            { role: "user", content: votePrompt },
          ],
          max_tokens: 50,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        console.error("Vote error:", response.status);
        // Fallback to random vote
        const randomPlayer = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        return new Response(JSON.stringify({ votedFor: randomPlayer?.name || "Unknown" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      let votedFor = data.choices?.[0]?.message?.content?.trim() || "";
      
      // Validate the vote is for a valid player
      const validPlayer = otherPlayers.find((p: { name: string }) => 
        votedFor.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(votedFor.toLowerCase())
      );
      
      if (validPlayer) {
        votedFor = validPlayer.name;
      } else {
        // If AI gave invalid response, pick random
        votedFor = otherPlayers[Math.floor(Math.random() * otherPlayers.length)]?.name || "Unknown";
      }

      return new Response(JSON.stringify({ votedFor }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate description logic
    const difficultyInstructions: Record<string, { innocent: string; impostor: string }> = {
      facil: {
        innocent: "Dá una pista MUY CLARA y OBVIA que ayude a los inocentes. Puede ser casi directa.",
        impostor: "Tratá de ser muy genérico. No te preocupes tanto por parecer sospechoso."
      },
      normal: {
        innocent: "Dá una pista equilibrada: útil para inocentes pero no tan obvia para el impostor.",
        impostor: "Tratá de sonar convincente con algo relacionado a la categoría general."
      },
      dificil: {
        innocent: "Dá una pista SUTIL e INDIRECTA. Solo los que conocen la palabra deberían entenderla.",
        impostor: "Sé muy astuto. Usá palabras abstractas que suenen inteligentes pero vagas."
      },
      leyenda: {
        innocent: "Dá una pista MUY CRÍPTICA. Usá metáforas, referencias culturales o conexiones oscuras. Casi nadie debería entenderla fácil.",
        impostor: "Sé un maestro del engaño. Usá palabras filosóficas, abstractas o poéticas que suenen profundas."
      }
    };

    const instructions = difficultyInstructions[difficulty] || difficultyInstructions.normal;

    // Normalize function to compare words
    const normalizeWord = (w: string) => w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const usedWords = previousDescriptions.map((d: string) => normalizeWord(d));
    const usedWordsStr = previousDescriptions.length > 0 ? previousDescriptions.join(", ") : "";

    let systemPrompt: string;
    let userPrompt: string;

    if (isImpostor) {
      // Check if it's first round and nobody said the hint yet
      const isFirstRound = previousDescriptions.length < 4;
      const normalizedHint = normalizeWord(hint);
      const hintAlreadySaid = usedWords.some((w: string) => w.includes(normalizedHint) || normalizedHint.includes(w));
      
      // If first round and hint not said, use the hint as description
      if (isFirstRound && !hintAlreadySaid && previousDescriptions.length === 0) {
        return new Response(JSON.stringify({ description: hint }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Impostor analyzes previous descriptions to deduce the word
      const analysisContext = previousDescriptions.length > 0 
        ? `Analizá estas palabras que dijeron otros: ${usedWordsStr}. Tratá de deducir qué palabra secreta podrían estar describiendo y da una palabra que encaje con ese patrón.`
        : "Sos el primero en hablar, así que usá tu pista como base.";
      
      systemPrompt = `Sos un jugador BOT en un juego tipo "Impostores". Sos el IMPOSTOR y NO sabés la palabra secreta. 
Solo tenés una pista vaga sobre la categoría: "${hint}".
Tenés que inventar UNA SOLA PALABRA que suene relacionada para que los demás piensen que sabés la palabra.
${instructions.impostor}
IMPORTANTE: Si otros ya hablaron, analizá sus palabras para deducir la palabra secreta y dar algo coherente.
REGLA CRÍTICA: NO podés repetir palabras ya dichas. Palabras prohibidas: ${usedWordsStr || "ninguna aún"}.
Respondé con UNA SOLA PALABRA en español. Sin explicaciones, sin puntos, solo la palabra.`;
      
      userPrompt = `Tu pista de categoría es: "${hint}". 
${analysisContext}
PROHIBIDO usar estas palabras: ${usedWordsStr || "ninguna aún"}.
Dame UNA SOLA PALABRA que NO esté en la lista de prohibidas.`;
    } else {
      systemPrompt = `Sos un jugador BOT en un juego tipo "Impostores". Sos INOCENTE y conocés la palabra secreta: "${word}".
Tenés que dar UNA SOLA PALABRA relacionada que ayude a otros inocentes sin revelar la palabra al impostor.
${instructions.innocent}
REGLA CRÍTICA: NO podés repetir palabras ya dichas. Palabras prohibidas: ${usedWordsStr || "ninguna aún"}.
Respondé con UNA SOLA PALABRA en español. Sin explicaciones, sin puntos, solo la palabra. NUNCA digas la palabra secreta directamente.`;
      
      userPrompt = `La palabra secreta es: "${word}".
${previousDescriptions.length > 0 ? `Palabras ya dichas (PROHIBIDO repetir): ${usedWordsStr}.` : "Sos el primero en hablar."}
Dame UNA SOLA PALABRA que NO esté en la lista de prohibidas y cumpla con el nivel de dificultad.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes, esperá un momento." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let description = data.choices?.[0]?.message?.content?.trim() || "Mmm... es algo interesante";
    
    // Clean the description (remove punctuation, extra text)
    description = description.replace(/[.,!?;:]+$/g, "").split(/[\s,]+/)[0];
    
    // Final validation: check if the word is repeated (reuse existing usedWords)
    const normalizedDesc = normalizeWord(description);
    
    if (usedWords.includes(normalizedDesc)) {
      // If repeated, add a modifier or use a fallback
      const fallbacks = ["Relacionado", "Conectado", "Vinculado", "Asociado", "Similar", "Cercano", "Parecido", "Afin"];
      const unusedFallback = fallbacks.find(f => !usedWords.includes(normalizeWord(f)));
      description = unusedFallback || `Algo${Math.floor(Math.random() * 100)}`;
    }

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
