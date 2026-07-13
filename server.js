import { Database } from "bun:sqlite";

const db = new Database("bemestar360.db", { create: true });

db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS triagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    respostas TEXT NOT NULL,
    risco TEXT NOT NULL,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
  )
`);

async function servirArquivo(caminho, contentType) {
  const arquivo = Bun.file(caminho);
  if (await arquivo.exists()) {
    return new Response(arquivo, {
      headers: { "Content-Type": contentType }
    });
  }
  return new Response("Arquivo nao encontrado", { status: 404 });
}

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const m = req.method;

    if (m === "GET" && url.pathname === "/") {
      return servirArquivo("./index.html", "text/html");
    }
    if (m === "GET" && url.pathname === "/index.html") {
      return servirArquivo("./index.html", "text/html");
    }
    if (m === "GET" && url.pathname === "/style.css") {
      return servirArquivo("./style.css", "text/css");
    }
    if (m === "GET" && url.pathname === "/app.js") {
      return servirArquivo("./app.js", "application/javascript");
    }

    if (m === "POST" && url.pathname === "/api/cadastro") {
      try {
        const dados = await req.json();
        const { nome, email, senha, tipo } = dados;
        if (!nome || !email || !senha || !tipo) {
          return new Response(JSON.stringify({ erro: "Dados incompletos" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const stmt = db.prepare("INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)");
        stmt.run(nome, email, senha, tipo);
        return new Response(JSON.stringify({ sucesso: true }), { status: 201, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ erro: "Email ja cadastrado ou erro interno" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    if (m === "POST" && url.pathname === "/api/login") {
      try {
        const dados = await req.json();
        const { email, senha } = dados;
        const stmt = db.prepare("SELECT id, nome, email, tipo FROM usuarios WHERE email = ? AND senha = ?");
        const usuario = stmt.get(email, senha);
        if (usuario) {
          return new Response(JSON.stringify({ sucesso: true, usuario }), { status: 200, headers: { "Content-Type": "application/json" } });
        } else {
          return new Response(JSON.stringify({ erro: "Credenciais invalidas" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
      } catch (e) {
        return new Response(JSON.stringify({ erro: "Erro no servidor" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    if (m === "POST" && url.pathname === "/api/triagem") {
      try {
        const dados = await req.json();
        const { usuario_id, respostas, risco } = dados;
        if (!usuario_id || !respostas || !risco) {
          return new Response(JSON.stringify({ erro: "Dados incompletos" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const stmt = db.prepare("INSERT INTO triagens (usuario_id, respostas, risco) VALUES (?, ?, ?)");
        stmt.run(usuario_id, JSON.stringify(respostas), risco);
        return new Response(JSON.stringify({ sucesso: true }), { status: 201, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ erro: "Erro ao salvar triagem" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    if (m === "GET" && url.pathname === "/api/alertas") {
      try {
        const stmt = db.prepare(`
          SELECT triagens.id, triagens.risco, triagens.data_criacao, triagens.respostas, usuarios.nome 
          FROM triagens 
          JOIN usuarios ON triagens.usuario_id = usuarios.id 
          ORDER BY triagens.data_criacao DESC
        `);
        const lista = stmt.all();
        const processado = lista.map(item => ({
          id: item.id,
          nome: item.nome,
          risco: item.risco,
          data: item.data_criacao,
          respostas: JSON.parse(item.respostas)
        }));
        return new Response(JSON.stringify(processado), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ erro: "Erro ao buscar alertas" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    return new Response("Rota nao encontrada", { status: 404 });
  }
});

console.log(`Servidor rodando em http://localhost:${server.port}`);