# Serverová vrstva
V etapě 1 nejsou aplikační služby ani připojení k databázi. Health handler v `src/app/api/health` potvrzuje pouze běh procesu.
Od etapy 2 sem patří serverová infrastruktura identity a transakčního kontextu. Serverové moduly označit `server-only`; nevytvářet fallback backend. Doménová pravidla patří do služeb příslušného modulu.
