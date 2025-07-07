import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://dwnohpdgyhsinmnnzmyc.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3bm9ocGRneWhzaW5tbm56bXljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2ODA3MDQsImV4cCI6MjA2NTI1NjcwNH0.q5oyCNRgcFZEtDT2PUyzBGjy-klTSCO59oGiG5cEYwI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_URL = 'https://lista-backend-28e8.onrender.com';

const loginSection = document.getElementById('login-section');
const main = document.getElementById('main');
const nomeInput = document.getElementById('input-nome');
const telefoneInput = document.getElementById('input-telefone');
const listaComidas = document.getElementById('lista-comidas');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout'); 

document.addEventListener('DOMContentLoaded', async () => {
  const usuarioSalvo = localStorage.getItem('usuarioLogado');
  if (usuarioSalvo) {
    window.usuarioLogado = JSON.parse(usuarioSalvo);
    loginSection.classList.add('hidden');
    main.classList.remove('hidden');
    if(window.usuarioLogado.telefone === '11111111111') {
      await gerarRelatoriosPDF(); // Se já estiver logado como ADM, gerar PDFs
    }
    await carregarComidas();
    iniciarRealtime();
  } else {
    loginSection.classList.remove('hidden');
    main.classList.add('hidden');
  }
});

btnLogin.addEventListener('click', async () => {
  if (btnLogin.disabled) return;

  const nome = nomeInput.value.trim();
  const telefone = telefoneInput.value.trim();

  if (!nome || !telefone) {
    Swal.fire({
      icon: 'warning',
      title: 'Oops...',
      text: 'Preencha nome completo e telefone.',
    });
    return;
  }

  btnLogin.disabled = true;
  const originalText = btnLogin.textContent;
  btnLogin.textContent = 'Carregando...';

  try {
    const res = await fetch(`${API_URL}/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao autenticar usuário');

    window.usuarioLogado = { nome, telefone };
    localStorage.setItem('usuarioLogado', JSON.stringify({ nome, telefone }));

    loginSection.classList.add('hidden');
    main.classList.remove('hidden');

    if(telefone === '11111111111') {
      await gerarRelatoriosPDF();
    }

    await carregarComidas();
    iniciarRealtime();
  } catch (e) {
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: e.message,
    });
  } finally {
    if (!loginSection.classList.contains('hidden')) {
      btnLogin.disabled = false;
      btnLogin.textContent = originalText;
    }
  }
});

// Função para gerar e baixar os PDFs para o ADM
async function gerarRelatoriosPDF() {
  const { jsPDF } = window.jspdf;

  try {
    // Buscar usuários
    const resUsuarios = await fetch(`${API_URL}/relatorio/usuarios`);
    if (!resUsuarios.ok) throw new Error('Erro ao buscar relatório de usuários');
    const usuarios = await resUsuarios.json();

    // Buscar comidas faltantes
    const resComidas = await fetch(`${API_URL}/relatorio/comidas-faltantes`);
    if (!resComidas.ok) throw new Error('Erro ao buscar relatório de comidas faltantes');
    const comidas = await resComidas.json();

    // Criar PDF usuários
    const pdfUsuarios = new jsPDF();
    pdfUsuarios.setFontSize(14);
    pdfUsuarios.text('Relatório de Usuários', 10, 10);
    pdfUsuarios.setFontSize(10);

    let y = 20;
    pdfUsuarios.text('Nome | Telefone | Item', 10, y);
    y += 10;

    usuarios.forEach(u => {
      const linha = `${u.nome} | ${u.telefone} | ${u.item || '0'}`;
      pdfUsuarios.text(linha, 10, y);
      y += 8;
      if (y > 280) {
        pdfUsuarios.addPage();
        y = 10;
      }
    });

    pdfUsuarios.save('relatorio_usuarios.pdf');

    // Criar PDF comidas faltantes
    const pdfComidas = new jsPDF();
    pdfComidas.setFontSize(14);
    pdfComidas.text('Relatório de Comidas Faltantes', 10, 10);
    pdfComidas.setFontSize(10);

    y = 20;
    pdfComidas.text('Comida | Quantidade', 10, y);
    y += 10;

    comidas.forEach(c => {
      const linha = `${c.comida} | ${c.quantidade}`;
      pdfComidas.text(linha, 10, y);
      y += 8;
      if (y > 280) {
        pdfComidas.addPage();
        y = 10;
      }
    });

    pdfComidas.save('relatorio_comidas_faltantes.pdf');

  } catch (e) {
    console.error('Erro ao gerar PDFs:', e);
  }
}

// Função para carregar comidas
async function carregarComidas() {
  try {
    const loadingDiv = criarLoader(); 
    document.body.appendChild(loadingDiv); 

    const { nome, telefone } = window.usuarioLogado;
    const res = await fetch(`${API_URL}/comidas-usuario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao carregar comidas');
    }

    const { comidas } = await res.json();

    listaComidas.innerHTML = '';
    comidas.forEach(item => {
      const card = document.createElement('div');
      card.className = `flex justify-between items-center px-6 py-4 border-t ${item.quantidade_disponivel === 0 ? 'opacity-50' : ''}`;

      const icon = document.createElement('span');
      icon.className = `cursor-pointer text-2xl ${item.reservado ? 'text-green-600' : 'text-yellow-600'}`;
      icon.title = item.reservado ? 'Clique para cancelar reserva' : 'Clique para reservar';
      icon.innerHTML = item.reservado ? '✔️' : '+';

      if (item.quantidade_disponivel === 0 && !item.reservado) {
        icon.style.cursor = 'not-allowed';
        icon.classList.remove('text-yellow-600');
        icon.classList.add('text-gray-400');
      } else {
        icon.addEventListener('click', (event) => toggleReserva(item, event));
      }

      const reservados = item.reservados.length > 0 ? item.reservados.map(nome => `<span class="reservado">${nome}</span>`).join(', ') : 'Ninguém';

      card.innerHTML = `
        <div>
          <p class="font-medium text-yellow-800">${item.nome}</p>
          <p class="text-sm text-gray-500">Reservado: ${reservados}</p>
        </div>
      `;
      card.appendChild(icon);

      listaComidas.appendChild(card);
    });
  } catch (e) {
    listaComidas.innerHTML = `<p class="p-4 text-red-600">${e.message}</p>`;
  } finally {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.remove(); 
  }
}

function criarLoader() {
  const loaderDiv = document.createElement('div');
  loaderDiv.id = 'loading';
  loaderDiv.className = 'fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50';

  const ballsContainer = document.createElement('div');
  ballsContainer.className = 'flex space-x-2';  

  const iconUrls = [
    'https://cdn-icons-png.freepik.com/512/6154/6154843.png',
    'https://cdn-icons-png.freepik.com/512/3060/3060720.png?ga=GA1.1.1746197442.1750055791',
    'https://cdn-icons-png.freepik.com/512/10342/10342545.png?ga=GA1.1.1746197442.1750055791'
  ];

  for (let i = 0; i < 3; i++) {
    const icon = document.createElement('img');
    icon.src = iconUrls[i];
    icon.className = 'w-6 h-6'; 
    icon.style.animation = `pulse 1s ease-in-out infinite`;
    icon.style.animationDelay = `${i * 0.2}s`; 
    ballsContainer.appendChild(icon);
  }

  loaderDiv.appendChild(ballsContainer);
  return loaderDiv;
}

const style = document.createElement('style');
style.innerHTML = `
  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }
`;
document.head.appendChild(style);

async function toggleReserva(item, event) {
  const { nome, telefone } = window.usuarioLogado;
  if (!nome || !telefone) {
    Swal.fire({
      icon: 'warning',
      title: 'Usuário não autenticado',
      text: 'Faça login antes de reservar',
    });
    return;
  }

  const icon = event.target;
  icon.style.pointerEvents = 'none';
  const originalIconHTML = icon.innerHTML;
  icon.innerHTML = '⏳';

  const loadingDiv = criarLoader();
  document.body.appendChild(loadingDiv); 

  try {
    if (item.reservado) {
      const res = await fetch(`${API_URL}/comidas/${item.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cancelar reserva');
      Swal.fire({
        icon: 'success',
        title: 'Reserva cancelada',
        timer: 1500,
        showConfirmButton: false,
      });
    } else {
      const res = await fetch(`${API_URL}/comidas/${item.id}/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao reservar item');
      Swal.fire({
        icon: 'success',
        title: 'Reserva feita',
        timer: 1500,
        showConfirmButton: false,
      });
    }

    await carregarComidas();
  } catch (e) {
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: e.message,
    });
  } finally {
    icon.style.pointerEvents = '';
    icon.innerHTML = originalIconHTML;
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.remove(); 
  }
}

function iniciarRealtime() {
  const channelComidas = supabase.channel('public:comidas_festa');
  channelComidas.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'comidas_festa' },
    () => carregarComidas()
  );
  channelComidas.subscribe();

  const channelReservas = supabase.channel('public:reservas_festa');
  channelReservas.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'reservas_festa' },
    () => carregarComidas()
  );
  channelReservas.subscribe();
}

function logout() {
  localStorage.removeItem('usuarioLogado');
  window.usuarioLogado = null;
  loginSection.classList.remove('hidden');
  main.classList.add('hidden');
  nomeInput.value = '';
  telefoneInput.value = '';
  location.reload(); 
}

btnLogout.addEventListener('click', () => {
  logout();
});
