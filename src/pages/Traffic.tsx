import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Mail, ArrowLeft, Gamepad2, Users, Bot, HelpCircle, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdBanner from "@/components/AdBanner";

interface VisitorEmail {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

interface GameSession {
  id: string;
  email: string | null;
  player_count: number;
  bot_count: number;
  impostor_count: number;
  difficulty: string | null;
  player_names: string | null;
  allow_impostor_hint: boolean | null;
  created_at: string;
}

const Traffic = () => {
  const [emails, setEmails] = useState<VisitorEmail[]>([]);
  const [games, setGames] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [emailsRes, gamesRes] = await Promise.all([
        supabase
          .from("visitor_emails")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("game_sessions")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (emailsRes.error) console.error("Error fetching emails:", emailsRes.error);
      else setEmails(emailsRes.data || []);

      if (gamesRes.error) console.error("Error fetching games:", gamesRes.error);
      else setGames(gamesRes.data || []);

      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        {/* Ad Banner */}
        <div className="mb-6">
          <AdBanner />
        </div>
        <div className="flex items-center gap-4 mb-6">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Cargando...</p>
        ) : (
          <Tabs defaultValue="emails" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="emails" className="gap-2">
                <Mail className="h-4 w-4" />
                Emails ({emails.length})
              </TabsTrigger>
              <TabsTrigger value="games" className="gap-2">
                <Gamepad2 className="h-4 w-4" />
                Partidas ({games.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="emails" className="mt-4">
              {emails.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay emails registrados aún.</p>
              ) : (
                <div className="space-y-2">
                  {emails.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-card border border-border"
                    >
                      <span className="font-medium text-foreground">{item.email}</span>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(item.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="games" className="mt-4">
              {games.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay partidas registradas aún.</p>
              ) : (
                <div className="space-y-2">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      className="p-4 rounded-lg bg-card border border-border space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {game.email || "Sin email"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(game.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{game.player_count - game.bot_count} humanos</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Bot className="h-4 w-4" />
                          <span>{game.bot_count} bots</span>
                        </div>
                        {game.difficulty && (
                          <div className="flex items-center gap-1">
                            <Zap className="h-4 w-4" />
                            <span>{game.difficulty}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <HelpCircle className="h-4 w-4" />
                          <span>{game.allow_impostor_hint ? "Con pista" : "Sin pista"}</span>
                        </div>
                      </div>
                      {game.player_names && (
                        <p className="text-xs text-muted-foreground truncate">
                          Jugadores: {game.player_names}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Ad Banner Bottom */}
        <div className="mt-6">
          <AdBanner />
        </div>
      </div>
    </div>
  );
};

export default Traffic;
