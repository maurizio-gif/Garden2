-- Il pannello (server Next.js, service_role) chiama funzioni di riepilogo che
-- impiegano qualche secondo (Finanza ~7 s): con gli 8 s ereditati da
-- authenticator bastava un po' di carico per andare in timeout. Solo per
-- service_role; anon e authenticated restano a 3 e 8 secondi.
alter role service_role set statement_timeout = '30s';
notify pgrst, 'reload config';
