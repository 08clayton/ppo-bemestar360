let usuarioLogado = null;
let indicePerguntaAtual = 0;
let respostasFormulario = [];

const perguntas = [
    {
        id: 1,
        texto: "Voce esta apresentando febre persistente ou dificuldades respiratorias graves?",
        opcoes: [
            { texto: "Nao, nenhuma complicacao respiratoria ou febre", valor: 0 },
            { texto: "Febre baixa e persistente sem falta de ar", valor: 2 },
            { texto: "Sim, febre alta e extrema dificuldade para respirar", valor: 5 }
        ]
    },
    {
        id: 2,
        texto: "Quantas refeicoes nutritivas completas voce realiza por dia em seu domicilio?",
        opcoes: [
            { texto: "Tres ou mais refeicoes", valor: 0 },
            { texto: "Duas refeicoes", valor: 1 },
            { texto: "Uma ou nenhuma refeicao equilibrada", valor: 3 }
        ]
    },
    {
        id: 3,
        texto: "Possui acesso regular a saneamento basico e agua potavel tratada em sua residencia?",
        opcoes: [
            { texto: "Sim, acesso completo e encanado", valor: 0 },
            { texto: "Acesso parcial ou intermitente", valor: 2 },
            { texto: "Nao possuo acesso a saneamento ou agua limpa", valor: 4 }
        ]
    },
    {
        id: 4,
        texto: "Com que frequencia realiza exames medicos preventivos ou consultas de rotina?",
        opcoes: [
            { texto: "Regularmente dentro do cronograma anual", valor: 0 },
            { texto: "Apenas quando apresento sintomas graves", valor: 2 },
            { texto: "Raramente ou nunca tive acesso a consultas", valor: 3 }
        ]
    }
];

const tAutenticacao = document.getElementById("tela-autenticacao");
const tPrincipal = document.getElementById("tela-principal");
const tQuestionario = document.getElementById("tela-questionario");
const tResultados = document.getElementById("tela-resultados");

const formLogin = document.getElementById("form-login");
const formCadastro = document.getElementById("form-cadastro");
const formPergunta = document.getElementById("form-pergunta");

const tabLogin = document.getElementById("tab-login");
const tabCadastro = document.getElementById("tab-cadastro");
const formLoginContainer = document.getElementById("form-login-container");
const formCadastroContainer = document.getElementById("form-cadastro-container");

const authMensagem = document.getElementById("auth-mensagem");
const headerUsuarioInfo = document.getElementById("usuario-info");
const txtUsuarioLogado = document.getElementById("usuario-logado");
const btnLogout = document.getElementById("btn-logout");

const acoesPaciente = document.getElementById("acoes-paciente");
const acoesProfissional = document.getElementById("acoes-profissional");

function mostrarMensagem(mensagem, tipo = "error") {
    authMensagem.className = tipo === "success" ? "mensagem" : "mensagem error";
    authMensagem.innerText = mensagem;
    authMensagem.classList.remove("hidden");
}

function navegarPara(tela) {
    tAutenticacao.classList.add("hidden");
    tPrincipal.classList.add("hidden");
    tQuestionario.classList.add("hidden");
    tResultados.classList.add("hidden");
    tela.classList.remove("hidden");
}

function normalizarTipo(tipo) {
    return String(tipo ?? "").trim().toLowerCase();
}

function atualizarUsuarioNaTela() {
    if (!usuarioLogado) {
        headerUsuarioInfo.classList.add("hidden");
        txtUsuarioLogado.innerText = "";
        return;
    }

    const tipo = normalizarTipo(usuarioLogado.tipo_usuario ?? usuarioLogado.tipo);
    txtUsuarioLogado.innerText = `${usuarioLogado.nome} (${tipo})`;
    headerUsuarioInfo.classList.remove("hidden");
}

tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabCadastro.classList.remove("active");
    formLoginContainer.classList.remove("hidden");
    formCadastroContainer.classList.add("hidden");
    authMensagem.classList.add("hidden");
});

tabCadastro.addEventListener("click", () => {
    tabCadastro.classList.add("active");
    tabLogin.classList.remove("active");
    formCadastroContainer.classList.remove("hidden");
    formLoginContainer.classList.add("hidden");
    authMensagem.classList.add("hidden");
});

formCadastro.addEventListener("submit", async (e) => {
    e.preventDefault();
    authMensagem.classList.add("hidden");

    const nome = document.getElementById("cad-nome").value.trim();
    const endereco = document.getElementById("cad-endereco").value.trim();
    const email = document.getElementById("cad-email").value.trim();
    const senha = document.getElementById("cad-senha").value;
    const tipo = document.getElementById("cad-tipo").value;

    const res = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, endereco, email, senha, tipo_usuario: tipo })
    });

    const dados = await res.json();
    if (res.ok && dados.sucesso) {
        formCadastro.reset();
        tabLogin.click();
        mostrarMensagem("Conta criada com sucesso! Faça o login.", "success");
        return;
    }

    mostrarMensagem(dados.erro || "Erro ao realizar cadastro.", "error");
});

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    authMensagem.classList.add("hidden");

    const email = document.getElementById("login-email").value.trim();
    const senha = document.getElementById("login-senha").value;

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
    });

    const dados = await res.json();
    if (res.ok && dados.sucesso) {
        const usuario = dados.usuario;
        usuarioLogado = {
            ...usuario,
            id: usuario.id_usuario ?? usuario.id,
            id_usuario: usuario.id_usuario ?? usuario.id,
            tipo: normalizarTipo(usuario.tipo_usuario ?? usuario.tipo),
            tipo_usuario: normalizarTipo(usuario.tipo_usuario ?? usuario.tipo)
        };

        formLogin.reset();
        atualizarUsuarioNaTela();
        carregarPainel();
        return;
    }

    mostrarMensagem(dados.erro || "Falha na autenticação.", "error");
});

btnLogout.addEventListener("click", () => {
    usuarioLogado = null;
    atualizarUsuarioNaTela();
    navegarPara(tAutenticacao);
});

function carregarPainel() {
    navegarPara(tPrincipal);
    const tipo = normalizarTipo(usuarioLogado?.tipo_usuario ?? usuarioLogado?.tipo);

    if (tipo === "paciente") {
        acoesPaciente.classList.remove("hidden");
        acoesProfissional.classList.add("hidden");
        return;
    }

    if (tipo === "profissional") {
        acoesPaciente.classList.add("hidden");
        acoesProfissional.classList.remove("hidden");
        carregarAlertas();
        return;
    }

    acoesPaciente.classList.add("hidden");
    acoesProfissional.classList.add("hidden");
}

document.getElementById("btn-iniciar-questionario").addEventListener("click", () => {
    indicePerguntaAtual = 0;
    respostasFormulario = [];
    renderizarPergunta();
    navegarPara(tQuestionario);
});

function renderizarPergunta() {
    const pergunta = perguntas[indicePerguntaAtual];
    if (!pergunta) return;

    document.getElementById("progresso-questionario").innerText = `Pergunta ${indicePerguntaAtual + 1} de ${perguntas.length}`;

    let html = `<p class="form-group" style="font-size: 1.15rem; font-weight: 600; margin-bottom: 1.5rem;">${pergunta.texto}</p>`;
    pergunta.opcoes.forEach((opcao, idx) => {
        html += `
            <label class="opcao-container">
                <input type="radio" name="opcao" value="${opcao.valor}" ${idx === 0 ? "checked" : ""} required>
                <span>${opcao.texto}</span>
            </label>
        `;
    });
    document.getElementById("bloco-pergunta").innerHTML = html;

    const btnAnterior = document.getElementById("btn-pergunta-anterior");
    if (indicePerguntaAtual > 0) {
        btnAnterior.classList.remove("hidden");
    } else {
        btnAnterior.classList.add("hidden");
    }
}

document.getElementById("btn-pergunta-anterior").addEventListener("click", () => {
    if (indicePerguntaAtual > 0) {
        indicePerguntaAtual--;
        respostasFormulario.pop();
        renderizarPergunta();
    }
});

formPergunta.addEventListener("submit", async (e) => {
    e.preventDefault();
    const selecionado = document.querySelector('input[name="opcao"]:checked');
    if (!selecionado) {
        mostrarMensagem("Selecione uma opção antes de continuar.", "error");
        return;
    }

    respostasFormulario.push(Number.parseInt(selecionado.value, 10));

    if (indicePerguntaAtual < perguntas.length - 1) {
        indicePerguntaAtual++;
        renderizarPergunta();
        return;
    }

    await finalizarQuestionario();
});

async function finalizarQuestionario() {
    const pontuacaoTotal = respostasFormulario.reduce((acumulador, valor) => acumulador + valor, 0);
    let risco = "baixo";
    let descricao = "Sua condicao de saude aparente e estavel. Continue mantendo habitos saudaveis e preventivos alinhados com a ODS 3.";

    if (pontuacaoTotal >= 4 && pontuacaoTotal <= 7) {
        risco = "medio";
        descricao = "Atencao observada. Identificamos fatores de vulnerabilidade social ou clinica moderada. Recomendamos buscar orientacao na Unidade de Saude mais proxima.";
    } else if (pontuacaoTotal > 7) {
        risco = "alto";
        descricao = "Alerta critico! Seus sintomas ou condicoes estruturais indicam necessidade imediata de suporte ou intervencao medica emergencial.";
    }

    const payload = {
        id_usuario: usuarioLogado?.id_usuario ?? usuarioLogado?.id,
        respostas_sintomas: respostasFormulario,
        nivel_risco: risco
    };

    const res = await fetch("/api/triagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const dados = await res.json();
    if (!res.ok) {
        mostrarMensagem(dados.erro || "Não foi possível salvar a triagem.", "error");
        return;
    }

    const boxResultado = document.getElementById("box-resultado");
    boxResultado.className = `resultado-box ${risco}`;
    document.getElementById("resultado-risco").innerText = `Risco: ${risco.charAt(0).toUpperCase()}${risco.slice(1)}`;
    document.getElementById("resultado-descricao").innerText = descricao;

    navegarPara(tResultados);
}

document.getElementById("btn-voltar-painel").addEventListener("click", () => {
    carregarPainel();
});

document.getElementById("btn-atualizar-alertas").addEventListener("click", carregarAlertas);

function normalizarClassRisco(risco) {
    return String(risco ?? "baixo").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function carregarAlertas() {
    const res = await fetch("/api/alertas");
    if (!res.ok) {
        return;
    }

    const dados = await res.json();
    const tbody = document.querySelector("#tabela-alertas tbody");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";
    const lista = Array.isArray(dados) ? dados : [];

    lista.forEach((item) => {
        const tr = document.createElement("tr");
        const dataFormatada = new Date(item.data).toLocaleString("pt-BR");
        const respostas = Array.isArray(item.respostas) ? item.respostas : [];
        const risco = normalizarClassRisco(item.risco);

        tr.innerHTML = `
            <td><strong>${item.nome}</strong></td>
            <td>${dataFormatada}</td>
            <td><span class="badge ${risco}">${item.risco}</span></td>
            <td>Valores de Resposta: [ ${respostas.join(", ")} ]</td>
        `;
        tbody.appendChild(tr);
    });
}
