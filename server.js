const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(path.join(__dirname, "bemestar360.db"));
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    endereco TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo_usuario TEXT CHECK(tipo_usuario IN ('paciente', 'profissional')) NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS triagens (
    id_triagem INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    respostas_sintomas TEXT NOT NULL,
    nivel_risco TEXT CHECK(nivel_risco IN ('baixo', 'medio', 'médio', 'alto')) NOT NULL,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS alertas (
    id_alerta INTEGER PRIMARY KEY AUTOINCREMENT,
    id_triagem INTEGER NOT NULL,
    FOREIGN KEY(id_triagem) REFERENCES triagens(id_triagem) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS comorbidades (
    id_comorbidade INTEGER PRIMARY KEY AUTOINCREMENT,
    id_paciente INTEGER NOT NULL,
    id_profissional INTEGER NOT NULL,
    descricao_comorbidade TEXT NOT NULL,
    FOREIGN KEY(id_paciente) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY(id_profissional) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
  )
`);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

async function servirArquivo(res, caminhoRelativo) {
  const caminhoCompleto = path.join(__dirname, caminhoRelativo);

  try {
    const conteudo = await fs.readFile(caminhoCompleto);
    const tipo = mimeTypes[path.extname(caminhoCompleto).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": tipo });
    res.end(conteudo);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Arquivo nao encontrado");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const method = req.method || "GET";

    if (method === "GET" && url.pathname === "/") {
      await servirArquivo(res, "index.html");
      return;
    }

    if (method === "GET" && url.pathname === "/index.html") {
      await servirArquivo(res, "index.html");
      return;
    }

    if (method === "GET" && url.pathname === "/style.css") {
      await servirArquivo(res, "style.css");
      return;
    }

    if (method === "GET" && url.pathname === "/app.js") {
      await servirArquivo(res, "app.js");
      return;
    }

    if (method === "POST" && url.pathname === "/api/cadastro") {
      const dados = await lerCorpo(req);
      const { nome, endereco, email, senha, tipo_usuario } = dados;

      if (!nome || !endereco || !email || !senha || !tipo_usuario) {
        sendJson(res, 400, { erro: "Dados incompletos" });
        return;
      }

      try {
        const stmt = db.prepare("INSERT INTO usuarios (nome, endereco, email, senha, tipo_usuario) VALUES (?, ?, ?, ?, ?)");
        stmt.run(String(nome).trim(), String(endereco).trim(), String(email).trim(), String(senha), String(tipo_usuario).trim().toLowerCase());
        sendJson(res, 201, { sucesso: true });
        return;
      } catch (error) {
        const mensagemErro = String(error?.message || "");
        if (mensagemErro.includes("UNIQUE") || mensagemErro.includes("unique")) {
          sendJson(res, 409, { erro: "E-mail já cadastrado." });
          return;
        }

        console.error("Erro em /api/cadastro:", error);
        if (mensagemErro.includes("readonly")) {
          sendJson(res, 500, { erro: "Não foi possível acessar o banco de dados. Reinicie o servidor." });
          return;
        }
        sendJson(res, 400, { erro: "Não foi possível realizar o cadastro." });
        return;
      }
    }

    if (method === "POST" && url.pathname === "/api/login") {
      const dados = await lerCorpo(req);
      const { email, senha } = dados;

      if (!email || !senha) {
        sendJson(res, 400, { erro: "Email e senha são obrigatórios." });
        return;
      }

      try {
        const stmt = db.prepare("SELECT id_usuario, nome, endereco, email, tipo_usuario FROM usuarios WHERE email = ? AND senha = ?");
        const usuario = stmt.get(String(email).trim(), String(senha));

        if (!usuario) {
          sendJson(res, 401, { erro: "Credenciais invalidas" });
          return;
        }

        const usuarioNormalizado = {
          id_usuario: usuario.id_usuario,
          id: usuario.id_usuario,
          nome: usuario.nome,
          endereco: usuario.endereco,
          email: usuario.email,
          tipo_usuario: usuario.tipo_usuario,
          tipo: usuario.tipo_usuario
        };

        sendJson(res, 200, { sucesso: true, usuario: usuarioNormalizado });
        return;
      } catch (error) {
        console.error("Erro em /api/login:", error);
        sendJson(res, 500, { erro: "Erro no servidor" });
        return;
      }
    }

    if (method === "POST" && url.pathname === "/api/triagem") {
      const dados = await lerCorpo(req);
      const { id_usuario, respostas_sintomas, nivel_risco } = dados;

      if (!id_usuario || !Array.isArray(respostas_sintomas) || !nivel_risco) {
        sendJson(res, 400, { erro: "Dados incompletos" });
        return;
      }

      const nivel = String(nivel_risco).trim().toLowerCase();
      const nivelValido = ["baixo", "medio", "médio", "alto"].includes(nivel);

      if (!nivelValido) {
        sendJson(res, 400, { erro: "Nível de risco inválido." });
        return;
      }

      const nivelArmazenado = nivel === "médio" ? "médio" : nivel === "medio" ? "medio" : nivel;

      db.exec("BEGIN;");
      try {
        const insertTriagem = db.prepare("INSERT INTO triagens (id_usuario, respostas_sintomas, nivel_risco) VALUES (?, ?, ?)");
        const resultado = insertTriagem.run(Number(id_usuario), JSON.stringify(respostas_sintomas), nivelArmazenado);
        const idTriagem = Number(resultado.lastInsertRowid);

        if (nivel === "medio" || nivel === "médio" || nivel === "alto") {
          const insertAlerta = db.prepare("INSERT INTO alertas (id_triagem) VALUES (?)");
          insertAlerta.run(idTriagem);
        }

        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        console.error("Erro em /api/triagem:", error);
        throw error;
      }

      sendJson(res, 201, { sucesso: true });
      return;
    }

    if (method === "GET" && url.pathname === "/api/alertas") {
      const stmt = db.prepare(`
        SELECT triagens.id_triagem, triagens.nivel_risco, triagens.data_criacao,
               triagens.respostas_sintomas, usuarios.nome, usuarios.id_usuario
        FROM triagens
        JOIN usuarios ON triagens.id_usuario = usuarios.id_usuario
        ORDER BY CASE triagens.nivel_risco
          WHEN 'alto' THEN 1
          WHEN 'medio' THEN 2
          WHEN 'médio' THEN 2
          WHEN 'baixo' THEN 3
          ELSE 4
        END,
        triagens.data_criacao DESC
      `);

      const lista = stmt.all();
      const processado = lista.map((item) => ({
        id_alerta: item.id_triagem,
        id_paciente: item.id_usuario,
        nome: item.nome,
        risco: item.nivel_risco,
        data: item.data_criacao,
        respostas: JSON.parse(item.respostas_sintomas || "[]")
      }));

      sendJson(res, 200, processado);
      return;
    }

    if (method === "POST" && url.pathname === "/api/comorbidades") {
      const dados = await lerCorpo(req);
      const { id_paciente, id_profissional, descricao_comorbidade } = dados;

      if (!id_paciente || !id_profissional || !descricao_comorbidade) {
        sendJson(res, 400, { erro: "Dados incompletos" });
        return;
      }

      const stmt = db.prepare("INSERT INTO comorbidades (id_paciente, id_profissional, descricao_comorbidade) VALUES (?, ?, ?)");
      stmt.run(Number(id_paciente), Number(id_profissional), String(descricao_comorbidade).trim());
      sendJson(res, 201, { sucesso: true });
      return;
    }

    if (method === "GET" && url.pathname === "/api/comorbidades") {
      const stmt = db.prepare(`
        SELECT comorbidades.id_comorbidade, comorbidades.descricao_comorbidade, paciente.nome AS nome_paciente, profissional.nome AS nome_profissional
        FROM comorbidades
        JOIN usuarios AS paciente ON comorbidades.id_paciente = paciente.id_usuario
        JOIN usuarios AS profissional ON comorbidades.id_profissional = profissional.id_usuario
      `);

      const lista = stmt.all();
      sendJson(res, 200, lista);
      return;
    }

    if (method === "GET" && url.pathname === "/api/triagens") {
      const idUsuario = Number(url.searchParams.get("id_usuario"));
      if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
        sendJson(res, 400, { erro: "Paciente inválido." });
        return;
      }

      const stmt = db.prepare(`
        SELECT id_triagem, respostas_sintomas, nivel_risco, data_criacao
        FROM triagens
        WHERE id_usuario = ?
        ORDER BY data_criacao DESC
      `);

      const lista = stmt.all(idUsuario).map((item) => ({
        id_triagem: item.id_triagem,
        respostas: JSON.parse(item.respostas_sintomas || "[]"),
        nivel_risco: item.nivel_risco,
        data: item.data_criacao
      }));

      sendJson(res, 200, lista);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Rota nao encontrada");
  } catch (error) {
    console.error("Erro global:", error);
    sendJson(res, 500, { erro: "Erro no servidor" });
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});