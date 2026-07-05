import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MailX, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setState("invalid");
        return;
      }
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("invalid");
      }
    };
    validate();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error || !data?.success) setState("error");
    else setState("done");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-background to-background-secondary">
      <Card className="p-8 max-w-md w-full text-center space-y-4">
        {state === "loading" && <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />}

        {state === "valid" && (
          <>
            <MailX className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-2xl font-semibold">Unsubscribe?</h1>
            <p className="text-muted-foreground">
              You'll stop receiving Podcastify summary emails.
            </p>
            <Button onClick={handleConfirm} className="w-full bg-gradient-primary">
              Confirm unsubscribe
            </Button>
          </>
        )}

        {state === "submitting" && (
          <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
        )}

        {(state === "done" || state === "already") && (
          <>
            <Check className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-2xl font-semibold">You're unsubscribed</h1>
            <p className="text-muted-foreground">
              You won't receive any more summary emails.
            </p>
          </>
        )}

        {(state === "invalid" || state === "error") && (
          <>
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h1 className="text-2xl font-semibold">Invalid link</h1>
            <p className="text-muted-foreground">
              This unsubscribe link is invalid or expired.
            </p>
          </>
        )}
      </Card>
    </div>
  );
};

export default Unsubscribe;
