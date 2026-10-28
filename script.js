/* =========================================================
   MURAL DA GRATIDÃO
   - Celular: escreve a mensagem
   - Telão (?telao=1): mostra as mensagens ao vivo
   - Cada mês usa um mural separado (?mural=nome para trocar)
========================================================= */

const params = new URLSearchParams(location.search);

function muralPadrao() {
    const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const hoje = new Date();
    return meses[hoje.getMonth()] + "-" + hoje.getFullYear();
}

const MURAL = (params.get("mural") || muralPadrao())
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

const ref = database.ref("gratidao/" + MURAL + "/mensagens");

const ehTelao = params.has("telao");

const CORES = ["#FFE6C7", "#E2F0DF", "#FCE1E4", "#E7E4FA", "#FFF3BF", "#DDEFF5"];


/* =========================================================
   UTILIDADES
========================================================= */

function el(id) {
    return document.getElementById(id);
}

function textoSeguro(texto, max) {
    return String(texto || "").trim().slice(0, max);
}


/* =========================================================
   TELA DO CELULAR
========================================================= */

function iniciarEscrever() {

    el("telaEscrever").hidden = false;

    const campo = el("campoMensagem");
    const contador = el("contador");
    let simbolo = "💛";

    campo.addEventListener("input", () => {
        contador.textContent = campo.value.length;
    });

    el("simbolos").addEventListener("click", (evento) => {
        const botao = evento.target.closest(".simbolo");
        if (!botao) return;
        document.querySelectorAll(".simbolo").forEach((b) => b.classList.remove("ativo"));
        botao.classList.add("ativo");
        simbolo = botao.dataset.simbolo;
    });

    el("formGratidao").addEventListener("submit", async (evento) => {

        evento.preventDefault();

        const mensagem = textoSeguro(campo.value, 220);
        const nome = textoSeguro(el("campoNome").value, 40);
        const erro = el("erro");
        const botao = el("botaoEnviar");

        erro.hidden = true;

        if (mensagem.length < 2) {
            erro.textContent = "Escreva sua mensagem antes de enviar 💛";
            erro.hidden = false;
            return;
        }

        botao.disabled = true;
        botao.textContent = "Enviando...";

        try {
            await ref.push({
                mensagem: mensagem,
                nome: nome,
                simbolo: simbolo,
                cor: CORES[Math.floor(Math.random() * CORES.length)],
                criadoEm: firebase.database.ServerValue.TIMESTAMP,
                oculto: false
            });

            el("formGratidao").hidden = true;
            el("enviado").hidden = false;

        } catch (e) {
            console.error(e);
            erro.textContent = "Não consegui enviar agora. Tente de novo em instantes.";
            erro.hidden = false;

        } finally {
            botao.disabled = false;
            botao.textContent = "Enviar meu obrigado 💛";
        }
    });

    el("botaoOutra").addEventListener("click", () => {
        campo.value = "";
        el("campoNome").value = "";
        contador.textContent = "0";
        el("enviado").hidden = true;
        el("formGratidao").hidden = false;
        campo.focus();
    });
}


/* =========================================================
   TELÃO
========================================================= */

function iniciarTelao() {

    document.body.classList.add("modo-telao");
    el("telaTelao").hidden = false;

    const mural = el("mural");
    const mensagens = {};

    function atualizarContagem() {
        const visiveis = Object.values(mensagens).filter((m) => !m.oculto).length;
        el("totalLuzes").textContent = visiveis;
        el("vazio").hidden = visiveis > 0;
    }

    function criarCartao(id, dados) {

        const cartao = document.createElement("article");
        cartao.className = "luz";
        cartao.id = "msg-" + id;
        cartao.style.setProperty("--cor", CORES.includes(dados.cor) ? dados.cor : CORES[Math.floor(Math.random() * CORES.length)]);
        cartao.style.setProperty("--giro", (Math.random() * 3 - 1.5).toFixed(1) + "deg");

        const simbolo = document.createElement("div");
        simbolo.className = "luz-simbolo";
        simbolo.textContent = dados.simbolo || "💛";

        const texto = document.createElement("p");
        texto.className = "luz-texto";
        texto.textContent = dados.mensagem || "";

        const autor = document.createElement("p");
        autor.className = "luz-autor";
        autor.textContent = dados.nome ? "— " + dados.nome : "— Anônimo";

        const ocultar = document.createElement("button");
        ocultar.type = "button";
        ocultar.className = "luz-ocultar";
        ocultar.title = "Ocultar do mural";
        ocultar.textContent = "✕";
        ocultar.addEventListener("click", () => {
            ref.child(id).update({ oculto: true });
        });

        cartao.append(simbolo, texto, autor, ocultar);
        return cartao;
    }

    ref.on("child_added", (snap) => {
        const dados = snap.val() || {};
        mensagens[snap.key] = dados;
        if (!dados.oculto) {
            mural.prepend(criarCartao(snap.key, dados));
        }
        atualizarContagem();
    });

    ref.on("child_changed", (snap) => {
        const dados = snap.val() || {};
        mensagens[snap.key] = dados;
        const existente = el("msg-" + snap.key);
        if (dados.oculto && existente) existente.remove();
        atualizarContagem();
    });

    ref.on("child_removed", (snap) => {
        delete mensagens[snap.key];
        const existente = el("msg-" + snap.key);
        if (existente) existente.remove();
        atualizarContagem();
    });

    el("botaoExportar").addEventListener("click", () => {
        const linhas = Object.values(mensagens)
            .filter((m) => !m.oculto)
            .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0))
            .map((m) => (m.simbolo || "💛") + " " + m.mensagem + "  — " + (m.nome || "Anônimo"));

        const blob = new Blob(
            ["Mural da Gratidão · " + MURAL + "\n\n" + linhas.join("\n\n")],
            { type: "text/plain;charset=utf-8" }
        );
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "mural-gratidao-" + MURAL + ".txt";
        link.click();
        URL.revokeObjectURL(link.href);
    });

    atualizarContagem();
}


/* =========================================================
   INÍCIO
========================================================= */

if (ehTelao) {
    iniciarTelao();
} else {
    iniciarEscrever();
}
