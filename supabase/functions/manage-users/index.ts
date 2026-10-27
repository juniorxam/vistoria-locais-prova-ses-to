import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://vistoria-locais-prova-ses-to.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sessão não autenticada." }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const principalEmail = "juniorxamdev@gmail.com";
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !user) return json({ error: "Sessão inválida ou expirada." }, 401);
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: { action?: string; email?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Corpo JSON inválido." }, 400); }

  if (body.action === "session") {
    if ((user.email || "").toLowerCase() === principalEmail) {
      if (!user.email_confirmed_at) {
        return json({ error: "Confirme o e-mail do administrador principal antes de ativar o acesso." }, 403);
      }
      const { error } = await adminClient.from("user_roles").upsert(
        { user_id: user.id, role: "principal_admin" }, { onConflict: "user_id" },
      );
      if (error) return json({ error: "Não foi possível ativar o administrador principal." }, 500);
      return json({ role: "principal_admin" });
    }
    const { data: role, error } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (error) return json({ error: "Não foi possível verificar o perfil de acesso." }, 500);
    if (!role) return json({ error: "Esta conta ainda não foi autorizada. Solicite um convite ao administrador." }, 403);
    return json({ role: role.role, forcePasswordChange: user.app_metadata?.force_password_change === true });
  }

  if (body.action === "complete-password-change") {
    if (user.app_metadata?.force_password_change !== true) {
      return json({ error: "Esta conta não está aguardando redefinição obrigatória de senha." }, 400);
    }
    const { error } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata || {}), force_password_change: false },
    });
    if (error) return json({ error: "A senha foi alterada, mas não foi possível concluir a ativação. Tente novamente." }, 500);
    return json({ ok: true, message: "Senha atualizada com sucesso." });
  }

  const { data: callerRole, error: roleError } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError || callerRole?.role !== "principal_admin") {
    return json({ error: "Somente o administrador principal pode convidar usuários." }, 403);
  }
  if (body.action === "invite") {
    const email = (body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);
    if (email === principalEmail) return json({ error: "Este e-mail já é o administrador principal." }, 400);
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: "123456",
      email_confirm: true,
      app_metadata: { force_password_change: true },
    });
    if (error) return json({ error: "Não foi possível criar a conta. Verifique se o e-mail já possui cadastro." }, 400);
    if (!data.user) return json({ error: "A criação da conta não retornou um usuário válido." }, 500);
    const { error: assignError } = await adminClient.from("user_roles").upsert(
      { user_id: data.user.id, role: "authorized_user" }, { onConflict: "user_id" },
    );
    if (assignError) { await adminClient.auth.admin.deleteUser(data.user.id); return json({ error: "Não foi possível atribuir o perfil. A conta recém-criada foi cancelada." }, 500); }
    return json({ ok: true, message: `Conta criada para ${email}. Senha temporária: 123456. O usuário deverá alterá-la no primeiro acesso. Compartilhe a senha por um canal seguro.` });
  }
  return json({ error: "Ação inválida." }, 400);
});