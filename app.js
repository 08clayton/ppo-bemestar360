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

function navegarPara(tela) {
    tAutenticacao.classList.add("hidden");
    tPrincipal.classList.add("hidden");
    tQuestionario.classList.add("hidden");
    tResultados.classList.add("hidden");
    tela.classList.remove("hidden");
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
    const nome = document.getElementById("cad-nome").value;
    const email = document.getElementById("cad-email").value;
    const senha = document.getElementById("cad-senha").value;
    const tipo = document.getElementById("cad-tipo").value;

    const res = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, tipo })
    });
    const dados = await res.json();
    if (res.ok && dados.sucesso) {
        formCadastro.reset();
        tabLogin.click();
        authMensagem.className = "mensagem";
        authMensagem.style.backgroundColor = "#c6f6d5";
        authMensagem.style.color = "#22543d";
        authMensagem.innerText = "Conta criada com sucesso! Faça o login.";
        authMensagem.classList.remove("hidden");
    } else {
        authMensagem.className = "mensagem error";
        authMensagem.innerText = dados.erro || "Erro ao realizar cadastro.";
        authMensagem.classList.remove("hidden");
    }
});

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    authMensagem.classList.add("hidden");
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, residential: undefined, senha })
    });
    const dados = await res.json();
    if (res.ok && dados.sucesso) {
        usuarioLogado = dados.usuario;
        formLogin.reset();
        txtUsuarioLogado.innerText = `${usuarioLogado.nome} (${usuarioLogado.tipo})`;
        headerUsuarioInfo.classList.remove("hidden");
        carregarPainel();
    } else {
        authMensagem.className = "mensagem error";
        authMensagem.innerText = dados.erro || "Falha na autenticação.";
        authMensagem.classList.remove("hidden");
    }
});

btnLogout.addEventListener("click", () => {
    usuarioLogado = null;
    headerUsuarioInfo.classList.add("hidden");
    navegarPara(tAutenticacao);
});

function carregarPainel() {
    navegarPara(tPrincipal);
    if (usuarioLogado.tipo === "paciente") {
        acoesPaciente.classList.remove("hidden");
        acoesProfissional.classList.add("hidden");
    } else if (usuarioLogado.tipo === "profissional") {
        acoesPaciente.classList.add("hidden");
        acoesProfissional.classList.remove("hidden");
        carregarAlertas();
    }
}

document.getElementById("btn-iniciar-questionario").addEventListener("click", () => {
    indicePerguntaAtual = 0;
    respostasFormulario = [];
    renderizarPergunta();
    navegarPara(tQuestionario);
});

function renderizarPergunta() {
    const pergunta = perguntas[indicePerguntaAtual];
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

    if (indicePerguntaAtual > 0) {
        document.getElementById("btn-pergunta-anterior").classList.remove("hidden");
    } else {
        document.getElementById("btn-pergunta-anterior").classList.add("hidden");
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
    respostasFormulario.push(parseInt(selecionado.value));

    if (indicePerguntaAtual < perguntas.length - 1) {
        indicePerguntaAtual++;
        renderizarPergunta();
    } else {
        await finalizarQuestionario();
    }
});

async function finalizarQuestionario() {
    const pontuacaoTotal = respostasFormulario.reduce((a, b) => a + b, 0);
    let risco = "Baixo";
    let descricao = "Sua condicao de saude aparente e estavel. Continue mantendo habitos saudaveis e preventivos alinhados com a ODS 3.";

    if (pontuacaoTotal >= 4 && pontuacaoTotal <= 7) {
        risco = "Medio";
        descricao = "Atencao observada. Identificamos fatores de vulnerabilidade social ou clinica moderada. Recomendamos buscar orientacao na Unidade de Saude mais proxima.";
    } else if (pontuacaoTotal > 7) {
        risco = "Alto";
        descricao = "Alerta critico! Seus sintomas ou condicoes estruturais indicam necessidade imediata de suporte ou intervencao medica emergencial.";
    }

    const payload = {
        usuario_id: usuarioLogado.id,
        respostas: respostasFormulario,
        risco: risco
    };

    await fetch("/api/triagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const boxResultado = document.getElementById("box-resultado");
    boxResultado.className = `resultado-box ${risco.toLowerCase()}`;
    document.getElementById("resultado-risco").innerText = `Risco: ${risco}`;
    document.getElementById("resultado-descricao").innerText = descricao;

    navegarPara(tResultados);
}

document.getElementById("btn-voltar-painel").addEventListener("click", () => {
    carregarPainel();
});

document.getElementById("btn-atualizar-alertas").addEventListener("click", carregarAlertas);

async function carregarAlertas() {
    const res = await fetch("/api/alertas");
    if (res.ok) {
        const dados = await res.json();
        const tbody = document.querySelector("#tabela-alertas tbody");
        tbody.innerHTML = "";
        
        dados.forEach(item => {
            const tr = document.createElement("tr");
            const dataFormatada = new Date(item.data).toLocaleString("pt-BR");
            
            tr.innerHTML = `
                <td><strong>${item.nome}</strong></td>
                <td>${dataFormatada}</td>
                <td><span class="badge ${item.risco.toLowerCase()}">${item.risco}</span></td>
                <td>Valores de Resposta: [ ${item.respostas.join(", ")} ]</td>
            `;
            tbody.appendChild(tr);
        });
    }
}