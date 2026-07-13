import { Database } from "bun:sqlite";

const db = new Database("bemestar360.db", { create: true });

db.run("PRAGMA foreign_keys = ON;");

db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    endereco TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo_usuario TEXT CHECK(tipo_usuario IN ('paciente', 'profissional')) NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS triagens (
    id_triagem INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    respostas_sintomas TEXT NOT NULL,
    nivel_risco TEXT CHECK(nivel_risco IN ('baixo', 'médio', 'alto')) NOT NULL,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS alertas (
    id_alerta INTEGER PRIMARY KEY AUTOINCREMENT,
    id_triagem INTEGER NOT NULL,
    FOREIGN KEY(id_triagem) REFERENCES triagens(id_triagem) ON DELETE CASCADE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS comorbidades (
    id_comorbidade INTEGER PRIMARY KEY AUTOINCREMENT,
    id_paciente INTEGER NOT NULL,
    id_profissional INTEGER NOT NULL,
    descricao_comorbidade TEXT NOT NULL,
    FOREIGN KEY(id_paciente) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY(id_profissional) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
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

    if (m === "GET" && url.pathname === "/") return servirArquivo("./index.html", "text/html");
    if (m === "GET" && url.pathname === "/index.html") return servirArquivo("./index.html", "text/html");
    if (m === "GET" && url.pathname === "/style.css") return servirArquivo("./style.css", "text/css");
    if (m === "GET" && url.pathname === "/app.js") return servirArquivo("./app.js", "application/javascript");

    if (m === "POST" && url.pathname === "/api/cadastro") {
      try {
        const dados = await req.json();
        const { nome, endereco, email, senha, tipo_usuario } = dados;
        if (!nome || !endereco || !email || !senha || !tipo_usuario) {
          return new Response(JSON.stringify({ erro: "Dados incompletos" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const stmt = db.prepare("INSERT INTO usuarios (nome, endereco, email, senha, tipo_usuario) VALUES (?, ?, ?, ?, ?)");
        stmt.run(nome, endereco, email, senha, tipo_usuario);
        return new Response(JSON.stringify({ sucesso: true }), { status: 201, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ erro: "Email ja cadastrado ou erro de validacao" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    if (m === "POST" && url.pathname === "/api/login") {
      try {
        const dados = await req.json();
        const { email, senha } = dados;
        const stmt = db.prepare("SELECT id_usuario, nome, endereco, email, tipo_usuario FROM usuarios WHERE email = ? AND senha = ?");
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
        const { id_usuario, respostas_sintomas, nivel_risco } = dados;
        if (!id_usuario || !respostas_sintomas || !nivel_risco) {
          return new Response(JSON.stringify({ erro: "Dados incompletos" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const transacao = db.transaction(() => {
          const stmtTriagem = db.prepare("INSERT INTO triagens (id_usuario, respostas_sintomas, nivel_risco) VALUES (?, ?, ?)");
          const resultado = stmtTriagem.run(id_usuario, JSON.stringify(respostas_sintomas), nivel_risco.toLowerCase());
          const idTriagemInserida = resultado.lastInsertRowId;

          if (nivel_risco.toLowerCase() === "médio" || nivel_risco.toLowerCase() === "alto") {
            const stmtAlerta = db.prepare("INSERT INTO alertas (id_triagem) VALUES (?)");
            stmtAlerta.run(idTriagemInserida);
          }
          return true;
        });

        transacao();
        return new Response(JSON.stringify({ sucesso: true }), { status: 201, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ erro: "Erro ao salvar triagem e gerar alertas" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    if (m === "GET" && url.pathname === "/api/alertas") {
      try {
        const stmt = db.prepare(`
          SELECT alertas.id_alerta, triagens.id_triagem, triagens.nivel_risco, triagens.data_criacao, triagens.respostas_sintomas, usuarios.nome, usuarios.id_usuario
          FROM alertas
          JOIN triagens ON alertas.id_triagem = triagens.id_triagem
          JOIN usuarios ON triagens.id_usuario = usuarios.id_usuario
          ORDER BY CASE triagens.nivel_risco WHEN 'alto' THEN 1 WHEN 'médio' THEN 2 END, triagens.data_criacao DESC
        `);
        const lista = stmt.all();
        const processado = lista.map(item => ({
          id_alerta: item.id_alerta,
          id_paciente: item.id_usuario,
          nome: item.nome,
          risco: item.nivel_risco,
          data: item.data_criacao,
          respostas: JSON.parse(item.respostas_sintomas)
        }));
        return new Response(JSON.stringify(processado), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ erro: "Erro ao buscar alertas" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    if (m === "POST" && url.pathname === "/api/comorbidades") {
      try {
        const dados = await req.json();
        const { id_paciente, id_profissional, descricao_comorbidade } = dados;
        if (!id_paciente || !id_profissional || !descricao_comorbidade) {
          return new Response(JSON.stringify({ erro: "Dados incompletos" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const stmt = db.prepare("INSERT INTO comorbidades (id_paciente, id_profissional, descricao_comorbidade) VALUES (?, ?, ?)");
        stmt.run(id_paciente, id_profissional, descricao_comorbidade);
        return new Response(JSON.stringify({ sucesso: true }), { status: 201, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ erro: "Erro ao registrar comorbidade" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    if (m === "GET" && url.pathname === "/api/comorbidades") {
      try {
        const stmt = db.prepare(`
          SELECT comorbidades.id_comorbidade, comorbidades.descricao_comorbidade, paciente.nome AS nome_paciente, profissional.nome AS nome_profissional
          FROM comorbidades
          JOIN usuarios AS paciente ON comorbidades.id_paciente = paciente.id_usuario
          JOIN usuarios AS profissional ON comorbidades.id_profissional = profissional.id_usuario
        `);
        const lista = stmt.all();
        return new Response(JSON.stringify(lista), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ erro: "Erro ao buscar comorbidades" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    return new Response("Rota nao encontrada", { status: 404 });
  }
});

console.log(`Servidor rodando em http://localhost:${server.port}`);